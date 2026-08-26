import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n'
import { formatUsd } from '../lib/format'
import { useProjectStore } from '../state/project'
import { useSettingsStore } from '../state/settings'
import type { GenerationKind } from '../domain/types'

const KIND_LABELS: Record<GenerationKind, string> = {
  text: 'Text',
  image: 'Images',
  video: 'Clips',
  audio: 'Narration',
}

/** Fixed order for the composition bar and legend — never re-ranked. */
const KIND_ORDER: GenerationKind[] = ['text', 'audio', 'image', 'video']

/**
 * Series colors for the spend composition bar (15.19). Literal hex, one
 * hue per kind in BOTH modes (color follows the entity); dark mode uses
 * its own gold step. Both sets pass the palette validator (lightness
 * band, chroma floor, CVD separation, normal-vision floor, contrast)
 * against the app's dark and light surfaces — the soft UI pastels
 * failed every check as data colors, so the bar wears the jewel steps.
 */
const SPEND_COLORS: Record<'dark' | 'light', Record<GenerationKind, string>> = {
  dark: {
    text: '#d76487',
    audio: '#a3891f',
    image: '#4187cf',
    video: '#3f9e68',
  },
  light: {
    text: '#d76487',
    audio: '#b99b25',
    image: '#4187cf',
    video: '#3f9e68',
  },
}

/**
 * The navbar spend readout (cost-transparency principle: always visible),
 * now the door to the details too: hovering shows a small per-kind summary,
 * clicking opens the full breakdown as an overlay. Replaces the old
 * always-mounted spend bar above the stages — same numbers, no strip of
 * screen spent on it.
 */
