import { useEffect, useState } from 'react'
import { ApiKeySettings } from './components/ApiKeySettings'
import { ProjectList } from './components/ProjectList'
import { formatUsd } from './lib/format'
import { useAppStore } from './state/store'
import { useSettingsStore } from './state/settings'

type View = 'projects' | 'settings'

function App() {
  const loaded = useAppStore((s) => s.loaded)
  const init = useAppStore((s) => s.init)
  const selectedProjectId = useAppStore((s) => s.selectedProjectId)
  const projects = useAppStore((s) => s.projects)
  const select = useAppStore((s) => s.select)
  const apiKey = useSettingsStore((s) => s.apiKey)
  const balanceUsd = useSettingsStore((s) => s.balanceUsd)
  const initSettings = useSettingsStore((s) => s.initSettings)
  const [view, setView] = useState<View>('projects')

  useEffect(() => {
    void init()
    void initSettings()
  }, [init, initSettings])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)

  return (
    <>
      <header
        style={{
          padding: 'var(--space-4) var(--space-6)',
          borderBottom: '1px solid var(--color-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Kairo</h1>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-4)',
          }}
        >
          {apiKey !== null && balanceUsd !== null && (
            <span
              aria-label="NanoGPT balance"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Balance: {formatUsd(balanceUsd)}
            </span>
          )}
          <button
            type="button"
            onClick={() => {
              setView(view === 'settings' ? 'projects' : 'settings')
            }}
          >
            {view === 'settings' ? 'Back to projects' : 'Settings'}
          </button>
        </div>
      </header>
      <main style={{ padding: 'var(--space-8)', maxWidth: '48rem' }}>
        {view === 'settings' ? (
          <ApiKeySettings />
        ) : !loaded ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : selectedProject !== undefined ? (
          <section>
            <button type="button" onClick={() => select(null)}>
              ← All projects
            </button>
            <h2 style={{ fontSize: 'var(--text-lg)' }}>
              {selectedProject.title}
            </h2>
            <p style={{ color: 'var(--color-text-muted)' }}>
              The pipeline (script → scenes → images → animation → export)
              arrives in the next slices.
            </p>
          </section>
        ) : (
          <>
            {apiKey === null && (
              <p
                style={{
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-4)',
                  color: 'var(--color-text-muted)',
                }}
              >
                Kairo needs your NanoGPT API key before it can generate
                anything.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setView('settings')
                  }}
                >
                  Set up your key
                </button>
              </p>
            )}
            <ProjectList />
          </>
        )}
      </main>
    </>
  )
}

export default App
