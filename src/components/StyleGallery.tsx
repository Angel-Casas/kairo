import { useState } from 'react'
import { STYLE_PRESETS } from '../domain/stylePresets'
import { useProjectStore } from '../state/project'

/**
 * Visual style picker (ADR-008): a gallery of preset cards with pregenerated
 * same-subject thumbnails. Cards degrade to name-tiles when a thumbnail is
 * missing (e.g. before scripts/generate-style-thumbnails.mjs has been run).
 */
export function StyleGallery() {
  const project = useProjectStore((s) => s.project)
  const setStylePreset = useProjectStore((s) => s.setStylePreset)

  if (project === null) return null
  const selectedId = project.stylePresetId

  return (
    <div style={{ marginBottom: 'var(--space-6)' }}>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
          margin: '0 0 var(--space-2)',
        }}
      >
        Artistic style (applied to every scene image; fine-tune with the style
        notes on the Scenes stage)
      </p>
      <div
        role="radiogroup"
        aria-label="Artistic style"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(8.5rem, 1fr))',
          gap: 'var(--space-2)',
        }}
      >
        <StyleCard
          key="none"
          name="No preset"
          thumbnail={null}
          selected={selectedId === null}
          onSelect={() => void setStylePreset(null)}
        />
        {STYLE_PRESETS.map((preset) => (
          <StyleCard
            key={preset.id}
            name={preset.name}
            thumbnail={preset.thumbnail}
            selected={selectedId === preset.id}
            onSelect={() => void setStylePreset(preset.id)}
          />
        ))}
      </div>
    </div>
  )
}

function StyleCard({
  name,
  thumbnail,
  selected,
  onSelect,
}: {
  name: string
  thumbnail: string | null
  selected: boolean
  onSelect: () => void
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const showImage = thumbnail !== null && !imageFailed

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-label={`Style: ${name}`}
      onClick={onSelect}
      style={{
        border: selected
          ? '2px solid var(--color-accent)'
          : '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        background: 'var(--color-surface)',
        color: 'var(--color-text)',
        padding: 0,
        cursor: 'pointer',
        overflow: 'hidden',
        textAlign: 'center',
      }}
    >
      {showImage ? (
        <img
          src={thumbnail}
          alt=""
          onError={() => {
            setImageFailed(true)
          }}
          style={{
            width: '100%',
            aspectRatio: '1',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: '100%',
            aspectRatio: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {name}
        </div>
      )}
      <span
        style={{
          display: 'block',
          padding: 'var(--space-1) var(--space-2)',
          fontSize: 'var(--text-sm)',
        }}
      >
        {name}
      </span>
    </button>
  )
}
