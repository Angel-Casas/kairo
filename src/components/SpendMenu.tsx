import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatUsd } from '../lib/format'
import { useProjectStore } from '../state/project'
import type { GenerationKind } from '../domain/types'

const KIND_LABELS: Record<GenerationKind, string> = {
  text: 'Text',
  image: 'Images',
  video: 'Clips',
  audio: 'Narration',
}

/**
 * The navbar spend readout (cost-transparency principle: always visible),
 * now the door to the details too: hovering shows a small per-kind summary,
 * clicking opens the full breakdown as an overlay. Replaces the old
 * always-mounted spend bar above the stages — same numbers, no strip of
 * screen spent on it.
 */
export function SpendMenu() {
  const project = useProjectStore((s) => s.project)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  // Escape closes the breakdown overlay.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (project === null) return null
  const entries = project.costLog
  const totalUsd = entries.reduce(
    (sum, e) => sum + (e.actualUsd ?? e.estimatedUsd ?? 0),
    0,
  )
  const allActual = entries.every((e) => e.actualUsd !== null)
  const approx = allActual ? '' : '~'

  const byKind = new Map<GenerationKind, { usd: number; count: number }>()
  for (const entry of entries) {
    const agg = byKind.get(entry.kind) ?? { usd: 0, count: 0 }
    agg.usd += entry.actualUsd ?? entry.estimatedUsd ?? 0
    agg.count += 1
    byKind.set(entry.kind, agg)
  }

  const kindRows = [...byKind.entries()].map(([kind, agg]) => (
    <div
      key={kind}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 'var(--space-4)',
        padding: 'var(--space-1) 0',
      }}
    >
      <span style={{ color: 'var(--color-text-muted)' }}>
        {KIND_LABELS[kind]}
      </span>
      <span>
        {formatUsd(agg.usd)} · {agg.count}
      </span>
    </div>
  ))

  return (
    <span
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => {
        setHovered(true)
      }}
      onMouseLeave={() => {
        setHovered(false)
      }}
    >
      <button
        type="button"
        aria-label="Spent in the open project"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true)
          setHovered(false)
        }}
        style={{
          background: 'none',
          border: 'none',
          boxShadow: 'none',
          padding: 0,
          font: 'inherit',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: '0.35em',
        }}
      >
        <span>
          Spent{' '}
          <strong style={{ color: 'var(--color-text)' }}>
            {/* Keyed by value: each change re-runs the counter-wheel tick. */}
            <span key={totalUsd} className="tick-in">
              {formatUsd(totalUsd)}
            </span>
          </strong>{' '}
          · {entries.length}
        </span>
        <svg
          width="9"
          height="6"
          viewBox="0 0 9 6"
          aria-hidden="true"
          style={{ opacity: 0.8 }}
        >
          <path
            d="M1 1.2 L4.5 4.8 L8 1.2"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {hovered && !open && (
        <div
          aria-label="Spend summary"
          style={{
            position: 'absolute',
            top: 'calc(100% + var(--space-2))',
            left: '50%',
            transform: 'translateX(-50%)',
            minWidth: '15rem',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-card)',
            padding: 'var(--space-3) var(--space-4)',
            fontSize: 'var(--text-sm)',
            textAlign: 'left',
            cursor: 'default',
            zIndex: 11,
          }}
        >
          {entries.length === 0 ? (
            <span style={{ color: 'var(--color-text-muted)' }}>
              Nothing spent yet in this project.
            </span>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                  padding: 'var(--space-1) 0',
                  borderBottom: '1px solid var(--color-border)',
                  marginBottom: 'var(--space-1)',
                }}
              >
                <strong>Total</strong>
                <strong>
                  {approx}
                  {formatUsd(totalUsd)} · {entries.length}
                </strong>
              </div>
              {kindRows}
              <div
                style={{
                  color: 'var(--color-text-muted)',
                  marginTop: 'var(--space-2)',
                }}
              >
                Click for the full breakdown.
              </div>
            </>
          )}
        </div>
      )}

      {/* Portaled to <body>: the navbar centers itself with a transform,
          and a transformed ancestor would trap position:fixed inside it. */}
      {open &&
        createPortal(
          <div
            className="motion-veil"
            onClick={() => {
              setOpen(false)
            }}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 12,
              background: 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'center',
              padding: 'var(--space-8) var(--space-4)',
              cursor: 'zoom-out',
              textAlign: 'left',
            }}
          >
            <div
              className="motion-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Project spend"
              onClick={(e) => {
                e.stopPropagation()
              }}
              style={{
                width: 'min(46rem, 94vw)',
                maxHeight: '82vh',
                overflowY: 'auto',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-card)',
                // Real tokens only: this once said var(--space-5), which
                // does not exist in the scale (…4, 6, 8) — an undefined
                // var() silently drops the WHOLE padding declaration, and
                // the card shipped with its content on the edges.
                padding: 'var(--space-6)',
                cursor: 'default',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                }}
              >
                <span>
                  <strong>
                    Spent {approx}
                    {formatUsd(totalUsd)}
                  </strong>{' '}
                  <span
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    ({entries.length}{' '}
                    {entries.length === 1 ? 'generation' : 'generations'})
                  </span>
                </span>
                <button
                  type="button"
                  aria-label="Close spend details"
                  onClick={() => {
                    setOpen(false)
                  }}
                  style={{
                    fontSize: 'var(--text-sm)',
                    padding: 'var(--space-1) var(--space-3)',
                  }}
                >
                  Close
                </button>
              </div>
              {entries.length === 0 ? (
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    margin: 'var(--space-3) 0 0',
                  }}
                >
                  Nothing spent yet in this project.
                </p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 'var(--space-3) 0 0',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {[...entries].reverse().map((entry) => (
                    <li
                      key={entry.id}
                      style={{
                        color: 'var(--color-text-muted)',
                        padding: 'var(--space-2) 0',
                        borderTop: '1px solid var(--color-border)',
                      }}
                    >
                      {new Date(entry.at).toLocaleString()} — {entry.note} (
                      {entry.model}) — estimated{' '}
                      {entry.estimatedUsd !== null
                        ? `up to ~${formatUsd(entry.estimatedUsd)}`
                        : 'unknown'}
                      , actual{' '}
                      {entry.actualUsd !== null
                        ? formatUsd(entry.actualUsd)
                        : 'not reported'}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}
