import { ProfileStore } from './profileStore'
import { SettingsStore } from './settingsStore'
import { WorkspaceManager, Workspace } from './workspaceManager'
import { ITermDriver } from './itermDriver'
import { AgentProfile, RunSummary } from './types'

interface ActiveRun {
  runId: string
  windowId: string
  workspace: Workspace
  agents: Array<{ name: string; sessionId: string }>
  startedAt: string
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
  return `${head}; clear; ${argv}\n`
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
      windowId: this.active.windowId,
      agents: this.active.agents
    }
  }

  async launch(profileNames: string[]): Promise<RunSummary> {
    if (this.active) {
      throw new Error('A swarm is already running. Stop it before launching another.')
    }
    if (profileNames.length === 0) {
      throw new Error('No agent profiles selected')
    }

    const settings = this.settings.current()
    const profiles: AgentProfile[] = []
    for (const name of profileNames) {
      const p = await this.profiles.get(name)
      if (!p) throw new Error(`Profile '${name}' not found`)
      profiles.push(p)
    }

    const workspace = await this.workspaces.create(settings, profiles)
    await this.driver.start()
    const grid = await this.driver.createGrid(profiles.length)

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

    // Wait for agents to start, then inject the protocol prompt to each.
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
      await delay(profile.readyDelayMs)
      await this.driver.sendText(sessionId, protocol + '\n')
    }

    const startedAt = new Date().toISOString()
    this.active = {
      runId: workspace.runId,
      windowId: grid.window_id,
      workspace,
      agents,
      startedAt
    }
    return {
      runId: workspace.runId,
      startedAt,
      workspaceDir: workspace.root,
      windowId: grid.window_id,
      agents
    }
  }

  async stop(): Promise<void> {
    if (!this.active) return
    try {
      await this.driver.closeWindow(this.active.windowId)
    } catch (err) {
      console.error('[SwarmController] closeWindow failed:', err)
    }
    this.active = null
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}
