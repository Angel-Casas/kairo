import { useState } from 'react'
import { STYLE_PRESETS } from '../domain/stylePresets'
import { useProjectStore } from '../state/project'
import { StyleFromImage } from './StyleFromImage'

/**
 * Visual style picker (ADR-008): a gallery of preset cards with pregenerated
 * same-subject thumbnails. Cards degrade to name-tiles when a thumbnail is
 * missing (e.g. before scripts/generate-style-thumbnails.mjs has been run).
 */
export function StyleGallery() {
  const project = useProjectStore((s) => s.project)
  const setStylePreset = useProjectStore((s) => s.setStylePreset)
  const updateStyleNotes = useProjectStore((s) => s.updateStyleNotes)
  const flushProject = useProjectStore((s) => s.flushProject)

  if (project === null) return null
  const selectedId = project.stylePresetId
  const selectedPreset = STYLE_PRESETS.find((p) => p.id === selectedId) ?? null
  const styleNotes = project.styleNotes.trim()

  return (
    <details
      className="card"
      style={{
        marginBottom: 'var(--space-4)',
        padding: 'var(--space-3) var(--space-4)',
      }}
    >
      {/* The collapsed bar still tells the whole story: which preset is on,
          and whether Scenes-stage style notes are riding along. */}
      <summary style={{ cursor: 'pointer' }}>
        <strong style={{ fontSize: 'var(--text-base)' }}>Artistic style</strong>{' '}
        <span
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          — {selectedPreset !== null ? selectedPreset.name : 'no preset'}
          {styleNotes.length > 0 && (
            <>
              {' '}
              ·{' '}
              <span style={{ color: 'var(--color-accent)' }}>
                style notes ✓
              </span>
            </>
          )}
        </span>
      </summary>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
          margin: 'var(--space-3) 0 var(--space-2)',
        }}
      >
        Applied to every scene image; the preset and the style notes below
        travel together into each prompt.
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
      <div
        style={{
          marginTop: 'var(--space-3)',
          borderTop: '1px solid var(--color-border)',
          paddingTop: 'var(--space-3)',
        }}
      >
        <p style={{ margin: '0 0 var(--space-2)' }}>
          <strong>Style notes</strong>{' '}
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            — added word for word to every image prompt
          </span>
        </p>
        <textarea
          value={project.styleNotes}
          onChange={(e) => {
            updateStyleNotes(e.target.value)
          }}
          onBlur={() => void flushProject()}
          placeholder="e.g. watercolor, warm tones, 1800s naval setting"
          aria-label="Visual style notes"
          rows={2}
          style={{
            width: '100%',
            resize: 'vertical',
            background: 'var(--color-surface-2)',
            color: 'var(--color-text)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            padding: 'var(--space-2)',
          }}
        />
        <StyleFromImage />
      </div>
    </details>
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
