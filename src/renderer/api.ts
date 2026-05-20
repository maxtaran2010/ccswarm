export interface AgentProfile {
  name: string
  displayName: string
  command: string
  args: string[]
  env: Record<string, string>
  cwd: string
  initialPrompt: string
  readyDelayMs: number
}

export interface Settings {
  workspaceRoot: string
  terminal: 'iterm2'
  pythonPath: string
  protocolTemplate: string
  general: {
    autoStart: boolean
    fontSize: number
  }
}

export interface RunSummary {
  runId: string
  startedAt: string
  workspaceDir: string
  windowId: string | null
  agents: Array<{ name: string; sessionId: string }>
}

interface CcswarmApi {
  profiles: {
    list(): Promise<AgentProfile[]>
    get(name: string): Promise<AgentProfile | null>
    save(profile: AgentProfile): Promise<AgentProfile>
    delete(name: string): Promise<void>
  }
  settings: {
    load(): Promise<Settings>
    save(settings: Settings): Promise<Settings>
  }
  swarm: {
    launch(profileNames: string[]): Promise<RunSummary>
    stop(): Promise<void>
    status(): Promise<RunSummary | null>
  }
  shell: {
    openPath(path: string): Promise<string>
  }
}

declare global {
  interface Window {
    ccswarm: CcswarmApi
  }
}

export const api = (): CcswarmApi => window.ccswarm
