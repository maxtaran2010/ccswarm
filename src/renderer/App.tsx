import React, { useState } from 'react'
import { Dashboard } from './pages/Dashboard'
import { Agents } from './pages/Agents'
import { Settings } from './pages/Settings'

type Page = 'dashboard' | 'agents' | 'settings'

export function App(): JSX.Element {
  const [page, setPage] = useState<Page>('dashboard')

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>ccswarm</h1>
        <nav>
          <button
            className={page === 'dashboard' ? 'active' : ''}
            onClick={() => setPage('dashboard')}
          >
            Dashboard
          </button>
          <button
            className={page === 'agents' ? 'active' : ''}
            onClick={() => setPage('agents')}
          >
            Templates
          </button>
          <button
            className={page === 'settings' ? 'active' : ''}
            onClick={() => setPage('settings')}
          >
            Settings
          </button>
        </nav>
      </aside>
      <main className="main">
        {page === 'dashboard' && <Dashboard />}
        {page === 'agents' && <Agents />}
        {page === 'settings' && <Settings />}
      </main>
    </div>
  )
}
