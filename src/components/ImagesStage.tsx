import { useState, type CSSProperties } from 'react'
import type { ImageModel } from '../api/nanogpt'
import type { Scene } from '../domain/types'
import { formatUsd } from '../lib/format'
import { getPerImagePriceUsd, pickPortraitResolution } from '../lib/resolution'
import { useProjectStore } from '../state/project'
import { GenerationHistory } from './GenerationHistory'
import { Lightbox, type LightboxItem } from './Lightbox'
import { ReelShell } from './Reel'
import { ImageModelPicker } from './ModelPicker'
import { StyleGallery } from './StyleGallery'
import { useBlobUrl } from './useBlobUrl'
import { VersionThumb } from './VersionThumb'

/**
 * The Images stage as a reel (ADR-011, Filmstrip design): scenes run
 * horizontally like frames on a strip of film; the workbench below always
 * operates on the selected frame. One screen tall instead of one scene per
 * screen.
 */
export function ImagesStage() {
  const project = useProjectStore((s) => s.project)
  const generateAllImages = useProjectStore((s) => s.generateAllImages)
  const allImagesProgress = useProjectStore((s) => s.allImagesProgress)

  const [model, setModel] = useState<ImageModel | null>(null)
  const [resolution, setResolution] = useState<string | null>(null)
  const [onlyImageToImage, setOnlyImageToImage] = useState(false)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [lightboxStart, setLightboxStart] = useState<number | null>(null)

  if (project === null) return null
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order)
  const hasReferenceImages = project.references.some(
    (r) => r.activeImageVersionId !== null,
  )

  const selectedScene =
    scenes.find((s) => s.id === selectedSceneId) ?? scenes[0] ?? null

  const effectiveResolution =
    model === null ? null : (resolution ?? pickPortraitResolution(model))
  const perImageUsd =
    model === null ? null : getPerImagePriceUsd(model, effectiveResolution)

  const missingCount = scenes.filter(
    (s) =>
      s.imageVersions.length === 0 && s.visualDescription.trim().length > 0,
  ).length
  const allEstimate = perImageUsd === null ? null : perImageUsd * missingCount

  // Every scene that has an active image, in reel order — the lightbox
  // walks this list with the arrow keys.
  const lightboxItems: LightboxItem[] = []
  const lightboxIndexByScene = new Map<string, number>()
  for (const [i, scene] of scenes.entries()) {
    const active =
      scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ??
      null
    if (active !== null) {
      lightboxIndexByScene.set(scene.id, lightboxItems.length)
      lightboxItems.push({
        blobPath: active.blobPath,
        mimeType: active.mimeType,
        alt: `Scene ${String(i + 1)} image — enlarged`,
        kind: 'image',
        title: `Scene ${String(i + 1)}`,
        prompt: scene.visualDescription.trim(),
        excerpt: scene.textExcerpt.trim(),
      })
    }
  }

  if (scenes.length === 0) {
    return (
      <section>
        <h3 style={{ fontSize: 'var(--text-lg)', marginTop: 0 }}>Images</h3>
        <p style={{ color: 'var(--color-text-muted)' }}>
          No scenes yet — build the scene breakdown first.
        </p>
      </section>
    )
  }

  return (
    <section>
      <StyleGallery />

      {/* The reel */}
      <ReelShell hint="select a frame to work on it below">
        {scenes.map((scene, index) => (
          <SceneFrame
            key={scene.id}
            scene={scene}
            index={index}
            selected={selectedScene?.id === scene.id}
            onSelect={() => {
              setSelectedSceneId(scene.id)
            }}
            onExpand={() => {
              const at = lightboxIndexByScene.get(scene.id)
              if (at !== undefined) setLightboxStart(at)
            }}
          />
        ))}
      </ReelShell>

      {/* The workbench for the selected frame */}
      {selectedScene !== null && (
        <Workbench
          key={selectedScene.id}
          scene={selectedScene}
          index={scenes.findIndex((s) => s.id === selectedScene.id)}
          model={model}
          onSelectModel={(m) => {
            setModel(m)
            setResolution(null)
          }}
          resolution={effectiveResolution}
          onSelectResolution={setResolution}
          onlyImageToImage={onlyImageToImage}
          onToggleOnlyImageToImage={setOnlyImageToImage}
          hasReferenceImages={hasReferenceImages}
          perImageUsd={perImageUsd}
          missingCount={missingCount}
          allEstimate={allEstimate}
          allImagesProgress={allImagesProgress}
          onGenerateAll={() => {
            if (model !== null) {
              void generateAllImages(model, effectiveResolution)
            }
          }}
        />
      )}

      {lightboxStart !== null && lightboxItems.length > 0 && (
        <Lightbox
          items={lightboxItems}
          startIndex={lightboxStart}
          onClose={() => {
            setLightboxStart(null)
          }}
        />
      )}
    </section>
  )
}

