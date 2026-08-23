import { useEffect, useRef, useState } from 'react'
import { ApiKeySettings } from './components/ApiKeySettings'
import { AppBackground } from './components/AppBackground'
import { MotionSettings } from './components/MotionSettings'
import { PalettePicker } from './components/PalettePicker'
import { ProjectList } from './components/ProjectList'
import { ProjectView } from './components/ProjectView'
import { SpendMenu } from './components/SpendMenu'
import { useOnlineStatus } from './components/useOnlineStatus'
import { applyTheme, getTheme } from './domain/themes'
import { formatUsd } from './lib/format'
import { useAppStore } from './state/store'
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
  const motionMode = useSettingsStore((s) => s.motionMode)
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

  // The motion preference rides a root data attribute the CSS guards on:
  // 'on' overrides the OS reduced-motion request, 'off' forces stillness.
  useEffect(() => {
    if (motionMode === 'system') {
      delete document.documentElement.dataset.motion
    } else {
      document.documentElement.dataset.motion = motionMode
    }
  }, [motionMode])

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

  return (
    <>
      <AppBackground />
      {/* Padding lives in the stylesheet (15.18): media queries tighten
          it on small screens, and inline padding would override them. */}
      <header
        style={{
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
                {/* Keyed: a refreshed balance ticks in like a counter. */}
                <span key={balanceUsd} className="tick-in">
                  {formatUsd(balanceUsd)}
                </span>
              </strong>
            </span>
          )}
          {/* Label deliberately avoids the substring "project spend" so
              getByLabel never collides with the breakdown overlay's
              "Project spend" dialog. */}
          <SpendMenu />
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
            className="nav-icon"
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
            {/* The gear spins a half turn and cross-fades into an X when
                settings open, and spins back on close (15.17.8). Both
                glyphs share one grid cell; the wrapper does the turning. */}
            <span
              aria-hidden="true"
              style={{
                display: 'grid',
                width: '18px',
                height: '18px',
                transform: settingsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform var(--t-slow) var(--ease-film)',
              }}
            >
              <span
                style={{
                  gridArea: '1 / 1',
                  display: 'inline-flex',
                  opacity: settingsOpen ? 0 : 1,
                  transition: 'opacity var(--t-med) var(--ease-film)',
                }}
              >
                {/* A cleaner cog: eight rounded teeth around a ring. */}
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <g fill="currentColor">
                    {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
                      <rect
                        key={deg}
                        x="10.7"
                        y="2"
                        width="2.6"
                        height="5"
                        rx="1.3"
                        transform={`rotate(${String(deg)} 12 12)`}
                      />
                    ))}
                  </g>
                  <circle
                    cx="12"
                    cy="12"
                    r="6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.4"
                  />
                  <circle cx="12" cy="12" r="1.7" fill="currentColor" />
                </svg>
              </span>
              <span
                style={{
                  gridArea: '1 / 1',
                  display: 'inline-flex',
                  opacity: settingsOpen ? 1 : 0,
                  transition: 'opacity var(--t-med) var(--ease-film)',
                }}
              >
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
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
            </span>
          </button>
        </div>
      </header>
      <main>
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
            <MotionSettings />
          </div>
        </div>
      )}
    </>
  )
}

export default App
