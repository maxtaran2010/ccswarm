import React, { useEffect, useState } from 'react'
import { api, ClientTemplate, RunSummary, Settings } from '../api'

export function Dashboard(): JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [template, setTemplate] = useState<ClientTemplate | null>(null)
  const [run, setRun] = useState<RunSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    const s = await api().settings.load()
    setSettings(s)
    const t = await api().profiles.get(s.swarm.clientTemplate)
    setTemplate(t)
    setRun(await api().swarm.status())
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)))
  }, [])

  async function launch(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      const summary = await api().swarm.launch()
      setRun(summary)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setBusy(false)
    }
  }

  async function stop(): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await api().swarm.stop()
      setRun(null)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setBusy(false)
    }
  }

  if (!settings) return <div className="muted">Loading…</div>

  const swarm = settings.swarm
  const templateMissing = !template

  return (
    <div>
      <div className="row">
        <h2>Dashboard</h2>
        <span className="spacer" />
        <span className={`status-pill ${run ? 'run' : 'idle'}`}>
          {run ? `running · ${run.runId}` : 'idle'}
        </span>
      </div>

      {error && (
        <div className="card" style={{ borderColor: '#6a3030', marginBottom: 12 }}>
          <div className="error">{error}</div>
        </div>
      )}

      <div className="card col">
        <div className="row gap">
          <div>
            <div className="label">Client</div>
            <div style={{ fontSize: 16 }}>
              {template ? template.displayName : <span className="error">{swarm.clientTemplate} (not found)</span>}
            </div>
            {template && <div className="muted">command: <span className="tag">{template.command}</span></div>}
          </div>
          <span className="spacer" />
          <div>
            <div className="label">Instances</div>
            <div style={{ fontSize: 16 }}>{swarm.instanceCount}</div>
          </div>
          <div>
            <div className="label">Name prefix</div>
            <div style={{ fontSize: 16 }}>
              <span className="tag">{swarm.namePrefix}-1</span> … <span className="tag">{swarm.namePrefix}-{swarm.instanceCount}</span>
            </div>
          </div>
        </div>

        <div className="row" style={{ marginTop: 8 }}>
          {!run ? (
            <button
              className="primary"
              onClick={launch}
              disabled={busy || templateMissing}
            >
              {busy ? 'Launching…' : `Launch swarm (${swarm.instanceCount})`}
            </button>
          ) : (
            <button className="danger" onClick={stop} disabled={busy}>
              {busy ? 'Stopping…' : 'Stop swarm'}
            </button>
          )}
          <span className="muted" style={{ fontSize: 12 }}>
            Change client / count / roles in <strong>Settings → Swarm</strong>.
          </span>
        </div>
      </div>

      {run && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="label">Active run</div>
          <div className="row">
            <span>workspace:</span>
            <span className="tag">{run.workspaceDir}</span>
            <button onClick={() => api().shell.openPath(run.workspaceDir)}>
              Open in Finder
            </button>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <span>started:</span>
            <span className="muted">{new Date(run.startedAt).toLocaleString()}</span>
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <span>iTerm2 window{run.windowIds.length > 1 ? 's' : ''}:</span>
            {run.windowIds.length === 0 ? (
              <span className="muted">none</span>
            ) : (
              run.windowIds.map((w) => (
                <span key={w} className="tag" style={{ marginRight: 4 }}>{w}</span>
              ))
            )}
          </div>
          <div className="label" style={{ marginTop: 12 }}>Agents</div>
          <div className="list">
            {run.agents.map((a) => (
              <div key={a.name} className="list-row">
                <span>{a.name}</span>
                <span className="spacer" />
                <span className="tag">{a.sessionId}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
