import React, { useEffect, useState } from 'react'
import { api, Settings as SettingsT } from '../api'

type Tab = 'gateway' | 'protocol' | 'general'

export function Settings(): JSX.Element {
  const [settings, setSettings] = useState<SettingsT | null>(null)
  const [draft, setDraft] = useState<SettingsT | null>(null)
  const [tab, setTab] = useState<Tab>('gateway')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    api()
      .settings.load()
      .then((s) => {
        setSettings(s)
        setDraft(s)
      })
      .catch((e) => setError(String(e)))
  }, [])

  async function save(): Promise<void> {
    if (!draft) return
    setBusy(true)
    setError(null)
    try {
      const saved = await api().settings.save(draft)
      setSettings(saved)
      setDraft(saved)
      setSavedAt(Date.now())
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    } finally {
      setBusy(false)
    }
  }

  function reset(): void {
    if (settings) setDraft(settings)
  }

  if (!draft) return <div className="muted">Loading…</div>

  const dirty = JSON.stringify(draft) !== JSON.stringify(settings)

  return (
    <div>
      <h2>Settings</h2>

      <div className="tabs">
        <button className={tab === 'gateway' ? 'active' : ''} onClick={() => setTab('gateway')}>
          Gateway / Workspace
        </button>
        <button className={tab === 'protocol' ? 'active' : ''} onClick={() => setTab('protocol')}>
          Protocol Prompt
        </button>
        <button className={tab === 'general' ? 'active' : ''} onClick={() => setTab('general')}>
          General
        </button>
      </div>

      {tab === 'gateway' && (
        <div className="card col">
          <div>
            <span className="label">Workspace root</span>
            <input
              type="text"
              value={draft.workspaceRoot}
              onChange={(e) => setDraft({ ...draft, workspaceRoot: e.target.value })}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Each run creates a timestamped subdirectory here with per-agent inbox/outbox folders.
            </div>
          </div>
          <div>
            <span className="label">Terminal</span>
            <select
              value={draft.terminal}
              onChange={(e) => setDraft({ ...draft, terminal: e.target.value as 'iterm2' })}
            >
              <option value="iterm2">iTerm2</option>
            </select>
          </div>
          <div>
            <span className="label">Python interpreter</span>
            <input
              type="text"
              value={draft.pythonPath}
              onChange={(e) => setDraft({ ...draft, pythonPath: e.target.value })}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Used to run the iTerm2 driver. Must have the <span className="tag">iterm2</span> package installed.
            </div>
          </div>
        </div>
      )}

      {tab === 'protocol' && (
        <div className="card col">
          <div>
            <span className="label">
              Global protocol prompt (injected into each agent at start)
            </span>
            <textarea
              rows={22}
              value={draft.protocolTemplate}
              onChange={(e) => setDraft({ ...draft, protocolTemplate: e.target.value })}
            />
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Variables: <span className="tag">{'{{agent_name}}'}</span> <span className="tag">{'{{inbox}}'}</span> <span className="tag">{'{{outbox}}'}</span> <span className="tag">{'{{shared_dir}}'}</span> <span className="tag">{'{{workspace}}'}</span> <span className="tag">{'{{peers_list}}'}</span>
            </div>
          </div>
        </div>
      )}

      {tab === 'general' && (
        <div className="card col">
          <label className="row">
            <input
              type="checkbox"
              checked={draft.general.autoStart}
              onChange={(e) =>
                setDraft({ ...draft, general: { ...draft.general, autoStart: e.target.checked } })
              }
            />
            <span>Launch last swarm on app start</span>
          </label>
          <div>
            <span className="label">Terminal font size</span>
            <input
              type="number"
              value={draft.general.fontSize}
              min={8}
              max={48}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  general: { ...draft.general, fontSize: Number(e.target.value) }
                })
              }
            />
          </div>
        </div>
      )}

      <div className="row" style={{ marginTop: 16 }}>
        <button className="primary" disabled={!dirty || busy} onClick={save}>
          {busy ? 'Saving…' : 'Save'}
        </button>
        <button disabled={!dirty || busy} onClick={reset}>
          Reset
        </button>
        {savedAt && !dirty && (
          <span className="muted" style={{ fontSize: 12 }}>
            Saved {new Date(savedAt).toLocaleTimeString()}
          </span>
        )}
        {error && <span className="error">{error}</span>}
      </div>
    </div>
  )
}
