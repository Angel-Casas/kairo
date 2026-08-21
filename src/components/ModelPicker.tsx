import { useEffect, useMemo, useState } from 'react'
import type { ImageModel, TextModel, VideoModel } from '../api/nanogpt'
import { formatUsd } from '../lib/format'
import { useModelsStore } from '../state/models'

/**
 * Filterable model pickers. NanoGPT lists hundreds of models, so a filter
 * box narrows the list; real prices are shown next to each model so the
 * choice is always cost-informed.
 */

interface PickerModel {
  id: string
  name: string
}

function PickerShell<M extends PickerModel>({
  models,
  status,
  selectedId,
  ariaLabel,
  optionLabel,
  onSelect,
  onRetry,
}: {
  models: M[]
  status: 'idle' | 'loading' | 'ready' | 'error'
  selectedId: string | null
  ariaLabel: string
  optionLabel: (model: M) => string
  onSelect: (model: M) => void
  onRetry: () => void
}) {
  const [filter, setFilter] = useState('')

  const filtered = useMemo(() => {
    const query = filter.trim().toLowerCase()
    if (query.length === 0) return models
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(query) ||
        m.id.toLowerCase().includes(query),
    )
  }, [models, filter])

  // Keep the currently selected model choosable even when filtered out.
  const selected = models.find((m) => m.id === selectedId)
  const options =
    selected !== undefined && !filtered.some((m) => m.id === selected.id)
      ? [selected, ...filtered]
      : filtered

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

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-2)',
      }}
    >
      <input
        value={filter}
        onChange={(e) => {
          setFilter(e.target.value)
        }}
        placeholder="Filter models by name…"
        aria-label={`Filter ${ariaLabel.toLowerCase()}s`}
      />
      <select
        aria-label={ariaLabel}
        value={selectedId ?? ''}
        onChange={(e) => {
          const model = models.find((m) => m.id === e.target.value)
          if (model !== undefined) onSelect(model)
        }}
      >
        <option value="" disabled>
          {options.length === 0
            ? 'No models match the filter'
            : `Choose a model… (${String(options.length)} available)`}
        </option>
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {optionLabel(m)}
          </option>
        ))}
      </select>
    </div>
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
      onSelect={onSelect}
      onRetry={() => void load(true)}
    />
  )
}

export function VideoModelPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (model: VideoModel) => void
}) {
  const models = useModelsStore((s) => s.videoModels)
  const status = useModelsStore((s) => s.videoModelsStatus)
  const load = useModelsStore((s) => s.loadVideoModels)

  useEffect(() => {
    void load()
  }, [load])

  // Animation is image-to-video; hide models that can't do it.
  const capable = useMemo(
    () => models.filter((m) => m.supportsImageToVideo),
    [models],
  )

  return (
    <PickerShell
      models={capable}
      status={status}
      selectedId={selectedId}
      ariaLabel="Video model"
      optionLabel={(m) => {
        if (m.priceRangeUsd === null) {
          return `${m.name} — price varies (charged at submission)`
        }
        const { min, max } = m.priceRangeUsd
        return min === max
          ? `${m.name} — ≈${formatUsd(min)} per clip`
          : `${m.name} — ≈${formatUsd(min)}–${formatUsd(max)} per clip (depends on settings)`
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

  return (
    <PickerShell
      models={shown}
      status={status}
      selectedId={selectedId}
      ariaLabel="Image model"
      optionLabel={(m) => {
        const prices = Object.values(m.perImageUsd)
        const i2i = m.supportsImageToImage ? ' — accepts reference images' : ''
        if (prices.length === 0) return `${m.name} — price unlisted${i2i}`
        const min = Math.min(...prices)
        const max = Math.max(...prices)
        return min === max
          ? `${m.name} — ${formatUsd(min)} per image${i2i}`
          : `${m.name} — ${formatUsd(min)}–${formatUsd(max)} per image${i2i}`
      }}
      onSelect={onSelect}
      onRetry={() => void load(true)}
    />
  )
}
