import { useRef, useState } from 'react'
import type { ImageModel } from '../api/nanogpt'
import type { ReferenceAsset, ReferenceKind } from '../domain/types'
import { formatUsd } from '../lib/format'
import { getPerImagePriceUsd, pickPortraitResolution } from '../lib/resolution'
import { useProjectStore } from '../state/project'
import { ConfirmDialog } from './ConfirmDialog'
import { GenerationHistory } from './GenerationHistory'
import { ImageModelPicker } from './ModelPicker'
import { referenceDisplayName } from './referenceDisplay'
import { useBlobUrl } from './useBlobUrl'
import { VersionThumb } from './VersionThumb'

const KIND_LABELS: Record<ReferenceKind, string> = {
  character: 'Character',
  location: 'Location',
  style: 'Art style',
}

/**
 * Project references (Slice 10): characters, locations, and art styles that
 * scenes opt into for cross-scene consistency. Descriptors are injected
 * verbatim into the image prompts of the scenes that tick them.
 */
export function ReferencesPanel() {
  const project = useProjectStore((s) => s.project)
  const addReference = useProjectStore((s) => s.addReference)

  const [model, setModel] = useState<ImageModel | null>(null)
  const [resolution, setResolution] = useState<string | null>(null)

  if (project === null) return null

  const effectiveResolution =
    model === null ? null : (resolution ?? pickPortraitResolution(model))

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-6)',
      }}
    >
      <h4 style={{ marginTop: 0, marginBottom: 'var(--space-1)' }}>
        References
      </h4>
      <p
        style={{
          color: 'var(--color-text-muted)',
          fontSize: 'var(--text-sm)',
          marginTop: 0,
          marginBottom: 'var(--space-3)',
        }}
      >
        Define recurring characters, locations, or art styles once, then tick
        them on the scenes that use them. The description is added word for word
        to those scenes&apos; image prompts, so the same subject looks the same
        across scenes. Describe everything that must stay identical (face, hair,
        clothing, colors); a variant belongs in a separate reference.
      </p>

      {project.references.length > 0 && (
        <>
          <details style={{ marginBottom: 'var(--space-3)' }}>
            <summary
              style={{
                cursor: 'pointer',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-text-muted)',
              }}
            >
              Image model for generating reference images
            </summary>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-2)',
                marginTop: 'var(--space-2)',
              }}
            >
              <ImageModelPicker
                selectedId={model?.id ?? null}
                onSelect={(m) => {
                  setModel(m)
                  setResolution(null)
                }}
              />
              {model !== null && model.resolutions.length > 0 && (
                <label>
                  <span
                    style={{
                      color: 'var(--color-text-muted)',
                      fontSize: 'var(--text-sm)',
                      marginRight: 'var(--space-2)',
                    }}
                  >
                    Resolution
                  </span>
                  <select
                    aria-label="Reference image resolution"
                    value={effectiveResolution ?? ''}
                    onChange={(e) => {
                      setResolution(e.target.value)
                    }}
                  >
                    {model.resolutions.map((r) => (
                      <option key={r} value={r}>
                        {r}
                        {getPerImagePriceUsd(model, r) !== null
                          ? ` — ${formatUsd(getPerImagePriceUsd(model, r) ?? 0)}`
                          : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </details>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {project.references.map((reference) => (
              <ReferenceCard
                key={reference.id}
                reference={reference}
                model={model}
                resolution={effectiveResolution}
              />
            ))}
          </ul>
        </>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
        {(Object.keys(KIND_LABELS) as ReferenceKind[]).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => void addReference(kind)}
          >
            Add {KIND_LABELS[kind].toLowerCase()}
          </button>
        ))}
      </div>
    </div>
  )
}

function ReferenceCard({
  reference,
  model,
  resolution,
}: {
  reference: ReferenceAsset
  model: ImageModel | null
  resolution: string | null
}) {
  const updateReference = useProjectStore((s) => s.updateReference)
  const removeReference = useProjectStore((s) => s.removeReference)
  const flushProject = useProjectStore((s) => s.flushProject)
  const importReferenceImage = useProjectStore((s) => s.importReferenceImage)
  const generateReferenceImage = useProjectStore(
    (s) => s.generateReferenceImage,
  )
  const setActiveReferenceImageVersion = useProjectStore(
    (s) => s.setActiveReferenceImageVersion,
  )
  const status = useProjectStore((s) => s.referenceImageStatus[reference.id])
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayName = referenceDisplayName(reference)
  const activeVersion =
    reference.imageVersions.find(
      (v) => v.id === reference.activeImageVersionId,
    ) ?? null
  const activeUrl = useBlobUrl(activeVersion?.blobPath ?? null)
  const generating = status?.generating === true
  const perImageUsd =
    model === null ? null : getPerImagePriceUsd(model, resolution)

  return (
    <li
      aria-label={`Reference ${displayName}`}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        gap: 'var(--space-4)',
      }}
    >
      <div style={{ width: '6rem', flexShrink: 0 }}>
        {activeUrl !== null ? (
          <img
            src={activeUrl}
            alt={`Reference image for ${displayName}`}
            style={{
              width: '100%',
              aspectRatio: '9 / 16',
              objectFit: 'cover',
              borderRadius: 'var(--radius)',
              display: 'block',
            }}
          />
        ) : (
          <div
            aria-label={`Reference ${displayName} has no image yet`}
            style={{
              width: '100%',
              aspectRatio: '9 / 16',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px dashed var(--color-border)',
              borderRadius: 'var(--radius)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              textAlign: 'center',
              padding: 'var(--space-2)',
            }}
          >
            {generating ? 'Generating…' : 'No image'}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-2)',
            flexWrap: 'wrap',
          }}
        >
          <select
            aria-label={`Reference ${displayName} kind`}
            value={reference.kind}
            onChange={(e) => {
              updateReference(reference.id, {
                kind: e.target.value as ReferenceKind,
              })
            }}
            onBlur={() => void flushProject()}
          >
            {(Object.keys(KIND_LABELS) as ReferenceKind[]).map((kind) => (
              <option key={kind} value={kind}>
                {KIND_LABELS[kind]}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={reference.name}
            placeholder="Name (e.g. Captain Mara)"
            aria-label={`Reference ${displayName} name`}
            onChange={(e) => {
              updateReference(reference.id, { name: e.target.value })
            }}
            onBlur={() => void flushProject()}
            style={{
              flex: 1,
              minWidth: '10rem',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-2)',
            }}
          />
          <button
            type="button"
            aria-label={`Delete reference ${displayName}`}
            onClick={() => {
              setConfirmingDelete(true)
            }}
          >
            Delete
          </button>
        </div>
        <label style={{ display: 'block' }}>
          <span
            style={{
              display: 'block',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Description (added word for word to ticked scenes&apos; prompts)
          </span>
          <textarea
            value={reference.descriptor}
            onChange={(e) => {
              updateReference(reference.id, { descriptor: e.target.value })
            }}
            onBlur={() => void flushProject()}
            placeholder="e.g. a tall woman in her 40s with cropped silver hair, a scar over her left eyebrow, a navy-blue captain's coat with brass buttons"
            aria-label={`Reference ${displayName} description`}
            rows={2}
            style={{
              width: '100%',
              resize: 'vertical',
              background: 'var(--color-surface)',
              color: 'var(--color-text)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius)',
              padding: 'var(--space-2)',
            }}
          />
        </label>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            marginTop: 'var(--space-2)',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            aria-label={`Import an image for ${displayName}`}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file !== undefined) {
                void importReferenceImage(reference.id, file)
              }
              e.target.value = ''
            }}
          />
          <button
            type="button"
            disabled={generating}
            onClick={() => fileInputRef.current?.click()}
          >
            Import image
          </button>
          <button
            type="button"
            disabled={
              model === null ||
              generating ||
              reference.descriptor.trim().length === 0
            }
            onClick={() => {
              if (model !== null) {
                void generateReferenceImage(reference.id, model, resolution)
              }
            }}
          >
            {generating
              ? 'Generating…'
              : reference.imageVersions.length > 0
                ? 'Regenerate from description'
                : 'Generate from description'}
          </button>
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {model === null
              ? 'Pick a model above to generate; importing is free.'
              : perImageUsd === null
                ? 'Cost unknown for this model; importing is free.'
                : `Cost: ${formatUsd(perImageUsd)}; importing is free.`}
          </span>
        </div>
        {status?.error != null && (
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {status.error}
          </p>
        )}

        {reference.imageVersions.length > 1 && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                display: 'block',
                marginBottom: 'var(--space-1)',
              }}
            >
              Versions (click to make active)
            </span>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              {reference.imageVersions.map((version, vIndex) => (
                <VersionThumb
                  key={version.id}
                  blobPath={version.blobPath}
                  label={`Reference ${displayName} version ${String(vIndex + 1)}`}
                  active={version.id === reference.activeImageVersionId}
                  onSelect={() =>
                    void setActiveReferenceImageVersion(
                      reference.id,
                      version.id,
                    )
                  }
                />
              ))}
            </div>
          </div>
        )}

        <GenerationHistory
          versions={reference.imageVersions}
          activeVersionId={reference.activeImageVersionId}
          label={`Reference ${displayName}`}
          onRegenerate={(prompt) => {
            if (model !== null) {
              void generateReferenceImage(
                reference.id,
                model,
                resolution,
                prompt,
              )
            }
          }}
          regenerateDisabled={model === null || generating}
          regenerateDisabledHint={
            model === null
              ? 'Pick the image model in this panel first.'
              : 'Another generation is running.'
          }
          regenerateCostUsd={perImageUsd}
        />
      </div>

      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete ${displayName}?`}
          message="The reference will be removed from every scene that uses it. Any reference images it holds will no longer be used for generation."
          confirmLabel="Delete reference"
          onConfirm={() => {
            setConfirmingDelete(false)
            void removeReference(reference.id)
          }}
          onCancel={() => {
            setConfirmingDelete(false)
          }}
        />
      )}
    </li>
  )
}
