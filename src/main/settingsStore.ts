import { promises as fs } from 'fs'
import { CCSWARM_HOME, CONFIG_FILE } from './paths'
import { Settings, SettingsSchema } from './types'
import { DEFAULT_PROTOCOL_TEMPLATE } from './defaultProtocol'

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p)
    return true
  } catch {
    return false
  }
}

function defaults(): Settings {
  return SettingsSchema.parse({
    protocolTemplate: DEFAULT_PROTOCOL_TEMPLATE
  })
}

export class SettingsStore {
  private cached: Settings | null = null

  async init(): Promise<Settings> {
    await fs.mkdir(CCSWARM_HOME, { recursive: true })
    if (!(await fileExists(CONFIG_FILE))) {
      const def = defaults()
      await fs.writeFile(CONFIG_FILE, JSON.stringify(def, null, 2) + '\n', 'utf8')
      this.cached = def
      return def
    }
    return this.load()
  }

  async load(): Promise<Settings> {
    const raw = await fs.readFile(CONFIG_FILE, 'utf8')
    const merged = { ...defaults(), ...JSON.parse(raw) }
    this.cached = SettingsSchema.parse(merged)
    return this.cached
  }

  async save(next: Settings): Promise<Settings> {
    const parsed = SettingsSchema.parse(next)
    await fs.writeFile(CONFIG_FILE, JSON.stringify(parsed, null, 2) + '\n', 'utf8')
    this.cached = parsed
    return parsed
  }

  current(): Settings {
    if (!this.cached) throw new Error('SettingsStore not initialized')
    return this.cached
  }
}
