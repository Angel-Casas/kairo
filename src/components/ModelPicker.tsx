import { useEffect, useMemo, useState } from 'react'
import type { TextModel } from '../api/nanogpt'
import { formatUsd } from '../lib/format'
import { useModelsStore } from '../state/models'

/**
 * Reusable text-model picker. NanoGPT lists hundreds of models, so a filter
 * box narrows the list; real per-million-token prices are shown next to each
 * model so the choice is always cost-informed.
 */
export function TextModelPicker({
  selectedId,
  onSelect,
}: {
  selectedId: string | null
  onSelect: (model: TextModel) => void
}) {
  const models = useModelsStore((s) => s.textModels)
  const status = useModelsStore((s) => s.textModelsStatus)
  const load = useModelsStore((s) => s.loadTextModels)
  const [filter, setFilter] = useState('')

  useEffect(() => {
    void load()
  }, [load])

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
        <button type="button" onClick={() => void load(true)}>
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
        aria-label="Filter models"
      />
      <select
        aria-label="Text model"
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
            {m.name}
            {m.promptPricePerMTok !== null && m.completionPricePerMTok !== null
              ? ` — ${formatUsd(m.promptPricePerMTok)} in / ${formatUsd(m.completionPricePerMTok)} out per MTok`
              : ' — price unlisted'}
          </option>
        ))}
      </select>
    </div>
  )
}
