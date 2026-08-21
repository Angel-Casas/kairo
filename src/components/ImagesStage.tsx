import { useState } from 'react'
import type { ImageModel } from '../api/nanogpt'
import type { Scene } from '../domain/types'
import { formatUsd } from '../lib/format'
import { getPerImagePriceUsd, pickPortraitResolution } from '../lib/resolution'
import { useProjectStore } from '../state/project'
import { GenerationHistory } from './GenerationHistory'
import { ImageModelPicker } from './ModelPicker'
import { StyleGallery } from './StyleGallery'
import { useBlobUrl } from './useBlobUrl'
import { VersionThumb } from './VersionThumb'

export function ImagesStage() {
  const project = useProjectStore((s) => s.project)
  const generateAllImages = useProjectStore((s) => s.generateAllImages)
  const allImagesProgress = useProjectStore((s) => s.allImagesProgress)

  const [model, setModel] = useState<ImageModel | null>(null)
  const [resolution, setResolution] = useState<string | null>(null)
  const [onlyImageToImage, setOnlyImageToImage] = useState(false)

  if (project === null) return null
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order)
  const hasReferenceImages = project.references.some(
    (r) => r.activeImageVersionId !== null,
  )

  const effectiveResolution =
    model === null ? null : (resolution ?? pickPortraitResolution(model))
  const perImageUsd =
    model === null ? null : getPerImagePriceUsd(model, effectiveResolution)

  const missingCount = scenes.filter(
    (s) =>
      s.imageVersions.length === 0 && s.visualDescription.trim().length > 0,
  ).length
  const allEstimate = perImageUsd === null ? null : perImageUsd * missingCount

  return (
    <section>
      <h3 style={{ fontSize: 'var(--text-lg)', marginTop: 0 }}>Images</h3>

      <StyleGallery />

      <div
        className="card"
        style={{
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <h4 style={{ margin: 0 }}>Image model</h4>
        {hasReferenceImages && (
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
            }}
          >
            <input
              type="checkbox"
              checked={onlyImageToImage}
              onChange={(e) => {
                setOnlyImageToImage(e.target.checked)
              }}
            />
            Only show models that can use reference images
          </label>
        )}
        <ImageModelPicker
          selectedId={model?.id ?? null}
          onlyImageToImage={onlyImageToImage}
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
              aria-label="Resolution"
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
        {missingCount > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-4)',
            }}
          >
            <button
              type="button"
              className="primary"
              disabled={model === null || allImagesProgress !== null}
              onClick={() => {
                if (model !== null) {
                  void generateAllImages(model, effectiveResolution)
                }
              }}
            >
              {allImagesProgress !== null
                ? `Generating ${String(allImagesProgress.done)}/${String(allImagesProgress.total)}…`
                : `Generate ${String(missingCount)} missing ${missingCount === 1 ? 'image' : 'images'}`}
            </button>
            <span
              aria-label="Estimated total cost"
              style={{ color: 'var(--color-text-muted)' }}
            >
              {model === null
                ? 'Pick a model to see the cost.'
                : allEstimate === null
                  ? 'Cost unknown for this model.'
                  : `Total cost: ${formatUsd(allEstimate)}`}
            </span>
          </div>
        )}
      </div>

      {scenes.length === 0 ? (
        <p style={{ color: 'var(--color-text-muted)' }}>
          No scenes yet — build the scene breakdown first.
        </p>
      ) : (
        <ol style={{ listStyle: 'none', padding: 0 }}>
          {scenes.map((scene, index) => (
            <SceneImageCard
              key={scene.id}
              scene={scene}
              index={index}
              model={model}
              resolution={effectiveResolution}
              perImageUsd={perImageUsd}
            />
          ))}
        </ol>
      )}
    </section>
  )
}

function SceneImageCard({
  scene,
  index,
  model,
  resolution,
  perImageUsd,
}: {
  scene: Scene
  index: number
  model: ImageModel | null
  resolution: string | null
  perImageUsd: number | null
}) {
  const generateSceneImage = useProjectStore((s) => s.generateSceneImage)
  const setActiveImageVersion = useProjectStore((s) => s.setActiveImageVersion)
  const status = useProjectStore((s) => s.sceneImageStatus[scene.id])
  const allImagesProgress = useProjectStore((s) => s.allImagesProgress)
  const references = useProjectStore((s) => s.project?.references ?? [])

  const attachableCount = references.filter(
    (r) => scene.referenceIds.includes(r.id) && r.activeImageVersionId !== null,
  ).length

  const activeVersion =
    scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ?? null
  const activeUrl = useBlobUrl(activeVersion?.blobPath ?? null)
  const generating = status?.generating === true

  const hasDescription = scene.visualDescription.trim().length > 0

  return (
    <li
      aria-label={`Scene ${String(index + 1)} images`}
      className="card"
      style={{
        padding: 'var(--space-4)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        gap: 'var(--space-4)',
      }}
    >
      <div style={{ width: '10rem', flexShrink: 0 }}>
        {activeUrl !== null ? (
          <img
            src={activeUrl}
            alt={`Scene ${String(index + 1)} active image`}
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
            aria-label={`Scene ${String(index + 1)} has no image yet`}
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
            {generating ? 'Generating…' : 'No image yet'}
          </div>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <strong>Scene {index + 1}</strong>
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
            margin: 'var(--space-1) 0 var(--space-3)',
          }}
        >
          {hasDescription
            ? scene.visualDescription
            : 'No visual description — add one on the Scenes stage.'}
        </p>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            disabled={
              model === null ||
              !hasDescription ||
              generating ||
              allImagesProgress !== null
            }
            onClick={() => {
              if (model !== null) {
                void generateSceneImage(scene.id, model, resolution)
              }
            }}
          >
            {generating
              ? 'Generating…'
              : scene.imageVersions.length > 0
                ? 'Regenerate'
                : 'Generate image'}
          </button>
          {model !== null && perImageUsd !== null && (
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              Cost: {formatUsd(perImageUsd)}
            </span>
          )}
        </div>
        {attachableCount > 0 && model !== null && (
          <p
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              margin: 'var(--space-2) 0 0',
            }}
          >
            {model.supportsImageToImage
              ? attachableCount === 1
                ? 'One reference image will be attached to this generation.'
                : `${String(attachableCount)} reference images will be attached to this generation.`
              : 'This model cannot use reference images — descriptions still apply, but the images will be skipped.'}
          </p>
        )}
        {status?.error != null && (
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {status.error}
          </p>
        )}

        {scene.imageVersions.length > 1 && (
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
              {scene.imageVersions.map((version, vIndex) => (
                <VersionThumb
                  key={version.id}
                  blobPath={version.blobPath}
                  label={`Scene ${String(index + 1)} version ${String(vIndex + 1)}`}
                  active={version.id === scene.activeImageVersionId}
                  onSelect={() =>
                    void setActiveImageVersion(scene.id, version.id)
                  }
                />
              ))}
            </div>
          </div>
        )}

        <GenerationHistory
          versions={scene.imageVersions}
          activeVersionId={scene.activeImageVersionId}
          label={`Scene ${String(index + 1)} image`}
          onRegenerate={(prompt) => {
            if (model !== null) {
              void generateSceneImage(scene.id, model, resolution, prompt)
            }
          }}
          regenerateDisabled={
            model === null || generating || allImagesProgress !== null
          }
          regenerateDisabledHint={
            model === null
              ? 'Pick an image model above first.'
              : 'Another generation is running.'
          }
          regenerateCostUsd={perImageUsd}
          editorHint="This exact text will be sent as the prompt — style and references are not re-added."
        />
      </div>
    </li>
  )
}
