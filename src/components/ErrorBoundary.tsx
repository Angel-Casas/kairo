import { Component, type ReactNode } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * Last line of defense: a rendering crash shows a recovery screen instead of
 * a white page. All state lives in IndexedDB/OPFS, so a reload always
 * recovers the user's work.
 */
export class ErrorBoundary extends Component<
  { children: ReactNode },
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  override render(): ReactNode {
    if (!this.state.hasError) return this.props.children
    return (
      <main
        role="alert"
        style={{
          padding: 'var(--space-8)',
          maxWidth: '32rem',
          margin: '0 auto',
          textAlign: 'center',
        }}
      >
        <h1 style={{ fontSize: 'var(--text-xl)' }}>Something went wrong</h1>
        <p style={{ color: 'var(--color-text-muted)' }}>
          Kairo hit an unexpected error. Your projects, images, and clips are
          stored safely on this device — reloading will get you right back.
        </p>
        <button
          type="button"
          onClick={() => {
            window.location.reload()
          }}
        >
          Reload Kairo
        </button>
      </main>
    )
  }
}
