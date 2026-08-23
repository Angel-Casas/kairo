import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type {
  ImageModel,
  TextModel,
  TtsModel,
  VideoModel,
} from '../api/nanogpt'
import { formatUsd } from '../lib/format'
import {
  formatReleaseMonth,
  MENU_SORTS,
  providerInfo,
  providerOf,
  sortMenuModels,
  type MenuSort,
} from '../lib/modelMenu'
import { useModelsStore } from '../state/models'

/**
 * The model menu (Slice 15.8, modeled on NanoGPT's own picker at Angel's
 * request): the trigger looks like a select, but opens a searchable overlay
 * with the full catalog — grouped by provider with counts, price and
 * release-date badges on every row, and a Filters & Sort rail (provider
 * filter; provider / name / cheapest / priciest / newest / oldest orders).
 * Real prices stay on every row so the choice is always cost-informed.
 */

interface PickerModel {
  id: string
  name: string
  releasedAt: string | null
}

function PickerShell<M extends PickerModel>({
  models,
  status,
  selectedId,
  ariaLabel,
  optionLabel,
  priceBadge,
  priceSortUsd,
  detail,
  onSelect,
  onRetry,
}: {
  models: M[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  selectedId: string | null
  ariaLabel: string
  /** Full accessible/detail line, e.g. "Mock Writer — $2 in / $10 out…". */
  optionLabel: (model: M) => string
  /** Compact badge for the row's right edge, e.g. "$2/$10". */
  priceBadge: (model: M) => string
  priceSortUsd: (model: M) => number | null
  /** Optional second line per row (e.g. the model's own description). */
  detail?: (model: M) => string
  onSelect: (model: M) => void
  onRetry: () => void
}) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<MenuSort>('provider')
  const [provider, setProvider] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement | null>(null)

  // Escape closes; the search box takes focus on open.
  useEffect(() => {
    if (!open) return
    searchRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const enriched = useMemo(
    () =>
      models.map((m) => ({
        model: m,
        provider: providerOf(m.id, m.name),
        priceSortUsd: priceSortUsd(m),
        name: m.name,
        releasedAt: m.releasedAt,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- accessors are stable per picker
    [models],
  )

  const providerCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const e of enriched) {
      counts.set(e.provider, (counts.get(e.provider) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [enriched])

  const shown = useMemo(() => {
    const query = filter.trim().toLowerCase()
    const filtered = enriched.filter(
      (e) =>
        (provider === null || e.provider === provider) &&
        (query.length === 0 ||
          e.model.name.toLowerCase().includes(query) ||
          e.model.id.toLowerCase().includes(query)),
    )
    return sortMenuModels(filtered, sort)
  }, [enriched, filter, provider, sort])

  const selected = models.find((m) => m.id === selectedId)

  if (status === 'loading' || status === 'idle') {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading models…</p>
  }
  if (status === 'error') {
    return (
      <p role="alert" style={{ color: 'var(--color-danger)' }}>
        Could not load the model list.{' '}
        <button type="button" onClick={onRetry}>
          Retry
        </button>
      </p>
    )
  }

  const sectionTitle: CSSProperties = {
    fontSize: '11px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
    margin: '0 0 var(--space-2)',
  }

  // Group headers only make sense in provider order.
  let lastProvider: string | null = null

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setOpen(true)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 'var(--space-2)',
          width: '100%',
          textAlign: 'left',
          fontWeight: 400,
        }}
      >
        <span
          style={{
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color:
              selected === undefined ? 'var(--color-text-muted)' : undefined,
          }}
        >
          {selected !== undefined
            ? optionLabel(selected)
            : `Choose a model… (${String(models.length)} available)`}
        </span>
        <svg
          width="9"
          height="6"
          viewBox="0 0 9 6"
          aria-hidden="true"
          style={{ flexShrink: 0, opacity: 0.8 }}
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
              padding: 'var(--space-6) var(--space-4)',
              cursor: 'zoom-out',
            }}
          >
            <div
              className="motion-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={`${ariaLabel} menu`}
              onClick={(e) => {
                e.stopPropagation()
              }}
              style={{
                width: 'min(62rem, 96vw)',
                maxHeight: '86vh',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-card)',
                overflow: 'hidden',
                cursor: 'default',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 15rem',
                  minHeight: 0,
                }}
              >
                {/* Left: search + list */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    minWidth: 0,
                    minHeight: 0,
                  }}
                >
                  <div
                    style={{
                      padding: 'var(--space-3) var(--space-4)',
                      borderBottom: '1px solid var(--color-border)',
                    }}
                  >
                    <input
                      ref={searchRef}
                      value={filter}
                      onChange={(e) => {
                        setFilter(e.target.value)
                      }}
                      placeholder="Search models…"
                      aria-label={`Filter ${ariaLabel.toLowerCase()}s`}
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div
                    role="listbox"
                    aria-label={`${ariaLabel} options`}
                    style={{
                      overflowY: 'auto',
                      minHeight: '18rem',
                      maxHeight: '62vh',
                      padding: 'var(--space-2) var(--space-3)',
                    }}
                  >
                    {shown.length === 0 && (
                      <p
                        style={{
                          color: 'var(--color-text-muted)',
                          padding: 'var(--space-3)',
                        }}
                      >
                        No models match.
                      </p>
                    )}
                    {shown.map((e) => {
                      const info = providerInfo(e.provider)
                      const header =
                        sort === 'provider' && e.provider !== lastProvider
                      lastProvider = e.provider
                      return (
                        <div key={e.model.id}>
                          {header && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 'var(--space-2)',
                                padding:
                                  'var(--space-3) var(--space-2) var(--space-1)',
                                fontSize: '11px',
                                letterSpacing: '0.14em',
                                textTransform: 'uppercase',
                                color: 'var(--color-text-muted)',
                              }}
                            >
                              <span
                                aria-hidden="true"
                                style={{ color: info.color }}
                              >
                                {info.glyph}
                              </span>
                              {e.provider}
                              <span style={{ opacity: 0.7 }}>
                                {
                                  providerCounts.find(
                                    ([name]) => name === e.provider,
                                  )?.[1]
                                }
                              </span>
                            </div>
                          )}
                          <button
                            type="button"
                            role="option"
                            aria-selected={e.model.id === selectedId}
                            title={optionLabel(e.model)}
                            onClick={() => {
                              onSelect(e.model)
                              setOpen(false)
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 'var(--space-3)',
                              width: '100%',
                              textAlign: 'left',
                              background:
                                e.model.id === selectedId
                                  ? 'var(--color-accent-soft)'
                                  : 'transparent',
                              border:
                                e.model.id === selectedId
                                  ? '1px solid var(--color-accent)'
                                  : '1px solid transparent',
                              boxShadow: 'none',
                              padding: 'var(--space-2) var(--space-3)',
                              fontWeight: 400,
                            }}
                          >
                            <span
                              aria-hidden="true"
                              style={{ color: info.color, flexShrink: 0 }}
                            >
                              {info.glyph}
                            </span>
                            <span style={{ minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  display: 'block',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {e.model.name}
                              </span>
                              <span
                                style={{
                                  display: 'flex',
                                  gap: 'var(--space-2)',
                                  fontSize: 'var(--text-sm)',
                                  color: 'var(--color-text-muted)',
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                <span
                                  style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {e.model.id}
                                </span>
                                {e.model.releasedAt !== null && (
                                  <span style={{ flexShrink: 0 }}>
                                    {formatReleaseMonth(e.model.releasedAt)}
                                  </span>
                                )}
                              </span>
                              {detail !== undefined &&
                                detail(e.model).length > 0 && (
                                  <span
                                    style={{
                                      display: '-webkit-box',
                                      WebkitLineClamp: 2,
                                      WebkitBoxOrient: 'vertical',
                                      overflow: 'hidden',
                                      whiteSpace: 'normal',
                                      fontSize: 'var(--text-sm)',
                                      color: 'var(--color-text-muted)',
                                      opacity: 0.85,
                                    }}
                                  >
                                    {detail(e.model)}
                                  </span>
                                )}
                            </span>
                            <span
                              style={{
                                flexShrink: 0,
                                fontSize: 'var(--text-sm)',
                                fontVariantNumeric: 'tabular-nums',
                                color: 'var(--color-text)',
                              }}
                            >
                              {priceBadge(e.model)}
                            </span>
                          </button>
                        </div>
                      )
                    })}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: 'var(--space-2) var(--space-4)',
                      borderTop: '1px solid var(--color-border)',
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-text-muted)',
                    }}
                  >
                    <span>
                      {shown.length} of {models.length}{' '}
                      {models.length === 1 ? 'model' : 'models'}
                    </span>
                    <button
                      type="button"
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
                </div>

                {/* Right: Filters & Sort */}
                <div
                  style={{
                    borderLeft: '1px solid var(--color-border)',
                    padding: 'var(--space-4)',
                    overflowY: 'auto',
                    minHeight: 0,
                  }}
                >
                  <p style={sectionTitle}>Sort by</p>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                      marginBottom: 'var(--space-4)',
                    }}
                  >
                    {MENU_SORTS.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        aria-pressed={sort === s.id}
                        onClick={() => {
                          setSort(s.id)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          textAlign: 'left',
                          fontSize: 'var(--text-sm)',
                          padding: 'var(--space-1) var(--space-3)',
                          fontWeight: sort === s.id ? 700 : 400,
                          border:
                            sort === s.id
                              ? '1px solid var(--color-accent)'
                              : '1px solid transparent',
                          background:
                            sort === s.id
                              ? 'var(--color-accent-soft)'
                              : 'transparent',
                          boxShadow: 'none',
                        }}
                      >
                        <span
                          aria-hidden="true"
                          style={{
                            width: '1.6em',
                            opacity: 0.8,
                            fontSize: '11px',
                          }}
                        >
                          {s.icon}
                        </span>
                        {s.label}
                      </button>
                    ))}
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      justifyContent: 'space-between',
                    }}
                  >
                    <p style={sectionTitle}>Providers</p>
                    {provider !== null && (
                      <button
                        type="button"
                        onClick={() => {
                          setProvider(null)
                        }}
                        style={{
                          fontSize: 'var(--text-sm)',
                          padding: '0 var(--space-2)',
                        }}
                      >
                        All
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 'var(--space-1)',
                    }}
                  >
                    {providerCounts.map(([name, count]) => {
                      const info = providerInfo(name)
                      const active = provider === name
                      return (
                        <button
                          key={name}
                          type="button"
                          aria-pressed={active}
                          onClick={() => {
                            setProvider(active ? null : name)
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--space-2)',
                            textAlign: 'left',
                            fontSize: 'var(--text-sm)',
                            padding: 'var(--space-1) var(--space-3)',
                            fontWeight: active ? 700 : 400,
                            border: active
                              ? '1px solid var(--color-accent)'
                              : '1px solid transparent',
                            background: active
                              ? 'var(--color-accent-soft)'
                              : 'transparent',
                            boxShadow: 'none',
                          }}
                        >
                          <span
                            aria-hidden="true"
                            style={{ color: info.color }}
                          >
                            {info.glyph}
                          </span>
                          <span style={{ flex: 1 }}>{name}</span>
                          <span
                            style={{
                              color: 'var(--color-text-muted)',
                              fontVariantNumeric: 'tabular-nums',
                            }}
                          >
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

export function TextModelPicker({
  selectedId,
  onSelect,
  onlyVision = false,
  ariaLabel = 'Text model',
}: {
  selectedId: string | null
  onSelect: (model: TextModel) => void
  /** Show only models that accept image inputs (Slice 12). */
  onlyVision?: boolean
  /** Override when two pickers share a page (labels must stay unique). */
  ariaLabel?: string
}) {
  const models = useModelsStore((s) => s.textModels)
  const status = useModelsStore((s) => s.textModelsStatus)
  const load = useModelsStore((s) => s.loadTextModels)

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(
    () => (onlyVision ? models.filter((m) => m.supportsVision) : models),
    [models, onlyVision],
  )

  return (
    <PickerShell
      models={shown}
      status={status}
      selectedId={selectedId}
      ariaLabel={ariaLabel}
      optionLabel={(m) =>
        m.promptPricePerMTok !== null && m.completionPricePerMTok !== null
          ? `${m.name} — ${formatUsd(m.promptPricePerMTok)} in / ${formatUsd(m.completionPricePerMTok)} out per MTok`
          : `${m.name} — price unlisted`
      }
      priceBadge={(m) =>
        m.promptPricePerMTok !== null && m.completionPricePerMTok !== null
          ? `${formatUsd(m.promptPricePerMTok)}/${formatUsd(m.completionPricePerMTok)}`
          : '—'
      }
      priceSortUsd={(m) => m.completionPricePerMTok ?? m.promptPricePerMTok}
      onSelect={onSelect}
      onRetry={() => void load(true)}
    />
  )
}

export function VideoModelPicker({
  selectedId,
  onSelect,
  onlyLipSync = false,
  ariaLabel = 'Video model',
}: {
  selectedId: string | null
  onSelect: (model: VideoModel) => void
  /** Show only models that can lip-sync provided audio (Slice 15.16). */
  onlyLipSync?: boolean
  /** Override when two pickers share a page (labels must stay unique). */
  ariaLabel?: string
}) {
  const models = useModelsStore((s) => s.videoModels)
  const status = useModelsStore((s) => s.videoModelsStatus)
  const load = useModelsStore((s) => s.loadVideoModels)

  useEffect(() => {
    void load()
  }, [load])

  // Animation is image-to-video; hide models that can't do it.
  const capable = useMemo(
    () =>
      models.filter((m) =>
        onlyLipSync ? m.lipSync !== null : m.supportsImageToVideo,
      ),
    [models, onlyLipSync],
  )

  return (
    <PickerShell
      models={capable}
      status={status}
      selectedId={selectedId}
      ariaLabel={ariaLabel}
      optionLabel={(m) => {
        // Lip-sync rates are PER SECOND of narration, not per clip.
        if (onlyLipSync && m.lipSync !== null) {
          const rates = Object.values(m.lipSync.perSecondUsd)
          if (rates.length === 0) {
            return `${m.name} — price varies (charged at submission)`
          }
          const min = Math.min(...rates)
          const max = Math.max(...rates)
          return min === max
            ? `${m.name} — ${formatUsd(min)} per second`
            : `${m.name} — ${formatUsd(min)}–${formatUsd(max)} per second (by resolution)`
        }
        if (m.priceRangeUsd === null) {
          return `${m.name} — price varies (charged at submission)`
        }
        const { min, max } = m.priceRangeUsd
        return min === max
          ? `${m.name} — ≈${formatUsd(min)} per clip`
          : `${m.name} — ≈${formatUsd(min)}–${formatUsd(max)} per clip (depends on settings)`
      }}
      priceBadge={(m) => {
        if (onlyLipSync && m.lipSync !== null) {
          const rates = Object.values(m.lipSync.perSecondUsd)
          if (rates.length === 0) return 'varies'
          const min = Math.min(...rates)
          const max = Math.max(...rates)
          return min === max
            ? `${formatUsd(min)}/s`
            : `${formatUsd(min)}–${formatUsd(max)}/s`
        }
        if (m.priceRangeUsd === null) return 'varies'
        const { min, max } = m.priceRangeUsd
        return min === max
          ? `≈${formatUsd(min)}`
          : `≈${formatUsd(min)}–${formatUsd(max)}`
      }}
      priceSortUsd={(m) => m.priceRangeUsd?.min ?? null}
      // In lip-sync mode the models differ WILDLY in what they do with
      // the audio (true lip-sync vs music-cut montages) — show each
      // model's own description so the choice is informed (15.16.1).
      detail={onlyLipSync ? (m) => m.description : undefined}
      onSelect={onSelect}
      onRetry={() => void load(true)}
    />
  )
}

export function TtsModelPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (model: TtsModel) => void
}) {
  const models = useModelsStore((s) => s.ttsModels)
  const status = useModelsStore((s) => s.ttsModelsStatus)
  const load = useModelsStore((s) => s.loadTtsModels)

  useEffect(() => {
    void load()
  }, [load])

  const price = (m: TtsModel): string | null => {
    if (m.pricing === null) return null
    switch (m.pricing.kind) {
      case 'perKChars':
        return `${formatUsd(m.pricing.usdPerKChars)} per 1k chars`
      case 'perCharBlock':
        return `${formatUsd(m.pricing.usdPerBlock)} per ${String(m.pricing.blockChars)} chars`
      case 'perGeneration':
        return `${formatUsd(m.pricing.usd)} per narration`
    }
  }

  return (
    <PickerShell
      models={models}
      status={status}
      selectedId={selectedId}
      ariaLabel="Narration model"
      optionLabel={(m) => {
        const p = price(m)
        const v =
          m.voices.length > 0 ? ` · ${String(m.voices.length)} voices` : ''
        return p === null
          ? `${m.name} — price varies (charged at submission)${v}`
          : `${m.name} — ${p}${v}`
      }}
      priceBadge={(m) => {
        if (m.pricing === null) return 'varies'
        switch (m.pricing.kind) {
          case 'perKChars':
            return `${formatUsd(m.pricing.usdPerKChars)}/1k`
          case 'perCharBlock':
            return `${formatUsd(m.pricing.usdPerBlock)}/${String(m.pricing.blockChars)} ch`
          case 'perGeneration':
            return `${formatUsd(m.pricing.usd)}/gen`
        }
      }}
      priceSortUsd={(m) => {
        // Normalize to a per-1k-chars rate so Cheapest/Priciest compare fairly.
        if (m.pricing === null) return null
        switch (m.pricing.kind) {
          case 'perKChars':
            return m.pricing.usdPerKChars
          case 'perCharBlock':
            return (m.pricing.usdPerBlock / m.pricing.blockChars) * 1000
          case 'perGeneration':
            return m.pricing.usd
        }
      }}
      onSelect={onSelect}
      onRetry={() => void load(true)}
    />
  )
}

export function ImageModelPicker({
  selectedId,
  onSelect,
  onlyImageToImage = false,
}: {
  selectedId: string | null
  onSelect: (model: ImageModel) => void
  /** Show only models that accept reference images (Slice 10). */
  onlyImageToImage?: boolean
}) {
  const models = useModelsStore((s) => s.imageModels)
  const status = useModelsStore((s) => s.imageModelsStatus)
  const load = useModelsStore((s) => s.loadImageModels)

  useEffect(() => {
    void load()
  }, [load])

  const shown = useMemo(
    () =>
      onlyImageToImage ? models.filter((m) => m.supportsImageToImage) : models,
    [models, onlyImageToImage],
  )

  const range = (m: ImageModel) => {
    const prices = Object.values(m.perImageUsd)
    if (prices.length === 0) return null
    return { min: Math.min(...prices), max: Math.max(...prices) }
  }

  return (
    <PickerShell
      models={shown}
      status={status}
      selectedId={selectedId}
      ariaLabel="Image model"
      optionLabel={(m) => {
        const r = range(m)
        const i2i = m.supportsImageToImage ? ' — accepts reference images' : ''
        if (r === null) return `${m.name} — price unlisted${i2i}`
        return r.min === r.max
          ? `${m.name} — ${formatUsd(r.min)} per image${i2i}`
          : `${m.name} — ${formatUsd(r.min)}–${formatUsd(r.max)} per image${i2i}`
      }}
      priceBadge={(m) => {
        const r = range(m)
        if (r === null) return '—'
        return r.min === r.max
          ? `${formatUsd(r.min)}/img`
          : `${formatUsd(r.min)}–${formatUsd(r.max)}`
      }}
      priceSortUsd={(m) => range(m)?.min ?? null}
      onSelect={onSelect}
      onRetry={() => void load(true)}
    />
  )
}
