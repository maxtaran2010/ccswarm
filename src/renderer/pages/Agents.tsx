import React, { useEffect, useState } from 'react'
import { api, AgentProfile } from '../api'

const BLANK: AgentProfile = {
  name: 'new-agent',
  displayName: 'New Agent',
  command: 'bash',
  args: ['-i'],
  env: {},
  cwd: '${workspace}/agents/${name}',
  initialPrompt: '',
  readyDelayMs: 1500
}

export function Agents(): JSX.Element {
  const [profiles, setProfiles] = useState<AgentProfile[]>([])
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [draft, setDraft] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  async function refresh(keepName?: string): Promise<void> {
    const list = await api().profiles.list()
    setProfiles(list)
    const name = keepName ?? selectedName ?? list[0]?.name ?? null
    if (name) selectProfile(name, list)
    else {
      setSelectedName(null)
      setDraft('')
    }
  }

  useEffect(() => {
    refresh().catch((e) => setError(String(e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function selectProfile(name: string, list: AgentProfile[] = profiles): void {
    const found = list.find((p) => p.name === name) || null
    setSelectedName(found ? found.name : null)
    setDraft(found ? JSON.stringify(found, null, 2) : '')
    setDirty(false)
    setError(null)
  }

  async function save(): Promise<void> {
    setError(null)
    let parsed: AgentProfile
    try {
      parsed = JSON.parse(draft)
    } catch (e) {
      setError(`Invalid JSON: ${e instanceof Error ? e.message : e}`)
      return
    }
    try {
      const saved = await api().profiles.save(parsed)
      await refresh(saved.name)
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e))
    }
  }

  async function remove(): Promise<void> {
    if (!selectedName) return
    if (!confirm(`Delete profile '${selectedName}'?`)) return
    await api().profiles.delete(selectedName)
    await refresh(undefined)
  }

  function newProfile(): void {
    setSelectedName(null)
    setDraft(JSON.stringify(BLANK, null, 2))
    setDirty(true)
    setError(null)
  }

  function duplicate(): void {
    if (!selectedName) return
    try {
      const obj = JSON.parse(draft) as AgentProfile
      obj.name = `${obj.name}-copy`
      obj.displayName = `${obj.displayName} (copy)`
      setSelectedName(null)
      setDraft(JSON.stringify(obj, null, 2))
      setDirty(true)
    } catch {
      setError('Cannot duplicate: current draft is invalid JSON.')
    }
  }

  return (
    <div>
      <div className="row">
        <h2>Agents</h2>
        <span className="spacer" />
        <button onClick={newProfile}>New</button>
        <button onClick={duplicate} disabled={!selectedName}>Duplicate</button>
      </div>

      <div className="row gap" style={{ alignItems: 'flex-start' }}>
        <div className="col" style={{ width: 260 }}>
          <div className="label">Profiles</div>
          <div className="list">
            {profiles.map((p) => (
              <div
                key={p.name}
                className={`list-row ${selectedName === p.name ? 'selected' : ''}`}
                onClick={() => selectProfile(p.name)}
                style={{ cursor: 'pointer' }}
              >
                <div>
                  <div>{p.displayName}</div>
                  <div className="muted" style={{ fontSize: 11 }}>{p.name}</div>
                </div>
                <span className="spacer" />
              </div>
            ))}
          </div>
        </div>

        <div className="col" style={{ flex: 1 }}>
          <div className="label">Profile JSON</div>
          <textarea
            rows={24}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value)
              setDirty(true)
            }}
          />
          {error && <div className="error">{error}</div>}
          <div className="row">
            <button className="primary" onClick={save} disabled={!dirty && !!selectedName}>
              Save
            </button>
            <button className="danger" onClick={remove} disabled={!selectedName}>
              Delete
            </button>
          </div>
          <div className="muted" style={{ marginTop: 8, fontSize: 12 }}>
            Templates available in <span className="tag">cwd</span>: <span className="tag">${'{workspace}'}</span> <span className="tag">${'{name}'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
