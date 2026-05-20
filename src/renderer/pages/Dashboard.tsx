import React, { useEffect, useState } from 'react'
import { api, AgentProfile, RunSummary } from '../api'

export function Dashboard(): JSX.Element {
  const [profiles, setProfiles] = useState<AgentProfile[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [run, setRun] = useState<RunSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function refresh(): Promise<void> {
    setProfiles(await api().profiles.list())
    setRun(await api().swarm.status())
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)))
  }, [])

  function toggle(name: string): void {
    const next = new Set(selected)
    if (next.has(name)) next.delete(name)
    else next.add(name)
    setSelected(next)
  }

  async function launch(): Promise<void> {
    if (selected.size === 0) return
    setBusy(true)
    setError(null)
    try {
      const summary = await api().swarm.launch([...selected])
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

  return (
    <div>
      <div className="row">
        <h2>Dashboard</h2>
        <span className="spacer" />
        <span className={`status-pill ${run ? 'run' : 'idle'}`}>
          {run ? `running · ${run.runId}` : 'idle'}
        </span>
      </div>

      {error && <div className="card" style={{ borderColor: '#6a3030', marginBottom: 12 }}>
        <div className="error">{error}</div>
      </div>}

      <div className="card">
        <div className="label">Select agents to launch</div>
        {profiles.length === 0 && (
          <div className="muted">
            No agent profiles yet — open the Agents tab to create one.
          </div>
        )}
        <div className="list">
          {profiles.map((p) => (
            <label
              key={p.name}
              className={`list-row ${selected.has(p.name) ? 'selected' : ''}`}
            >
              <input
                type="checkbox"
                checked={selected.has(p.name)}
                onChange={() => toggle(p.name)}
                disabled={!!run}
              />
              <span>{p.displayName}</span>
              <span className="tag">{p.name}</span>
              <span className="spacer" />
              <span className="tag">{p.command}</span>
            </label>
          ))}
        </div>

        <div className="row" style={{ marginTop: 16 }}>
          {!run ? (
            <button
              className="primary"
              onClick={launch}
              disabled={busy || selected.size === 0}
            >
              {busy ? 'Launching…' : `Launch swarm (${selected.size})`}
            </button>
          ) : (
            <button className="danger" onClick={stop} disabled={busy}>
              {busy ? 'Stopping…' : 'Stop swarm'}
            </button>
          )}
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
            <span>iTerm2 window:</span>
            <span className="tag">{run.windowId}</span>
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
