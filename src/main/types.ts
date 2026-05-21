import { z } from 'zod'

/**
 * A client template describes how to launch one instance of an agent CLI
 * (claude-code, codex, hermes, ...). The swarm runs N copies of one chosen
 * template; per-instance roles override the initial prompt.
 */
export const ClientTemplateSchema = z.object({
  name: z.string().regex(/^[a-zA-Z0-9_-]+$/, 'name must be alphanumeric/dash/underscore'),
  displayName: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).default({}),
  cwd: z.string().default('${workspace}/agents/${name}'),
  initialPrompt: z.string().default(''),
  /**
   * Optional keystrokes sent after the CLI starts but before the protocol
   * prompt. Useful for dismissing first-run TUI dialogs (e.g. Claude Code's
   * "Trust this folder?" prompt — set this to "\r" to accept the default).
   */
  prelude: z.string().default(''),
  readyDelayMs: z.number().int().min(0).max(60_000).default(1500)
})
export type ClientTemplate = z.infer<typeof ClientTemplateSchema>

/** Backwards-compat alias used by older code. */
export const AgentProfileSchema = ClientTemplateSchema
export type AgentProfile = ClientTemplate

export const SwarmConfigSchema = z.object({
  /** name of a ClientTemplate stored in ~/.ccswarm/agents/<name>.json */
  clientTemplate: z.string().default('claude-code'),
  /** how many instances to launch */
  instanceCount: z.number().int().min(1).max(64).default(4),
  /** prefix for generated agent names (suffix is 1..N) */
  namePrefix: z.string().regex(/^[a-zA-Z0-9_-]+$/).default('agent'),
  /**
   * How agents are arranged in iTerm2.
   * - grid:    one window split into N panes (default).
   * - windows: N separate windows tiled across the screen.
   * - tabs:    one window with N tabs.
   */
  windowMode: z.enum(['grid', 'windows', 'tabs']).default('grid'),
  /**
   * Optional per-instance roles. roles[i] is appended to the protocol message
   * sent to instance i+1. If shorter than instanceCount, extra instances
   * receive only the template's initialPrompt. Empty entries also fall through
   * to the template prompt.
   */
  roles: z.array(z.string()).default([])
})
export type SwarmConfig = z.infer<typeof SwarmConfigSchema>

export const SettingsSchema = z.object({
  workspaceRoot: z.string().default('~/.ccswarm/workspaces'),
  terminal: z.enum(['iterm2']).default('iterm2'),
  pythonPath: z.string().default('python3'),
  protocolTemplate: z.string(),
  swarm: SwarmConfigSchema.default({
    clientTemplate: 'claude-code',
    instanceCount: 4,
    namePrefix: 'agent',
    windowMode: 'grid',
    roles: []
  }),
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
  windowIds: string[]
  agents: Array<{ name: string; sessionId: string }>
}
