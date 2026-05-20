import { z } from 'zod'

export const AgentProfileSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'name must be alphanumeric/dash/underscore'),
  displayName: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  cwd: z.string().default('${workspace}/agents/${name}'),
  initialPrompt: z.string().default(''),
  readyDelayMs: z.number().int().min(0).max(60_000).default(1500)
})
export type AgentProfile = z.infer<typeof AgentProfileSchema>

export const SettingsSchema = z.object({
  workspaceRoot: z.string().default('~/.ccswarm/workspaces'),
  terminal: z.enum(['iterm2']).default('iterm2'),
  pythonPath: z.string().default('python3'),
  protocolTemplate: z.string(),
  general: z
    .object({
      autoStart: z.boolean().default(false),
      fontSize: z.number().int().min(8).max(48).default(13)
    })
    .default({ autoStart: false, fontSize: 13 })
})
export type Settings = z.infer<typeof SettingsSchema>

export interface RunSummary {
  runId: string
  startedAt: string
  workspaceDir: string
  windowId: string | null
  agents: Array<{ name: string; sessionId: string }>
}

export interface LaunchRequest {
  profileNames: string[]
}
