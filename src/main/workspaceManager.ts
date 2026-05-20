import { promises as fs } from 'fs'
import { join } from 'path'
import { AgentProfile, Settings } from './types'
import { expandHome } from './paths'

export interface Workspace {
  runId: string
  root: string
  sharedDir: string
  protocolFile: string
  agentDirs: Record<string, { cwd: string; inbox: string; outbox: string; processed: string }>
}

function nowRunId(): string {
  const d = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

function renderTemplate(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}/g, (_, k) => vars[k] ?? `{{${k}}}`)
}

export class WorkspaceManager {
  async create(settings: Settings, profiles: AgentProfile[]): Promise<Workspace> {
    const root = join(expandHome(settings.workspaceRoot), nowRunId())
    const sharedDir = join(root, 'shared')
    await fs.mkdir(sharedDir, { recursive: true })

    const agentDirs: Workspace['agentDirs'] = {}
    for (const p of profiles) {
      const cwd = renderTemplate(p.cwd, { workspace: root, name: p.name })
      const base = join(root, 'agents', p.name)
      const inbox = join(base, 'inbox')
      const outbox = join(base, 'outbox')
      const processed = join(inbox, 'processed')
      await fs.mkdir(cwd, { recursive: true })
      await fs.mkdir(inbox, { recursive: true })
      await fs.mkdir(outbox, { recursive: true })
      await fs.mkdir(processed, { recursive: true })
      agentDirs[p.name] = { cwd, inbox, outbox, processed }
    }

    const protocolFile = join(root, 'PROTOCOL.md')
    await fs.writeFile(protocolFile, settings.protocolTemplate, 'utf8')

    return {
      runId: root.split('/').pop()!,
      root,
      sharedDir,
      protocolFile,
      agentDirs
    }
  }

  renderAgentProtocol(
    settings: Settings,
    workspace: Workspace,
    profile: AgentProfile,
    peerNames: string[]
  ): string {
    const dirs = workspace.agentDirs[profile.name]
    const peersList = peerNames.length
      ? peerNames.map((n) => `  - ${n}`).join('\n')
      : '  (no peers in this run)'
    const protocol = renderTemplate(settings.protocolTemplate, {
      agent_name: profile.name,
      inbox: dirs.inbox,
      outbox: dirs.outbox,
      shared_dir: workspace.sharedDir,
      workspace: workspace.root,
      peers_list: peersList
    })
    if (profile.initialPrompt && profile.initialPrompt.trim().length > 0) {
      return `${protocol}\n\n---\n## Your role\n${profile.initialPrompt}\n`
    }
    return protocol
  }
}