function SceneFrame({
  scene,
  index,
  selected,
  onSelect,
  onExpand,
}: {
  scene: Scene
  index: number
  selected: boolean
  onSelect: () => void
  onExpand: () => void
}) {
  const status = useProjectStore((s) => s.sceneImageStatus[scene.id])
  const activeVersion =
    scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ?? null
  const activeUrl = useBlobUrl(
    activeVersion?.blobPath ?? null,
    activeVersion?.mimeType,
  )
  const generating = status?.generating === true
  const n = String(index + 1)

  return (
    <div
      className="frame-wrap"
      style={{
        position: 'relative',
        flexShrink: 0,
        width: selected ? '11.5rem' : '10rem',
      }}
    >
      <button
        type="button"
        aria-label={`Scene ${n} frame`}
        aria-pressed={selected}
        onClick={onSelect}
        onDoubleClick={() => {
          if (activeUrl !== null) onExpand()
        }}
        style={{
          padding: 0,
          display: 'block',
          width: '100%',
          borderRadius: '16px',
          overflow: 'hidden',
          position: 'relative',
          border: selected
            ? '2px solid var(--color-accent)'
            : activeUrl !== null
              ? '1px solid var(--color-border)'
              : '1px dashed var(--color-border)',
          boxShadow: selected
            ? '0 0 0 5px var(--color-accent-soft), var(--shadow-card)'
            : 'none',
          background: 'var(--color-surface)',
          cursor: 'pointer',
        }}
      >
        {activeUrl !== null ? (
          <img
            src={activeUrl}
            alt={`Scene ${n} active image`}
            style={{
              width: '100%',
              aspectRatio: '9 / 16',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            aria-label={`Scene ${n} has no image yet`}
            style={{
              width: '100%',
              aspectRatio: '9 / 16',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 'var(--space-2)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              padding: 'var(--space-2)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontSize: '20px' }}>◌</span>
            {generating ? 'Generating…' : 'No image yet'}
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: 'var(--space-2) var(--space-2)',
            fontSize: '12px',
            textAlign: 'left',
            color: 'var(--color-text)',
            background:
              activeUrl !== null
                ? 'linear-gradient(transparent, rgba(0, 0, 0, 0.65))'
                : 'transparent',
            fontWeight: selected ? 700 : 400,
          }}
        >
          {n} ·{' '}
          {scene.visualDescription.trim().split(/\s+/).slice(0, 3).join(' ') ||
            'untitled'}
          {generating && ' · generating…'}
        </span>
      </button>
      {activeUrl !== null && (
        <button
          type="button"
          className="expand-btn"
          aria-label={`View scene ${n} image large`}
          onClick={onExpand}
          style={{
            position: 'absolute',
            right: 'var(--space-2)',
            bottom: '2rem',
            width: '30px',
            height: '30px',
            padding: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.55)',
            border: '1px solid rgba(255, 255, 255, 0.4)',
            color: '#ffffff',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden="true">
            <path
              d="M8 1.5 H11.5 V5 M11.5 1.5 L7.5 5.5 M5 11.5 H1.5 V8 M1.5 11.5 L5.5 7.5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      )}
    </div>
  )
}

function Workbench({
  scene,
  index,
  model,
  onSelectModel,
  resolution,
  onSelectResolution,
  onlyImageToImage,
  onToggleOnlyImageToImage,
  hasReferenceImages,
  perImageUsd,
  missingCount,
  allEstimate,
  allImagesProgress,
  onGenerateAll,
}: {
  scene: Scene
  index: number
  model: ImageModel | null
  onSelectModel: (m: ImageModel) => void
  resolution: string | null
  onSelectResolution: (r: string) => void
  onlyImageToImage: boolean
  onToggleOnlyImageToImage: (v: boolean) => void
  hasReferenceImages: boolean
  perImageUsd: number | null
  missingCount: number
  allEstimate: number | null
  allImagesProgress: { done: number; total: number } | null
  onGenerateAll: () => void
}) {
  const generateSceneImage = useProjectStore((s) => s.generateSceneImage)
  const setActiveImageVersion = useProjectStore((s) => s.setActiveImageVersion)
  const status = useProjectStore((s) => s.sceneImageStatus[scene.id])
  const references = useProjectStore((s) => s.project?.references ?? [])

  const n = String(index + 1)
  const generating = status?.generating === true
  const hasDescription = scene.visualDescription.trim().length > 0
  const ticked = references.filter((r) => scene.referenceIds.includes(r.id))
  const attachableCount = ticked.filter(
    (r) => r.activeImageVersionId !== null,
  ).length

  const panel: CSSProperties = {
    padding: 'var(--space-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    minWidth: 0,
  }
  const panelTitle: CSSProperties = {
    fontSize: 'var(--text-sm)',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: 'var(--color-text-muted)',
  }

  return (
    <div
      aria-label={`Scene ${n} workbench`}
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1fr',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }}
    >
      {/* Prompt panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Scene {n} — prompt</div>
        <p style={{ margin: 0, lineHeight: 1.6 }}>
          {hasDescription
            ? scene.visualDescription
            : 'No visual description — add one on the Scenes stage.'}
        </p>
        {scene.textExcerpt.trim().length > 0 && (
          <p
            style={{
              margin: 0,
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-3)',
            }}
          >
            Script — “{scene.textExcerpt.trim()}”
          </p>
        )}
        {ticked.length > 0 && (
          <div
            style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}
          >
            {ticked.map((r) => (
              <span
                key={r.id}
                style={{
                  fontSize: '12px',
                  padding: 'var(--space-1) var(--space-3)',
                  borderRadius: 'var(--radius-pill)',
                  background:
                    r.activeImageVersionId !== null
                      ? 'var(--color-accent-soft)'
                      : 'transparent',
                  border: '1px solid var(--color-border)',
                }}
              >
                {r.name.trim().length > 0 ? r.name : 'Unnamed reference'}
                {r.activeImageVersionId !== null && ' ✓'}
              </span>
            ))}
          </div>
        )}
        {attachableCount > 0 && model !== null && (
          <p
            style={{
              margin: 0,
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {model.supportsImageToImage
              ? attachableCount === 1
                ? 'One reference image will be attached to this generation.'
                : `${String(attachableCount)} reference images will be attached to this generation.`
              : 'This model cannot use reference images — descriptions still apply, but the images will be skipped.'}
          </p>
        )}
      </div>

      {/* Generate panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Generate</div>
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
                onToggleOnlyImageToImage(e.target.checked)
              }}
            />
            Only show models that can use reference images
          </label>
        )}
        <ImageModelPicker
          selectedId={model?.id ?? null}
          onlyImageToImage={onlyImageToImage}
          onSelect={onSelectModel}
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
              value={resolution ?? ''}
              onChange={(e) => {
                onSelectResolution(e.target.value)
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
            className="primary"
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
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {model === null
              ? 'Pick a model to see the cost.'
              : perImageUsd === null
                ? 'Cost unknown for this model.'
                : `Cost: ${formatUsd(perImageUsd)}`}
          </span>
        </div>
        {status?.error != null && (
          <p role="alert" style={{ margin: 0, color: 'var(--color-danger)' }}>
            {status.error}
          </p>
        )}
        {missingCount > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-3)',
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              disabled={model === null || allImagesProgress !== null}
              onClick={onGenerateAll}
            >
              {allImagesProgress !== null
                ? `Generating ${String(allImagesProgress.done)}/${String(allImagesProgress.total)}…`
                : `Generate ${String(missingCount)} missing ${missingCount === 1 ? 'image' : 'images'}`}
            </button>
            <span
              aria-label="Estimated total cost"
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
              }}
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

      {/* Takes panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Takes — scene {n}</div>
        {scene.imageVersions.length === 0 ? (
          <p
            style={{
              margin: 0,
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            No takes yet — the first generation lands here.
          </p>
        ) : (
          <>
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
                  label={`Scene ${n} version ${String(vIndex + 1)}`}
                  active={version.id === scene.activeImageVersionId}
                  onSelect={() =>
                    void setActiveImageVersion(scene.id, version.id)
                  }
                />
              ))}
            </div>
            <GenerationHistory
              versions={scene.imageVersions}
              activeVersionId={scene.activeImageVersionId}
              label={`Scene ${n} image`}
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
                  ? 'Pick an image model first.'
                  : 'Another generation is running.'
              }
              regenerateCostUsd={perImageUsd}
              editorHint="This exact text will be sent as the prompt — style and references are not re-added."
            />
          </>
        )}
      </div>
    </div>
  )
}
