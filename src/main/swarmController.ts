import { ProfileStore } from './profileStore'
import { SettingsStore } from './settingsStore'
import { WorkspaceManager, Workspace } from './workspaceManager'
import { ITermDriver } from './itermDriver'
import { AgentProfile, RunSummary, Settings } from './types'
import { promises as fs, watch, FSWatcher } from 'fs'
import { join } from 'path'

interface ActiveRun {
  runId: string
  windowIds: string[]
  workspace: Workspace
  agents: Array<{ name: string; sessionId: string }>
  startedAt: string
  watchers: FSWatcher[]
}

function shellEscape(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`
}

function buildLaunchCommand(profile: AgentProfile, cwd: string): string {
  const exports = Object.entries(profile.env)
    .map(([k, v]) => `export ${k}=${shellEscape(v)}`)
    .join('; ')
  const argv = [profile.command, ...profile.args].map(shellEscape).join(' ')
  const cd = `cd ${shellEscape(cwd)}`
  const head = exports ? `${exports}; ${cd}` : cd
  return `${head}; clear; ${argv}\r`
}

/**
 * Expand the swarm config into N concrete per-instance profiles.
 * All instances share the chosen client template; only `name` and
 * `initialPrompt` (role) differ.
 */
function expandSwarm(template: AgentProfile, settings: Settings): AgentProfile[] {
  const { instanceCount, namePrefix, roles } = settings.swarm
  const out: AgentProfile[] = []
  for (let i = 0; i < instanceCount; i++) {
    const role = (roles[i] ?? '').trim()
    const initialPrompt = role.length > 0 ? role : template.initialPrompt
    out.push({
      ...template,
      name: `${namePrefix}-${i + 1}`,
      initialPrompt
    })
  }
  return out
}

export class SwarmController {
  private active: ActiveRun | null = null

  constructor(
    private profiles: ProfileStore,
    private settings: SettingsStore,
    private workspaces: WorkspaceManager,
    private driver: ITermDriver
  ) {}

  isRunning(): boolean {
    return this.active !== null
  }

  current(): RunSummary | null {
    if (!this.active) return null
    return {
      runId: this.active.runId,
      startedAt: this.active.startedAt,
      workspaceDir: this.active.workspace.root,
      windowId: this.active.windowIds[0] ?? null,
      windowIds: this.active.windowIds,
      agents: this.active.agents
    }
  }

  /**
   * Launch the swarm using the active client template + instance count
   * stored in settings. No arguments needed from the caller.
   */
  async launch(): Promise<RunSummary> {
    if (this.active) {
      throw new Error('A swarm is already running. Stop it before launching another.')
    }

    const settings = this.settings.current()
    const template = await this.profiles.get(settings.swarm.clientTemplate)
    if (!template) {
      throw new Error(
        `Client template '${settings.swarm.clientTemplate}' not found. ` +
          `Pick one in Settings → Swarm.`
      )
    }

    const profiles = expandSwarm(template, settings)
    if (profiles.length === 0) {
      throw new Error('Instance count must be at least 1')
    }

    const workspace = await this.workspaces.create(settings, profiles)
    await this.driver.start()
    const mode = settings.swarm.windowMode
    const grid =
      mode === 'windows'
        ? await this.driver.createWindows(profiles.length)
        : mode === 'tabs'
        ? await this.driver.createTabs(profiles.length)
        : await this.driver.createGrid(profiles.length)

    if (grid.session_ids.length !== profiles.length) {
      throw new Error(
        `iTerm2 returned ${grid.session_ids.length} sessions for ${profiles.length} agents`
      )
    }

    const agents: ActiveRun['agents'] = []
    const peerNames = profiles.map((p) => p.name)

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i]
      const sessionId = grid.session_ids[i]
      const dirs = workspace.agentDirs[profile.name]
      const launchCmd = buildLaunchCommand(profile, dirs.cwd)
      await this.driver.sendText(sessionId, launchCmd)
      agents.push({ name: profile.name, sessionId })
    }

    for (let i = 0; i < profiles.length; i++) {
      const profile = profiles[i]
      const sessionId = grid.session_ids[i]
      const peers = peerNames.filter((n) => n !== profile.name)
      const protocol = this.workspaces.renderAgentProtocol(
        settings,
        workspace,
        profile,
        peers
      )
      await delay(Math.max(profile.readyDelayMs, 2500))
      if (profile.prelude && profile.prelude.length > 0) {
        // Hit Enter a couple of times to dismiss any trust/onboarding prompt.
        // The dialog can still be mid-render after readyDelayMs on slower
        // machines, so a single press sometimes lands before the focus is on
        // the confirm button.
        await this.driver.sendText(sessionId, profile.prelude)
        await delay(400)
        await this.driver.sendText(sessionId, profile.prelude)
        await delay(600)
      }
      await this.driver.sendText(sessionId, protocol)
      // Send Enter as a separate write. Some TUIs (Claude Code's input box
      // included) only treat CR as submit when it arrives in its own chunk,
      // otherwise it gets folded into the pasted body as a literal newline.
      await delay(120)
      await this.driver.sendText(sessionId, '\r')
    }

    const startedAt = new Date().toISOString()
    this.active = {
      runId: workspace.runId,
      windowIds: grid.window_ids,
      workspace,
      agents,
      startedAt,
      watchers: []
    }
    this.startInboxWatchers()
    return {
      runId: workspace.runId,
      startedAt,
      workspaceDir: workspace.root,
      windowId: grid.window_ids[0] ?? null,
      windowIds: grid.window_ids,
      agents
    }
  }

  async stop(): Promise<void> {
    if (!this.active) return
    for (const w of this.active.watchers) {
      try {
        w.close()
      } catch {
        /* ignore */
      }
    }
    try {
      await this.driver.closeWindows(this.active.windowIds)
    } catch (err) {
      console.error('[SwarmController] closeWindows failed:', err)
    }
    this.active = null
  }

  /**
   * Watch every agent's inbox directory and nudge the agent in iTerm2 when
   * a new message file appears, so the CLI actually notices the file instead
   * of sitting idle forever. Without this, peers can deliver messages but no
   * agent ever reads them.
   */
  private startInboxWatchers(): void {
    if (!this.active) return
    const run = this.active
    for (const a of run.agents) {
      const dirs = run.workspace.agentDirs[a.name]
      if (!dirs) continue
      const debounce = new Map<string, NodeJS.Timeout>()
      const watcher = watch(dirs.inbox, { persistent: false }, (_evt, filename) => {
        if (!filename) return
        const f = String(filename)
        // Ignore processed/ subdir, dotfiles, and partial writes.
        if (f.startsWith('.') || f === 'processed' || f.includes('/')) return
        const existing = debounce.get(f)
        if (existing) clearTimeout(existing)
        debounce.set(
          f,
          setTimeout(() => {
            debounce.delete(f)
            this.onInboxFile(a.name, a.sessionId, dirs.inbox, f).catch((e) =>
              console.error('[SwarmController] inbox notify failed:', e)
            )
          }, 200)
        )
      })
      watcher.on('error', (e) => console.error(`[SwarmController] watch ${dirs.inbox}:`, e))
      run.watchers.push(watcher)
    }
  }

  private async onInboxFile(
    agentName: string,
    sessionId: string,
    inboxDir: string,
    filename: string
  ): Promise<void> {
    const full = join(inboxDir, filename)
    try {
      const stat = await fs.stat(full)
      if (!stat.isFile()) return
    } catch {
      return // file disappeared (likely renamed into processed/)
    }
    const nudge =
      `\n[ccswarm] new inbox message for ${agentName}: ${full}\n` +
      `Read it, act on it, then move it into the processed/ folder. Reply via the peer's inbox per the protocol.`
    try {
      await this.driver.sendText(sessionId, nudge)
      await delay(120)
      await this.driver.sendText(sessionId, '\r')
    } catch (e) {
      console.error('[SwarmController] sendText nudge failed:', e)
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
