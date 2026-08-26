import { useState, type CSSProperties } from 'react'
import type { ImageModel } from '../api/nanogpt'
import type { Scene } from '../domain/types'
import { DevelopingVeil } from './DevelopingVeil'
import { FilmProgress } from './FilmProgress'
import { HandoffTakeNote } from './HandoffTakeNote'
import { formatUsd } from '../lib/format'
import {
  getPerImagePriceUsd,
  pickResolutionForRatio,
  resolutionLabel,
} from '../lib/resolution'
import { useFormatSpec } from './useFormatSpec'
import { useModelsStore } from '../state/models'
import { useProjectStore } from '../state/project'
import { useRememberedModel } from '../state/modelChoices'
import { useUiStore } from '../state/ui'
import { GenerationHistory } from './GenerationHistory'
import { Lightbox, type LightboxItem } from './Lightbox'
import { ReelShell } from './Reel'
import { SceneDescriptionEditor } from './SceneDescriptionEditor'
import { ComposedPrompt } from './PromptRecipe'
import { buildImagePrompt } from '../domain/prompts'
import { getStylePreset } from '../domain/stylePresets'
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
  const formatSpec = useFormatSpec()
  const project = useProjectStore((s) => s.project)
  const generateAllImages = useProjectStore((s) => s.generateAllImages)
  const allImagesProgress = useProjectStore((s) => s.allImagesProgress)

  const imageModels = useModelsStore((s) => s.imageModels)
  // Remembered across stage hops and reloads (22.12).
  const [model, setModel] = useRememberedModel<ImageModel>(
    'images.image',
    imageModels,
  )
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
    model === null
      ? null
      : (resolution ?? pickResolutionForRatio(model, formatSpec.ratio))
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
      {/* The reel leads (15.17.3, Angel's request): Images and Animation
          both open on their reel, so the two stages line up. */}
      <ReelShell
        hint="select a frame to work on it below"
        // Selected frame: 11.5rem wide at the project's aspect, plus
        // the strip's own vertical padding (border-box).
        frameHeight={`calc(11.5rem / ${String(formatSpec.ratio)} + 2 * var(--space-2))`}
      >
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

      <StyleGallery />

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
  const formatSpec = useFormatSpec()
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
        transition: 'width var(--t-med) var(--ease-film)',
      }}
    >
      <button
        type="button"
        className="reel-frame"
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
            // Keyed by take: a newly chosen print develops into focus.
            key={activeVersion?.id}
            className="develop-in"
            src={activeUrl}
            alt={`Scene ${n} active image`}
            style={{
              width: '100%',
              aspectRatio: formatSpec.cssAspect,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
            aria-label={`Scene ${n} has no image yet`}
            style={{
              width: '100%',
              aspectRatio: formatSpec.cssAspect,
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
        {generating && (
          // The empty-frame placeholder already says "Generating…" in the
          // middle; the badge covers the regenerate-over-an-image case.
          <DevelopingVeil
            label={activeUrl !== null ? 'Generating…' : undefined}
          />
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
  const toggleSceneReference = useProjectStore((s) => s.toggleSceneReference)
  const createReferenceFromSceneImage = useProjectStore(
    (s) => s.createReferenceFromSceneImage,
  )
  const status = useProjectStore((s) => s.sceneImageStatus[scene.id])
  const references = useProjectStore((s) => s.project?.references ?? [])
  const [newRefName, setNewRefName] = useState('')
  const [savedRefId, setSavedRefId] = useState<string | null>(null)
  const setStage = useUiStore((s) => s.setStage)
  const setHighlightReference = useUiStore((s) => s.setHighlightReference)
  const activeVersion =
    scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ?? null
  const stylePresetId = useProjectStore((s) => s.project?.stylePresetId ?? null)
  const styleNotes = useProjectStore((s) => s.project?.styleNotes ?? '')
  const workbenchFormat = useFormatSpec()
  const n = String(index + 1)
  const generating = status?.generating === true
  const hasDescription = scene.visualDescription.trim().length > 0
  const ticked = references.filter((r) => scene.referenceIds.includes(r.id))
  const tickedWithoutDescription = ticked.filter(
    (r) => r.descriptor.trim().length === 0,
  )
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
    <div aria-label={`Scene ${n} workbench`} className="workbench-grid">
      {/* Prompt panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Scene {n} — prompt</div>
        <SceneDescriptionEditor scene={scene} n={n} />
        {/* The prompt recipe's receipt (22): the exact image prompt as
            sent — preset + style notes + references + description +
            format, composed live. */}
        <ComposedPrompt
          label="The exact image prompt, as sent"
          text={buildImagePrompt({
            stylePromptFragment:
              getStylePreset(stylePresetId)?.promptFragment ?? null,
            styleNotes,
            referenceDescriptors: ticked.map((r) => r.descriptor),
            visualDescription: scene.visualDescription,
            compositionFragment: workbenchFormat.promptFragment,
          })}
          note={
            model !== null && !model.supportsImageToImage && attachableCount > 0
              ? 'Editing the prompt at generation time replaces this text verbatim. This model SKIPS reference images — only the words above reach it.'
              : 'Editing the prompt at generation time replaces this text verbatim — reference images still attach.'
          }
        />
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
        {references.length > 0 && (
          <div>
            <span
              style={{
                display: 'block',
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                marginBottom: 'var(--space-1)',
              }}
            >
              References — click to tick or untick for this scene
            </span>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              {references.map((r) => {
                const isTicked = scene.referenceIds.includes(r.id)
                const label =
                  r.name.trim().length > 0 ? r.name : 'Unnamed reference'
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-label={`Scene ${n} uses ${label}`}
                    aria-pressed={isTicked}
                    onClick={() => void toggleSceneReference(scene.id, r.id)}
                    style={{
                      fontSize: '12px',
                      padding: 'var(--space-1) var(--space-3)',
                      borderRadius: 'var(--radius-pill)',
                      boxShadow: 'none',
                      background:
                        isTicked && r.activeImageVersionId !== null
                          ? 'var(--color-accent-soft)'
                          : 'transparent',
                      border: isTicked
                        ? '1px solid var(--color-accent)'
                        : '1px dashed var(--color-border)',
                      color: isTicked
                        ? 'var(--color-text)'
                        : 'var(--color-text-muted)',
                      fontWeight: isTicked ? 600 : 400,
                    }}
                  >
                    {label}
                    {isTicked && r.activeImageVersionId !== null && ' ✓'}
                    {isTicked && r.descriptor.trim().length === 0 && (
                      <span style={{ color: 'var(--color-accent)' }}>
                        {' '}
                        · no description
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        )}
        {/* Save the scene's image as a NEW reference (22.13): the exiled
            emperor no longer wears the crown — this take becomes the
            reference for the scenes that follow. */}
        {activeVersion !== null && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--space-1)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              <input
                type="text"
                value={newRefName}
                placeholder="Name the new reference (e.g. Jack in exile)"
                aria-label={`New reference name for scene ${n}`}
                onChange={(e) => {
                  setNewRefName(e.target.value)
                }}
                style={{
                  flex: 1,
                  minWidth: '12rem',
                  background: 'var(--color-surface-2)',
                  color: 'var(--color-text)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-1) var(--space-2)',
                  fontSize: 'var(--text-sm)',
                }}
              />
              <button
                type="button"
                aria-label={`Save scene ${n} image as reference`}
                onClick={() => {
                  void createReferenceFromSceneImage(scene.id, newRefName).then(
                    (id) => {
                      if (id !== null) {
                        setNewRefName('')
                        setSavedRefId(id)
                      }
                    },
                  )
                }}
                style={{
                  fontSize: 'var(--text-sm)',
                  padding: 'var(--space-1) var(--space-3)',
                }}
              >
                Save image as reference
              </button>
            </div>
            {savedRefId !== null && (
              <p
                role="status"
                // The pulse makes the "one step left" hard to miss
                // (22.14, Angel's idea) — a few beats, not an infinite
                // loop.
                className="attention-pulse"
                style={{
                  margin: 0,
                  color: 'var(--color-accent)',
                  fontSize: 'var(--text-sm)',
                  border: '1px solid var(--color-accent)',
                  borderRadius: 'var(--radius)',
                  padding: 'var(--space-2) var(--space-3)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-3)',
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ flex: 1, minWidth: '14rem' }}>
                  Saved and ticked for this scene (free) — but it has no
                  description yet, and the description is what rides the
                  prompts, so without one the look will drift.
                </span>
                <button
                  type="button"
                  aria-label="Describe the new reference"
                  onClick={() => {
                    setHighlightReference(savedRefId)
                    setStage('scenes')
                  }}
                  style={{
                    fontSize: 'var(--text-sm)',
                    padding: 'var(--space-1) var(--space-3)',
                  }}
                >
                  Describe it now →
                </button>
              </p>
            )}
          </div>
        )}
        {tickedWithoutDescription.length > 0 && (
          <p
            role="alert"
            style={{
              margin: 0,
              color: 'var(--color-accent)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {tickedWithoutDescription
              .map((r) =>
                r.name.trim().length > 0 ? r.name : 'An unnamed reference',
              )
              .join(', ')}{' '}
            {tickedWithoutDescription.length === 1 ? 'has' : 'have'} no
            description — the description is what rides the prompt, so an empty
            one adds nothing (and with a model that skips images, nothing of the
            reference reaches the model at all). Describe everything that must
            stay identical on the References panel.
          </p>
        )}
        {attachableCount > 0 && model !== null && (
          <p
            style={{
              margin: 0,
              // The skipped-images case is the "why did my references do
              // nothing?" trap (22.2, Angel's report) — it must not
              // whisper in muted gray.
              color: model.supportsImageToImage
                ? 'var(--color-text-muted)'
                : 'var(--color-accent)',
              fontSize: 'var(--text-sm)',
              fontWeight: model.supportsImageToImage ? 400 : 600,
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
                  {resolutionLabel(r)}
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
        {generating && <FilmProgress label={`Scene ${n} image generating`} />}
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
            {allImagesProgress !== null && (
              <div style={{ flexBasis: '100%' }}>
                <FilmProgress
                  value={
                    allImagesProgress.total > 0
                      ? allImagesProgress.done / allImagesProgress.total
                      : null
                  }
                  label="All images progress"
                />
              </div>
            )}
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
            <HandoffTakeNote scene={scene} />
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