export function SpendMenu() {
  const t = useT()
  const project = useProjectStore((s) => s.project)
  const themeMode = useSettingsStore((s) => s.themeMode)
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)
  // Hover-linking in the breakdown (22.18, Angel's request): pointing at
  // a legend tile or a receipt row lights its segment in the composition
  // bar and dims the rest — the eye finds "where that money sits" in one
  // glance.
  const [highlightKind, setHighlightKind] = useState<GenerationKind | null>(
    null,
  )

  // Escape closes the breakdown overlay.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        setHighlightKind(null)
      }
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

  const colors = SPEND_COLORS[themeMode]
  const presentKinds = KIND_ORDER.filter((k) => (byKind.get(k)?.usd ?? 0) > 0)

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
      <span
        style={{
          color: 'var(--color-text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 'var(--space-2)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: '9px',
            height: '9px',
            borderRadius: 'var(--radius-pill)',
            background: colors[kind],
          }}
        />
        {t(KIND_LABELS[kind])}
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
          {t('Spent')}{' '}
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
              {t('Nothing spent yet in this project.')}
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
                <strong>{t('Total')}</strong>
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
                {t('Click for the full breakdown.')}
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
              setHighlightKind(null)
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
              {/* Ledger head: eyebrow, the headline number, Close. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 'var(--space-4)',
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    {t('Production ledger')}
                  </div>
                  <div
                    style={{
                      marginTop: 'var(--space-1)',
                      fontSize: 'var(--text-xl)',
                      fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {/* Keyed: a new charge ticks the headline like a
                        counter wheel. Keep the literal "Spent $X" text —
                        the e2e contract greps for it. */}
                    <span key={totalUsd} className="tick-in">
                      {t('Spent')} {approx}
                      {formatUsd(totalUsd)}
                    </span>
                  </div>
                  <div
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-sm)',
                      marginTop: '2px',
                    }}
                  >
                    {entries.length}{' '}
                    {entries.length === 1 ? t('generation') : t('generations')}
                    {allActual
                      ? ` · ${t('every cost is the reported actual')}`
                      : ` · ${t('~ marks an estimate until the actual lands')}`}
                  </div>
                </div>
                <button
                  type="button"
                  aria-label="Close spend details"
                  onClick={() => {
                    setOpen(false)
                    setHighlightKind(null)
                  }}
                  style={{
                    fontSize: 'var(--text-sm)',
                    padding: 'var(--space-1) var(--space-3)',
                  }}
                >
                  {t('Close')}
                </button>
              </div>

              {entries.length === 0 ? (
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    margin: 'var(--space-3) 0 0',
                  }}
                >
                  {t('Nothing spent yet in this project.')}
                </p>
              ) : (
                <>
                  {/* Composition bar: where the money went, by kind.
                      Fixed kind order; 2px surface gaps between segments;
                      identity is never color-alone (the legend tiles
                      below carry dot + label + number). */}
                  <div
                    role="img"
                    aria-label={`Spend by kind: ${presentKinds
                      .map(
                        (k) =>
                          `${KIND_LABELS[k]} ${formatUsd(byKind.get(k)?.usd ?? 0)}`,
                      )
                      .join(', ')}`}
                    style={{
                      display: 'flex',
                      gap: '2px',
                      height: '12px',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      margin: 'var(--space-4) 0 0',
                      background: 'var(--color-surface-2)',
                    }}
                  >
                    {presentKinds.map((kind) => {
                      const usd = byKind.get(kind)?.usd ?? 0
                      const share = totalUsd > 0 ? usd / totalUsd : 0
                      return (
                        <div
                          key={kind}
                          title={`${KIND_LABELS[kind]} — ${formatUsd(usd)} (${String(Math.round(share * 100))}%)`}
                          onMouseEnter={() => {
                            setHighlightKind(kind)
                          }}
                          onMouseLeave={() => {
                            setHighlightKind(null)
                          }}
                          style={{
                            width: `${String(share * 100)}%`,
                            minWidth: '6px',
                            background: colors[kind],
                            // Hover-linking (22.18): the pointed-at kind
                            // stays lit, the rest of the bar dims.
                            opacity:
                              highlightKind === null || highlightKind === kind
                                ? 1
                                : 0.2,
                            filter:
                              highlightKind === kind
                                ? 'saturate(1.2) brightness(1.1)'
                                : undefined,
                            transition:
                              'width var(--t-med) var(--ease-film), opacity var(--t-fast) var(--ease-film), filter var(--t-fast) var(--ease-film)',
                          }}
                        />
                      )
                    })}
                  </div>

                  {/* Legend tiles — the bar's key and the per-kind totals. */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns:
                        'repeat(auto-fit, minmax(8.5rem, 1fr))',
                      gap: 'var(--space-2)',
                      margin: 'var(--space-3) 0 0',
                    }}
                  >
                    {presentKinds.map((kind) => {
                      const agg = byKind.get(kind)
                      if (agg === undefined) return null
                      return (
                        <div
                          key={kind}
                          onMouseEnter={() => {
                            setHighlightKind(kind)
                          }}
                          onMouseLeave={() => {
                            setHighlightKind(null)
                          }}
                          style={{
                            border: `1px solid ${highlightKind === kind ? colors[kind] : 'var(--color-border)'}`,
                            borderRadius: 'var(--radius)',
                            padding: 'var(--space-2) var(--space-3)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px',
                            transition:
                              'border-color var(--t-fast) var(--ease-film)',
                          }}
                        >
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 'var(--space-2)',
                              fontSize: 'var(--text-sm)',
                              color: 'var(--color-text-muted)',
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{
                                width: '9px',
                                height: '9px',
                                borderRadius: 'var(--radius-pill)',
                                background: colors[kind],
                              }}
                            />
                            {t(KIND_LABELS[kind])}
                          </span>
                          <span
                            style={{
                              fontWeight: 700,
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {formatUsd(agg.usd)}
                            <span
                              style={{
                                fontWeight: 400,
                                color: 'var(--color-text-muted)',
                                fontSize: 'var(--text-sm)',
                              }}
                            >
                              {' '}
                              · {agg.count}
                            </span>
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* The itemized receipt, newest first — dashed rules and
                      right-aligned tabular figures, like the landing
                      page's sample run, but real. */}
                  <ul
                    style={{
                      listStyle: 'none',
                      padding: 0,
                      margin: 'var(--space-4) 0 0',
                      fontSize: 'var(--text-sm)',
                    }}
                  >
                    {[...entries].reverse().map((entry) => (
                      <li
                        key={entry.id}
                        onMouseEnter={() => {
                          setHighlightKind(entry.kind)
                        }}
                        onMouseLeave={() => {
                          setHighlightKind(null)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-2) 0',
                          borderTop: '1px dashed var(--color-border)',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: '9px',
                            height: '9px',
                            borderRadius: 'var(--radius-pill)',
                            background: colors[entry.kind],
                            flexShrink: 0,
                            alignSelf: 'center',
                          }}
                        />
                        <span style={{ minWidth: 0, flex: 1 }}>
                          <span style={{ color: 'var(--color-text)' }}>
                            {entry.note}
                          </span>{' '}
                          <span style={{ color: 'var(--color-text-muted)' }}>
                            ({entry.model})
                          </span>
                          <span
                            style={{
                              display: 'block',
                              color: 'var(--color-text-muted)',
                              fontSize: '12px',
                            }}
                          >
                            {new Date(entry.at).toLocaleString()} —{' '}
                            {t('estimated')}{' '}
                            {entry.estimatedUsd !== null
                              ? `${t('up to')} ~${formatUsd(entry.estimatedUsd)}`
                              : t('unknown')}
                            , {t('actual')}{' '}
                            {entry.actualUsd !== null
                              ? formatUsd(entry.actualUsd)
                              : t('not reported')}
                          </span>
                        </span>
                        <span
                          style={{
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {entry.actualUsd !== null
                            ? formatUsd(entry.actualUsd)
                            : entry.estimatedUsd !== null
                              ? `~${formatUsd(entry.estimatedUsd)}`
                              : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p
                    style={{
                      margin: 'var(--space-3) 0 0',
                      color: 'var(--color-text-muted)',
                      fontSize: '12px',
                    }}
                  >
                    {t(
                      'Booked the moment a job is submitted — nothing is spent without a stated price first.',
                    )}
                  </p>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </span>
  )
}
