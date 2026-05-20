import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { join } from 'path'
import { resourcesDir } from './paths'
import { randomUUID } from 'crypto'

interface RpcResponse {
  id: string | null
  ok: boolean
  result?: unknown
  error?: string
  trace?: string
}

interface Pending {
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  timer: NodeJS.Timeout
}

export interface GridResult {
  window_id: string
  session_ids: string[]
  rows: number
  cols: number
}

export class ITermDriver {
  private proc: ChildProcessWithoutNullStreams | null = null
  private pending = new Map<string, Pending>()
  private buf = ''
  private ready = false
  private readyWaiters: Array<() => void> = []
  private pythonPath: string

  constructor(pythonPath = 'python3') {
    this.pythonPath = pythonPath
  }

  async start(): Promise<void> {
    if (this.proc) return
    const script = join(resourcesDir(), 'iterm-driver.py')
    const proc = spawn(this.pythonPath, [script], {
      stdio: ['pipe', 'pipe', 'pipe']
    })
    this.proc = proc

    proc.stdout.setEncoding('utf8')
    proc.stdout.on('data', (chunk: string) => this.onStdout(chunk))
    proc.stderr.setEncoding('utf8')
    proc.stderr.on('data', (chunk: string) => {
      console.error('[iterm-driver]', chunk.trim())
    })
    proc.on('exit', (code, signal) => {
      console.error(`[iterm-driver] exited code=${code} signal=${signal}`)
      this.proc = null
      this.ready = false
      for (const p of this.pending.values()) {
        clearTimeout(p.timer)
        p.reject(new Error('iterm-driver exited'))
      }
      this.pending.clear()
    })

    await this.waitReady(15_000)
  }

  async stop(): Promise<void> {
    if (!this.proc) return
    this.proc.stdin.end()
    this.proc.kill('SIGTERM')
    this.proc = null
    this.ready = false
  }

  private waitReady(timeoutMs: number): Promise<void> {
    if (this.ready) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(
          new Error(
            'iterm-driver did not become ready in time. Check that iTerm2 is running and the Python API is enabled.'
          )
        )
      }, timeoutMs)
      this.readyWaiters.push(() => {
        clearTimeout(timer)
        resolve()
      })
    })
  }

  private onStdout(chunk: string): void {
    this.buf += chunk
    let idx: number
    while ((idx = this.buf.indexOf('\n')) >= 0) {
      const line = this.buf.slice(0, idx).trim()
      this.buf = this.buf.slice(idx + 1)
      if (!line) continue
      let msg: RpcResponse
      try {
        msg = JSON.parse(line) as RpcResponse
      } catch {
        console.error('[iterm-driver] non-JSON stdout:', line)
        continue
      }
      if (msg.id === '_ready' && msg.ok) {
        this.ready = true
        for (const w of this.readyWaiters) w()
        this.readyWaiters = []
        continue
      }
      if (typeof msg.id !== 'string') continue
      const pending = this.pending.get(msg.id)
      if (!pending) continue
      this.pending.delete(msg.id)
      clearTimeout(pending.timer)
      if (msg.ok) pending.resolve(msg.result)
      else pending.reject(new Error(msg.error || 'iterm-driver error'))
    }
  }

  private call<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<T> {
    if (!this.proc || !this.ready) {
      return Promise.reject(new Error('iterm-driver not started'))
    }
    const id = randomUUID()
    const payload = JSON.stringify({ id, method, params }) + '\n'
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error(`iterm-driver call '${method}' timed out`))
      }, timeoutMs)
      this.pending.set(id, {
        resolve: (v) => resolve(v as T),
        reject,
        timer
      })
      this.proc!.stdin.write(payload)
    })
  }

  ping(): Promise<{ pong: boolean }> {
    return this.call('ping')
  }

  createGrid(count: number): Promise<GridResult> {
    return this.call('create_grid', { count }, 60_000)
  }

  sendText(sessionId: string, text: string): Promise<{ sent: number }> {
    return this.call('send_text', { session_id: sessionId, text })
  }

  closeWindow(windowId: string): Promise<{ closed: boolean }> {
    return this.call('close_window', { window_id: windowId })
  }
}
