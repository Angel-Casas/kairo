import { useEffect } from 'react'
import type { TextModel } from '../api/nanogpt'
import { formatUsd } from '../lib/format'
import { useModelsStore } from '../state/models'

/**
 * Reusable text-model picker. Shows real per-million-token prices next to
 * each model so the choice is always cost-informed.
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

  useEffect(() => {
    void load()
  }, [load])

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
    <select
      aria-label="Text model"
      value={selectedId ?? ''}
      onChange={(e) => {
        const model = models.find((m) => m.id === e.target.value)
        if (model !== undefined) onSelect(model)
      }}
    >
      <option value="" disabled>
        Choose a model…
      </option>
      {models.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name}
          {m.promptPricePerMTok !== null && m.completionPricePerMTok !== null
            ? ` — ${formatUsd(m.promptPricePerMTok)} in / ${formatUsd(m.completionPricePerMTok)} out per MTok`
            : ' — price unlisted'}
        </option>
      ))}
    </select>
  )
}
