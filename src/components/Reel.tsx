import type { ReactNode } from 'react'

/**
 * The reel shell (ADR-011): the glass panel that frames a horizontal strip
 * of scene frames between two film-perforation strips. The stages decide
 * what a frame shows; this owns the strip chrome.
 */

export function Perforation() {
  return (
    <div
      aria-hidden="true"
      style={{
        height: '8px',
        margin: '0 var(--space-1)',
        borderRadius: '3px',
        opacity: 0.5,
        backgroundImage:
          'repeating-linear-gradient(90deg, var(--color-border) 0 14px, transparent 14px 40px)',
      }}
    />
  )
}

export function ReelShell({
  hint,
  frameHeight,
  children,
}: {
  hint: string
  /**
   * Height of a SELECTED frame (15.17.4): the strip reserves this much
   * vertically from the start, so selecting a frame grows it into already
   * reserved space instead of resizing the whole panel — nothing outside
   * the reel bops up and down.
   */
  frameHeight?: string
  children: ReactNode
}) {
  return (
    <div
      className="card"
      style={{
        padding: 'var(--space-3) var(--space-4) var(--space-4)',
        marginBottom: 'var(--space-4)',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          padding: '0 var(--space-1) var(--space-2)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-sm)',
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          The reel
        </span>
        <span
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
          }}
        >
          {hint}
        </span>
      </div>
      <Perforation />
      <div
        style={{
          display: 'flex',
          gap: 'var(--space-3)',
          overflowX: 'auto',
          padding: 'var(--space-2) var(--space-1)',
          alignItems: 'flex-end',
          ...(frameHeight !== undefined ? { minHeight: frameHeight } : {}),
        }}
      >
        {children}
      </div>
      <Perforation />
    </div>
  )
}
