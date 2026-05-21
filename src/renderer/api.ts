export interface ClientTemplate {
  name: string
  displayName: string
  command: string
  args: string[]
  env: Record<string, string>
  cwd: string
  initialPrompt: string
  readyDelayMs: number
}
export type AgentProfile = ClientTemplate

export interface SwarmConfig {
  clientTemplate: string
  instanceCount: number
  namePrefix: string
  windowMode: 'grid' | 'windows' | 'tabs'
  roles: string[]
}

export interface Settings {
  workspaceRoot: string
  terminal: 'iterm2'
  pythonPath: string
  protocolTemplate: string
  swarm: SwarmConfig
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
  windowIds: string[]
  agents: Array<{ name: string; sessionId: string }>
}

interface CcswarmApi {
  profiles: {
    list(): Promise<ClientTemplate[]>
    get(name: string): Promise<ClientTemplate | null>
    save(profile: ClientTemplate): Promise<ClientTemplate>
    delete(name: string): Promise<void>
  }
  settings: {
    load(): Promise<Settings>
    save(settings: Settings): Promise<Settings>
  }
  swarm: {
    launch(): Promise<RunSummary>
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
