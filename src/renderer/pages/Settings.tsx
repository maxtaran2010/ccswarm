import React, { useEffect, useState } from 'react'
import { api, ClientTemplate, Settings as SettingsT } from '../api'

type Tab = 'swarm' | 'gateway' | 'protocol' | 'general'

export function Settings(): JSX.Element {
  const [settings, setSettings] = useState<SettingsT | null>(null)
  const [draft, setDraft] = useState<SettingsT | null>(null)
  const [templates, setTemplates] = useState<ClientTemplate[]>([])
  const [tab, setTab] = useState<Tab>('swarm')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    Promise.all([api().settings.load(), api().profiles.list()])
      .then(([s, list]) => {
        setSettings(s)
        setDraft(s)
        setTemplates(list)
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
  const swarm = draft.swarm

  function setSwarm(patch: Partial<typeof swarm>): void {
    setDraft({ ...draft!, swarm: { ...draft!.swarm, ...patch } })
  }

  function setRole(i: number, value: string): void {
    const roles = [...swarm.roles]
    while (roles.length < swarm.instanceCount) roles.push('')
    roles[i] = value
    setSwarm({ roles })
  }

  return (
    <div>
      <h2>Settings</h2>

      <div className="tabs">
        <button className={tab === 'swarm' ? 'active' : ''} onClick={() => setTab('swarm')}>
          Swarm
        </button>
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

      {tab === 'swarm' && (
        <div className="card col">
          <div>
            <span className="label">Client template</span>
            <select
              value={swarm.clientTemplate}
              onChange={(e) => setSwarm({ clientTemplate: e.target.value })}
            >
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.displayName} ({t.name})
                </option>
              ))}
              {!templates.find((t) => t.name === swarm.clientTemplate) && (
                <option value={swarm.clientTemplate}>{swarm.clientTemplate} (missing)</option>
              )}
            </select>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Edit templates in the Templates tab.
            </div>
          </div>

          <div className="row gap">
            <div style={{ width: 160 }}>
              <span className="label">Instance count</span>
              <input
                type="number"
                min={1}
                max={64}
                value={swarm.instanceCount}
                onChange={(e) =>
                  setSwarm({ instanceCount: Math.max(1, Math.min(64, Number(e.target.value) || 1)) })
                }
              />
            </div>
            <div style={{ flex: 1 }}>
              <span className="label">Name prefix</span>
              <input
                type="text"
                value={swarm.namePrefix}
                onChange={(e) => setSwarm({ namePrefix: e.target.value })}
              />
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                Agents will be named <span className="tag">{swarm.namePrefix}-1</span> …{' '}
                <span className="tag">{swarm.namePrefix}-{swarm.instanceCount}</span>.
              </div>
            </div>
          </div>

          <div>
            <span className="label">Window layout</span>
            <select
              value={swarm.windowMode}
              onChange={(e) =>
                setSwarm({ windowMode: e.target.value as 'grid' | 'windows' | 'tabs' })
              }
            >
              <option value="grid">Single window, split into panes (grid)</option>
              <option value="windows">Separate windows, tiled across screen</option>
              <option value="tabs">Single window, one tab per agent</option>
            </select>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              <strong>windows</strong> places one iTerm2 window per agent and tiles them in a
              ⌈√N⌉×⌈N/√N⌉ layout on the main screen.
            </div>
          </div>

          <div>
            <span className="label">Per-instance roles (optional)</span>
            <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
              Each instance can get its own role/prompt. Leave a row blank to use the
              template's <span className="tag">initialPrompt</span>.
            </div>
            <div className="col" style={{ gap: 6 }}>
              {Array.from({ length: swarm.instanceCount }).map((_, i) => (
                <div key={i} className="row">
                  <span className="tag" style={{ minWidth: 90, textAlign: 'center' }}>
                    {swarm.namePrefix}-{i + 1}
                  </span>
                  <input
                    type="text"
                    placeholder="(use template prompt)"
                    value={swarm.roles[i] ?? ''}
                    onChange={(e) => setRole(i, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

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
              Variables: <span className="tag">{'{{agent_name}}'}</span>{' '}
              <span className="tag">{'{{inbox}}'}</span>{' '}
              <span className="tag">{'{{outbox}}'}</span>{' '}
              <span className="tag">{'{{shared_dir}}'}</span>{' '}
              <span className="tag">{'{{workspace}}'}</span>{' '}
              <span className="tag">{'{{peers_list}}'}</span>
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
            <span>Launch swarm on app start</span>
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
