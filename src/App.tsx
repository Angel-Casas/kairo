import { useEffect, useRef, useState } from 'react'
import { ApiKeySettings } from './components/ApiKeySettings'
import { AppBackground } from './components/AppBackground'
import { PalettePicker } from './components/PalettePicker'
import { ProjectList } from './components/ProjectList'
import { ProjectView } from './components/ProjectView'
import { useOnlineStatus } from './components/useOnlineStatus'
import { applyTheme, getTheme } from './domain/themes'
import { formatUsd } from './lib/format'
import { useAppStore } from './state/store'
import { useProjectStore } from './state/project'
import { activeThemeId, useSettingsStore } from './state/settings'

function App() {
  const loaded = useAppStore((s) => s.loaded)
  const init = useAppStore((s) => s.init)
  const selectedProjectId = useAppStore((s) => s.selectedProjectId)
  const projects = useAppStore((s) => s.projects)
  const select = useAppStore((s) => s.select)
  const apiKey = useSettingsStore((s) => s.apiKey)
  const balanceUsd = useSettingsStore((s) => s.balanceUsd)
  const initSettings = useSettingsStore((s) => s.initSettings)
  const themeMode = useSettingsStore((s) => s.themeMode)
  const darkThemeId = useSettingsStore((s) => s.darkThemeId)
  const lightThemeId = useSettingsStore((s) => s.lightThemeId)
  const openProject = useProjectStore((s) => s.project)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const online = useOnlineStatus()

  useEffect(() => {
    void init()
    void initSettings()
  }, [init, initSettings])

  const themeId = activeThemeId({ themeMode, darkThemeId, lightThemeId })
  useEffect(() => {
    const theme = getTheme(themeId)
    if (theme !== null) applyTheme(theme)
  }, [themeId])

  // The settings overlay: Escape closes, and focus moves into it on open so
  // keyboard users land where the click took them.
  useEffect(() => {
    if (!settingsOpen) return
    overlayRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSettingsOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [settingsOpen])

  const selectedProject = projects.find((p) => p.id === selectedProjectId)
  const spendUsd =
    openProject === null
      ? null
      : openProject.costLog.reduce(
          (sum, e) => sum + (e.actualUsd ?? e.estimatedUsd ?? 0),
          0,
        )

  return (
    <>
      <AppBackground />
      <header
        style={{
          padding: 'var(--space-3) var(--space-6)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          position: 'relative',
          gap: 'var(--space-4)',
        }}
      >
        <h1 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>Kairo</h1>

        <div className="nav-middle">
          {apiKey !== null && balanceUsd !== null && (
            <span
              aria-label="NanoGPT balance"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Balance:{' '}
              <strong style={{ color: 'var(--color-text)' }}>
                {formatUsd(balanceUsd)}
              </strong>
            </span>
          )}
          {/* Label deliberately avoids the substring "project spend" so
              getByLabel never collides with CostSummary's "Project spend". */}
          {openProject !== null && spendUsd !== null && (
            <span
              aria-label="Spend in the open project"
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              Spend{' '}
              <strong style={{ color: 'var(--color-text)' }}>
                {formatUsd(spendUsd)}
              </strong>{' '}
              · {openProject.costLog.length}
            </span>
          )}
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          {!online && (
            <span
              role="status"
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius)',
                padding: 'var(--space-1) var(--space-2)',
              }}
            >
              Offline — generation needs a connection; your work is safe here.
            </span>
          )}
          <PalettePicker />
          <button
            type="button"
            aria-label={settingsOpen ? 'Close settings' : 'Settings'}
            onClick={() => {
              setSettingsOpen(!settingsOpen)
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '40px',
              height: '40px',
              padding: 0,
            }}
          >
            {settingsOpen ? (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M6 6 L18 18 M18 6 L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                ></path>
              </svg>
            ) : (
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="3.2"
                  stroke="currentColor"
                  strokeWidth="1.8"
                ></circle>
                <path
                  d="M12 2.8 L13.2 5.6 L16.2 4.9 L16.6 7.9 L19.6 8.6 L18.2 11.3 L20.2 13.6 L17.7 15.3 L18.2 18.3 L15.2 18.4 L14 21.2 L11.5 19.5 L9 21.2 L7.8 18.4 L4.8 18.3 L5.3 15.3 L2.8 13.6 L4.8 11.3 L3.4 8.6 L6.4 7.9 L6.8 4.9 L9.8 5.6 Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                  opacity="0.9"
                ></path>
              </svg>
            )}
          </button>
        </div>
      </header>
      <main
        style={{
          padding: 'var(--space-6) var(--space-8) var(--space-8)',
          maxWidth: '56rem',
          width: '100%',
          margin: '0 auto',
        }}
      >
        {!loaded ? (
          <p style={{ color: 'var(--color-text-muted)' }}>Loading…</p>
        ) : selectedProject !== undefined ? (
          <ProjectView
            projectId={selectedProject.id}
            onBack={() => {
              select(null)
              void init()
            }}
          />
        ) : (
          <>
            {apiKey === null && (
              <p
                className="card"
                style={{
                  padding: 'var(--space-4)',
                  color: 'var(--color-text-muted)',
                }}
              >
                Kairo needs your NanoGPT API key before it can generate
                anything.{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(true)
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

      {settingsOpen && (
        <div
          ref={overlayRef}
          role="dialog"
          aria-modal="true"
          aria-label="Settings"
          tabIndex={-1}
          className="settings-overlay"
        >
          <div
            style={{
              maxWidth: '56rem',
              width: '100%',
              margin: '0 auto',
              padding: 'var(--space-6) var(--space-8) var(--space-8)',
            }}
          >
            <ApiKeySettings />
          </div>
        </div>
      )}
    </>
  )
}

export default App
