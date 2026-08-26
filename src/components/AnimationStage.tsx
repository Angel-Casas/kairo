import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { VideoModel } from '../api/nanogpt'
import { clipCarriesOwnAudio } from '../domain/types'
import type { Scene } from '../domain/types'
import { narrationCutoffWarning, planFrames } from '../lib/clipDuration'
import { audioBlobDuration } from '../lib/audioBlob'
import { getRepository } from '../state/repo'
import { formatUsd } from '../lib/format'
import {
  resolutionLabel,
  sortVideoResolutionsCheapestFirst,
} from '../lib/resolution'
import { DevelopingVeil } from './DevelopingVeil'
import { useModelsStore } from '../state/models'
import { useRememberedModel } from '../state/modelChoices'
import { AnimateBatchOverlay, type BatchItem } from './AnimateBatchOverlay'
import { useProjectStore } from '../state/project'
import { useFormatSpec } from './useFormatSpec'
import { HandoffOverlay } from './HandoffOverlay'
import { buildVideoPrompt } from '../domain/prompts'
import { getStylePreset } from '../domain/stylePresets'
import { HandoffTakeNote } from './HandoffTakeNote'
import { ComposedPrompt, RecipeFixedText, RecipeRow } from './PromptRecipe'
import { ConfirmDialog } from './ConfirmDialog'
import { FilmProgress } from './FilmProgress'
import { GenerationHistory } from './GenerationHistory'
import { Lightbox, type LightboxItem } from './Lightbox'
import { VideoModelPicker } from './ModelPicker'
import { ReelShell } from './Reel'
import { SceneDescriptionEditor } from './SceneDescriptionEditor'
import { useBlobUrl } from './useBlobUrl'

/** Offered when a model does not advertise its supported resolutions. */

/** Cheapest resolution + ≈cost for a lip-sync run of the given length. */
export function lipSyncEstimate(
  model: VideoModel,
  narrationSeconds: number | null,
): { resolution: string | null; usd: number | null } {
  const resolution =
    model.resolutions.length > 0
      ? (sortVideoResolutionsCheapestFirst(model.resolutions)[0] ?? null)
      : null
  const rates = model.lipSync?.perSecondUsd ?? {}
  const rate =
    (resolution !== null ? rates[resolution] : undefined) ?? rates['']
  const usd =
    rate !== undefined && narrationSeconds !== null
      ? rate * narrationSeconds
      : null
  return { resolution, usd }
}

function describeClipPrice(model: VideoModel): string {
  if (model.priceRangeUsd === null) {
    return 'This model does not list a price — NanoGPT charges the exact amount at submission and Kairo records it in the project spend log.'
  }
  const { min, max } = model.priceRangeUsd
  if (min === max) {
    return `Listed price: about ${formatUsd(min)} per clip. The exact amount is charged at submission and recorded in the spend log.`
  }
  return `Listed price: between ${formatUsd(min)} and ${formatUsd(max)} per clip depending on resolution and duration — lower resolution and shorter clips cost less. The exact amount is charged at submission and recorded in the spend log.`
}

type PendingConfirm =
  | {
      type: 'one'
      sceneId: string
      label: string
      narrationSeconds: number | null
    }
  | {
      type: 'tweak'
      sceneId: string
      label: string
      prompt: string
      narrationSeconds: number | null
    }
  | { type: 'lipsync'; sceneId: string; label: string }

/**
 * Length of the scene's active narration, for the cutoff caution
 * (22.16). Null when there is no narration or it cannot be decoded —
 * then there is nothing to warn about.
 */
async function measureNarrationSeconds(scene: Scene): Promise<number | null> {
  const narration = scene.audioVersions.find(
    (v) => v.id === scene.activeAudioVersionId,
  )
  if (narration === undefined) return null
  const repo = await getRepository()
  const blob = await repo.blobs.get(narration.blobPath)
  if (blob === null) return null
  // OPFS strips the MIME type; restore it so decoding works.
  const typed =
    blob.type.length > 0 ? blob : new Blob([blob], { type: narration.mimeType })
  return audioBlobDuration(typed)
}

/**
 * The Animation stage as a reel (ADR-011): frames show each scene's source
 * image with a clip badge once animated; the workbench below plays and
 * regenerates the selected scene's clip. Every submission still passes the
 * cost-confirmation dialog (Slice 6.1) — video is the expensive kind.
 */
export function AnimationStage() {
  const formatSpec = useFormatSpec()
  const project = useProjectStore((s) => s.project)
  const generateSceneVideo = useProjectStore((s) => s.generateSceneVideo)
  const videoModels = useModelsStore((s) => s.videoModels)

  // Remembered across stage hops and reloads (22.12).
  const [model, setModel] = useRememberedModel<VideoModel>(
    'animation.video',
    videoModels,
  )
  const [lipSyncModel, setLipSyncModel] = useRememberedModel<VideoModel>(
    'animation.lipsync',
    videoModels,
  )
  const [duration, setDuration] = useState('5')
  const [resolution, setResolution] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null)
  const [batchOpen, setBatchOpen] = useState(false)
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null)
  const [lightboxStart, setLightboxStart] = useState<number | null>(null)

  if (project === null) return null
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order)
  const selectedScene =
    scenes.find((s) => s.id === selectedSceneId) ?? scenes[0] ?? null
  const selectedIndex =
    selectedScene === null
      ? 0
      : scenes.findIndex((s) => s.id === selectedScene.id)

  // A parameter the model doesn't advertise is one it will IGNORE
  // (LESSONS) — so an empty listing means NO control, not our fallbacks:
  // no fake select, no fabricated request field (Slice 15.15).
  const resolutionOptions =
    model !== null && model.resolutions.length > 0
      ? sortVideoResolutionsCheapestFirst(model.resolutions)
      : []
  // Default to the CHEAPEST resolution — never let a provider default pick
  // an expensive tier silently (learned the hard way, see LESSONS.md).
  const effectiveResolution =
    resolutionOptions.length === 0
      ? null
      : resolution !== null && resolutionOptions.includes(resolution)
        ? resolution
        : (resolutionOptions[0] ?? null)
  // When the model advertises its supported durations, offer exactly those —
  // asking for a length a model can't make just gets silently clamped
  // server-side (an "8s" request coming back as a 5s clip).
  const durationOptions = model !== null ? model.durations : []
  const effectiveDuration: string | null =
    durationOptions.length === 0
      ? null
      : durationOptions.includes(duration)
        ? duration
        : (durationOptions[0] ?? null)

  const pendingScenes = scenes.filter(
    (s) => s.activeImageVersionId !== null && s.videoVersions.length === 0,
  )
  const pendingCount = pendingScenes.length
  const sceneNumbers = new Map(scenes.map((s, i) => [s.id, i + 1]))

  const confirmMessage = (countLabel: string) =>
    model === null
      ? ''
      : `${countLabel} with ${model.name} at ${effectiveResolution ?? "the model's fixed resolution"}, ${effectiveDuration === null ? 'fixed length' : `${effectiveDuration}s`}. ${describeClipPrice(model)}`

  // The lightbox walks the scenes' media in reel order: the active clip
  // where one exists, otherwise the still image that will be animated.
  const lightboxItems: LightboxItem[] = []
  const lightboxIndexByScene = new Map<string, number>()
  for (const [i, scene] of scenes.entries()) {
    const clip =
      scene.videoVersions.find((v) => v.id === scene.activeVideoVersionId) ??
      null
    const still =
      scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ??
      null
    const media = clip ?? still
    // The scene's narration rides along with its clip in the viewer.
    const narration =
      clip !== null
        ? (scene.audioVersions.find(
            (v) => v.id === scene.activeAudioVersionId,
          ) ?? null)
        : null
    if (media !== null) {
      lightboxIndexByScene.set(scene.id, lightboxItems.length)
      lightboxItems.push({
        blobPath: media.blobPath,
        mimeType: media.mimeType,
        alt: `Scene ${String(i + 1)} ${clip !== null ? 'clip' : 'image'} — enlarged`,
        kind: clip !== null ? 'video' : 'image',
        title: `Scene ${String(i + 1)}`,
        prompt: scene.visualDescription.trim(),
        excerpt: scene.textExcerpt.trim(),
        // A lip-sync clip already plays its own narration — syncing the
        // separate track on top would double the voice (15.16.3).
        narrationBlobPath: clipCarriesOwnAudio(clip)
          ? undefined
          : narration?.blobPath,
        narrationMimeType: clipCarriesOwnAudio(clip)
          ? undefined
          : narration?.mimeType,
      })
    }
  }

  if (scenes.length === 0) {
    return (
      <section>
        <h3 style={{ fontSize: 'var(--text-lg)', marginTop: 0 }}>Animation</h3>
        <p style={{ color: 'var(--color-text-muted)' }}>
          No scenes yet — build the scene breakdown first.
        </p>
      </section>
    )
  }

  return (
    <section>
      <ReelShell
        hint="select a frame to animate it below"
        // Selected frame: 11.5rem wide at the project's aspect, plus
        // the strip's own vertical padding (border-box).
        frameHeight={`calc(11.5rem / ${String(formatSpec.ratio)} + 2 * var(--space-2))`}
      >
        {scenes.map((scene, index) => (
          <AnimationFrame
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

      {selectedScene !== null && (
        <AnimationWorkbench
          key={selectedScene.id}
          scene={selectedScene}
          index={selectedIndex}
          nextScene={scenes[selectedIndex + 1] ?? null}
          model={model}
          onSelectModel={(m) => {
            setModel(m)
            setResolution(null)
          }}
          duration={effectiveDuration}
          durationOptions={durationOptions}
          onSelectDuration={setDuration}
          effectiveResolution={effectiveResolution}
          resolutionOptions={resolutionOptions}
          onSelectResolution={setResolution}
          pendingCount={pendingCount}
          onRequestGenerate={() => {
            void measureNarrationSeconds(selectedScene).then(
              (narrationSeconds) => {
                setConfirming({
                  type: 'one',
                  sceneId: selectedScene.id,
                  label: `Animate scene ${String(selectedIndex + 1)}`,
                  narrationSeconds,
                })
              },
            )
          }}
          onRequestTweak={(prompt) => {
            void measureNarrationSeconds(selectedScene).then(
              (narrationSeconds) => {
                setConfirming({
                  type: 'tweak',
                  sceneId: selectedScene.id,
                  label: `Animate scene ${String(selectedIndex + 1)} with the edited motion prompt`,
                  prompt,
                  narrationSeconds,
                })
              },
            )
          }}
          onRequestAll={() => {
            setBatchOpen(true)
          }}
          lipSyncModel={lipSyncModel}
          onSelectLipSyncModel={setLipSyncModel}
          onRequestLipSync={() => {
            setConfirming({
              type: 'lipsync',
              sceneId: selectedScene.id,
              label: `Lip-sync scene ${String(selectedIndex + 1)} to its narration`,
            })
          }}
        />
      )}

      {batchOpen && model !== null && (
        <AnimateBatchOverlay
          scenes={pendingScenes}
          sceneNumbers={sceneNumbers}
          defaultModel={model}
          models={videoModels.filter((m) => m.supportsImageToVideo)}
          globalDuration={effectiveDuration}
          globalResolution={effectiveResolution}
          onCancel={() => {
            setBatchOpen(false)
          }}
          onSubmit={(items: BatchItem[]) => {
            setBatchOpen(false)
            // Sequential submissions, same as the old batch — each scene's
            // frame shows its own progress, failures stay per-scene.
            void (async () => {
              for (const item of items) {
                await generateSceneVideo(
                  item.sceneId,
                  item.model,
                  item.duration,
                  item.resolution,
                )
              }
            })()
          }}
        />
      )}

      {/* The lip-sync flow has its OWN model — it must not be gated on
          the main Animate model being chosen (15.16.2, Angel's report:
          the button "did nothing" without a main model selected). */}
      {confirming !== null &&
        (confirming.type === 'lipsync'
          ? lipSyncModel !== null
          : model !== null) && (
          <ConfirmDialog
            title={`${confirming.label}?`}
            message={
              confirming.type === 'lipsync' && lipSyncModel !== null
                ? (() => {
                    const est = lipSyncEstimate(lipSyncModel, null)
                    return `This submits one lip-sync job with ${lipSyncModel.name} at ${est.resolution ?? 'the model\u2019s default resolution'}. The clip follows the scene's narration; billed per second, charged at submission.`
                  })()
                : confirmMessage('This submits one video job')
            }
            warning={
              confirming.type !== 'lipsync'
                ? (narrationCutoffWarning(
                    confirming.narrationSeconds,
                    effectiveDuration === null
                      ? null
                      : Number(effectiveDuration),
                  ) ?? undefined)
                : undefined
            }
            confirmLabel="Submit and charge"
            onConfirm={() => {
              const pending = confirming
              setConfirming(null)
              if (pending.type === 'lipsync') {
                if (lipSyncModel !== null) {
                  void generateSceneVideo(
                    pending.sceneId,
                    lipSyncModel,
                    null, // the narration defines the length
                    lipSyncEstimate(lipSyncModel, null).resolution,
                    undefined,
                    true,
                  )
                }
              } else if (pending.type === 'tweak') {
                if (model !== null) {
                  void generateSceneVideo(
                    pending.sceneId,
                    model,
                    effectiveDuration,
                    effectiveResolution,
                    pending.prompt,
                  )
                }
              } else {
                if (model !== null) {
                  void generateSceneVideo(
                    pending.sceneId,
                    model,
                    effectiveDuration,
                    effectiveResolution,
                  )
                }
              }
            }}
            onCancel={() => {
              setConfirming(null)
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

function AnimationFrame({
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
  const status = useProjectStore((s) => s.sceneVideoStatus[scene.id])
  const activeImage =
    scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ?? null
  const imageUrl = useBlobUrl(
    activeImage?.blobPath ?? null,
    activeImage?.mimeType,
  )
  const hasClip = scene.videoVersions.length > 0
  const generating = status?.generating === true
  const n = String(index + 1)

  const hasMedia = hasClip || imageUrl !== null

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
          if (hasMedia) onExpand()
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
            : imageUrl !== null
              ? '1px solid var(--color-border)'
              : '1px dashed var(--color-border)',
          boxShadow: selected
            ? '0 0 0 5px var(--color-accent-soft), var(--shadow-card)'
            : 'none',
          background: 'var(--color-surface)',
          cursor: 'pointer',
        }}
      >
        {imageUrl !== null ? (
          <img
            src={imageUrl}
            alt={`Scene ${n} source image`}
            style={{
              width: '100%',
              aspectRatio: formatSpec.cssAspect,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
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
            No image — generate one on the Images stage
          </div>
        )}
        <span
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            padding: 'var(--space-2)',
            fontSize: '12px',
            textAlign: 'left',
            color: 'var(--color-text)',
            background:
              imageUrl !== null
                ? 'linear-gradient(transparent, rgba(0, 0, 0, 0.65))'
                : 'transparent',
            fontWeight: selected ? 700 : 400,
          }}
        >
          {n} ·{' '}
          {generating
            ? 'animating…'
            : hasClip
              ? `clip ✓ (${String(scene.videoVersions.length)})`
              : 'no clip yet'}
        </span>
        {generating && <DevelopingVeil label="Animating…" />}
      </button>
      {hasMedia && (
        <button
          type="button"
          className="expand-btn"
          aria-label={`View scene ${n} large`}
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

function AnimationWorkbench({
  scene,
  index,
  model,
  onSelectModel,
  duration,
  durationOptions,
  onSelectDuration,
  effectiveResolution,
  resolutionOptions,
  onSelectResolution,
  pendingCount,
  onRequestGenerate,
  onRequestTweak,
  onRequestAll,
  lipSyncModel,
  onSelectLipSyncModel,
  onRequestLipSync,
  nextScene,
}: {
  scene: Scene
  index: number
  nextScene: Scene | null
  model: VideoModel | null
  onSelectModel: (m: VideoModel) => void
  duration: string | null
  durationOptions: string[]
  onSelectDuration: (d: string) => void
  effectiveResolution: string | null
  resolutionOptions: string[]
  onSelectResolution: (r: string) => void
  pendingCount: number
  onRequestGenerate: () => void
  onRequestTweak: (prompt: string) => void
  onRequestAll: () => void
  lipSyncModel: VideoModel | null
  onSelectLipSyncModel: (m: VideoModel) => void
  onRequestLipSync: () => void
}) {
  const formatSpec = useFormatSpec()
  const [handoffOpen, setHandoffOpen] = useState(false)
  const stylePresetId = useProjectStore((s) => s.project?.stylePresetId ?? null)
  const styleNotes = useProjectStore((s) => s.project?.styleNotes ?? '')
  const updateStyleNotes = useProjectStore((s) => s.updateStyleNotes)
  const stylePreset = getStylePreset(stylePresetId)
  const stylePresetFragment = stylePreset?.promptFragment ?? null
  const stylePresetName = stylePreset?.name ?? null
  const composedMotionPrompt = buildVideoPrompt(
    scene.visualDescription,
    scene.cameraNotes,
    [stylePresetFragment ?? '', styleNotes],
  )
  const setActiveVideoVersion = useProjectStore((s) => s.setActiveVideoVersion)
  const importSceneClip = useProjectStore((s) => s.importSceneClip)
  const updateScene = useProjectStore((s) => s.updateScene)
  const status = useProjectStore((s) => s.sceneVideoStatus[scene.id])

  const n = String(index + 1)
  const generating = status?.generating === true
  const activeImage =
    scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ?? null
  const activeVideo =
    scene.videoVersions.find((v) => v.id === scene.activeVideoVersionId) ?? null
  const videoUrl = useBlobUrl(
    activeVideo?.blobPath ?? null,
    activeVideo?.mimeType,
  )
  const activeAudio =
    scene.audioVersions.find((v) => v.id === scene.activeAudioVersionId) ?? null
  const audioUrl = useBlobUrl(
    activeAudio?.blobPath ?? null,
    activeAudio?.mimeType,
  )
  const [narrationSeconds, setNarrationSeconds] = useState<number | null>(null)
  const [clipSeconds, setClipSeconds] = useState<number | null>(null)
  const setClipNarrationSilenced = useProjectStore(
    (s) => s.setClipNarrationSilenced,
  )
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const narrationRef = useRef<HTMLAudioElement | null>(null)
  // Lip-sync takes carry the narration INSIDE the clip's audio track —
  // the side player must not double it (15.16.3). The audio element stays
  // mounted (hidden, muted): it is also how narrationSeconds is measured.
  const narrationEmbedded = activeVideo?.embedsNarration === true
  // The user's own silencing (20.2) persists on the take — the premiere
  // and the export files follow the same flag.
  const narrationSilenced = activeVideo?.narrationSilenced === true
  const narrationQuiet = narrationEmbedded || narrationSilenced
  const clipFileRef = useRef<HTMLInputElement | null>(null)

  // Playing the clip drives the narration along with it: same start, same
  // seeks, pause together. The narration keeps its own player too, and the
  // mute toggle silences it without touching the clip's own sound.
  const syncNarrationTo = (video: HTMLVideoElement) => {
    const narration = narrationRef.current
    if (narration === null) return
    if (Math.abs(narration.currentTime - video.currentTime) > 0.25) {
      narration.currentTime = video.currentTime
    }
  }

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
      aria-label={`Scene ${n} animation workbench`}
      className="workbench-grid"
    >
      {/* Motion panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Scene {n} — motion</div>
        {/* If the start image is a carried-in frame, the undo lives HERE
            too — same stage as the carry button (21.2, Angel's call). */}
        <HandoffTakeNote scene={scene} />
        {/* THE PROMPT RECIPE (22, Angel's request): every ingredient of
            the motion prompt, in the order it is sent, editable where it
            lives — and the exact composed prompt below. */}
        {stylePresetFragment !== null && (
          <RecipeRow
            label="Artistic style"
            hint={`${stylePresetName ?? 'preset'} — change it on the Images stage`}
          >
            <RecipeFixedText text={stylePresetFragment} />
          </RecipeRow>
        )}
        <RecipeRow
          label="Style notes"
          hint="shared with every prompt in the project"
        >
          <textarea
            aria-label="Style notes"
            placeholder="Palette, medium, lighting — travels word for word into every prompt."
            value={styleNotes}
            onChange={(e) => {
              updateStyleNotes(e.target.value)
            }}
            rows={2}
            style={{
              width: '100%',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </RecipeRow>
        <RecipeRow label="Scene description" hint="the action of this shot">
          <SceneDescriptionEditor scene={scene} n={n} />
        </RecipeRow>
        <RecipeRow
          label="Camera direction"
          hint={
            <>
              optional — steers the motion prompt
              <CameraHelp />
            </>
          }
        >
          <textarea
            aria-label="Camera direction"
            placeholder="Say what the camera DOES: “static shot, fixed tripod, the framing never changes” · “slow push-in” · “pan left following the subject” — models ignore negations like “no zoom”."
            value={scene.cameraNotes}
            onChange={(e) => {
              updateScene(scene.id, { cameraNotes: e.target.value })
            }}
            rows={2}
            style={{
              width: '100%',
              resize: 'vertical',
              boxSizing: 'border-box',
            }}
          />
        </RecipeRow>
        <RecipeRow label="Always added" hint="Kairo's guardrails">
          <RecipeFixedText text="one continuous natural action · no frozen figures, no readable text or lettering · keep the style, palette, and composition of the image" />
        </RecipeRow>
        <ComposedPrompt
          label="The exact motion prompt, as sent"
          text={composedMotionPrompt}
          note="Using “Tweak” at generation time replaces this with your text, verbatim."
        />
        {/* The handoff (Slice 21; moved into the recipe in 22): the next
            shot can start exactly where this one ends — free. */}
        {nextScene !== null && activeVideo !== null && (
          <button
            type="button"
            onClick={() => {
              setHandoffOpen(true)
            }}
            style={{
              fontSize: 'var(--text-sm)',
              alignSelf: 'flex-start',
            }}
          >
            Carry final frame → scene {String(index + 2)}
          </button>
        )}
        {handoffOpen && nextScene !== null && activeVideo !== null && (
          <HandoffOverlay
            clipBlobPath={activeVideo.blobPath}
            fromN={index + 1}
            toScene={nextScene}
            toN={index + 2}
            onClose={() => {
              setHandoffOpen(false)
            }}
          />
        )}
        <p
          style={{
            margin: 0,
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          {model === null
            ? 'Pick a model to see its price. Resolution and duration are the main cost drivers — Kairo defaults to the cheapest resolution.'
            : describeClipPrice(model)}{' '}
          Generation can take a few minutes per clip — you can close the tab,
          Kairo resumes and collects finished clips when you return.
        </p>
      </div>

      {/* Animate panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Animate</div>
        <VideoModelPicker
          selectedId={model?.id ?? null}
          onSelect={onSelectModel}
        />
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
            alignItems: 'center',
          }}
        >
          <label>
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                marginRight: 'var(--space-2)',
              }}
            >
              Duration
            </span>
            {durationOptions.length > 0 ? (
              <select
                aria-label="Clip duration"
                value={duration ?? ''}
                onChange={(e) => {
                  onSelectDuration(e.target.value)
                }}
              >
                {durationOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            ) : (
              <span
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {model === null ? '—' : 'fixed by model'}
              </span>
            )}
          </label>
          {model?.frameControl != null &&
            (() => {
              const plan = planFrames(
                model.frameControl,
                Number(duration ?? '5') || 5,
              )
              return (
                <span
                  aria-label="Frame plan"
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  frame-based model: {String(plan.frames)} frames @{' '}
                  {String(plan.fps)} fps = {plan.seconds.toFixed(1)}s (lower fps
                  = choppier motion)
                </span>
              )
            })()}
          {narrationSeconds !== null && (
            <span
              aria-label="Narration duration"
              style={{
                color: 'var(--color-accent)',
                fontSize: 'var(--text-sm)',
              }}
            >
              narration runs {narrationSeconds.toFixed(1)}s — pick a clip
              duration to match
            </span>
          )}
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
            {resolutionOptions.length > 0 ? (
              <select
                aria-label="Video resolution"
                value={effectiveResolution ?? ''}
                onChange={(e) => {
                  onSelectResolution(e.target.value)
                }}
              >
                {resolutionOptions.map((r) => (
                  <option key={r} value={r}>
                    {resolutionLabel(r)}
                  </option>
                ))}
              </select>
            ) : (
              <span
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                {model === null ? '—' : 'fixed by model'}
              </span>
            )}
          </label>
        </div>
        {model !== null && model.durations.length === 0 && (
          <p
            style={{
              margin: 0,
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            This model does not take a clip length — every clip comes out at the
            length the model chooses, so Kairo sends no duration at all. The
            clip&apos;s real length shows beside it once it lands.
          </p>
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
            disabled={model === null || activeImage === null || generating}
            onClick={onRequestGenerate}
          >
            {generating
              ? 'Generating… (safe to close the tab)'
              : scene.videoVersions.length > 0
                ? 'Regenerate clip'
                : status?.error != null
                  ? 'Retry'
                  : 'Animate scene'}
          </button>
          {activeVideo?.costUsd != null && (
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              Cost: {formatUsd(activeVideo.costUsd)}
            </span>
          )}
        </div>
        {generating && (
          <FilmProgress label={`Scene ${n} animation generating`} />
        )}
        {status?.error != null && (
          <p role="alert" style={{ margin: 0, color: 'var(--color-danger)' }}>
            {status.error}
          </p>
        )}
        {/* Lip-sync (Slice 15.16): image + narration → talking clip. */}
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            paddingTop: 'var(--space-3)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)',
          }}
        >
          <div
            style={{
              fontSize: '11px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--color-text-muted)',
            }}
          >
            Lip-sync
          </div>
          <VideoModelPicker
            selectedId={lipSyncModel?.id ?? null}
            onSelect={onSelectLipSyncModel}
            onlyLipSync
            ariaLabel="Lip-sync model"
          />
          <p
            style={{
              margin: 0,
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Turns the scene image into a talking clip synced to the narration.
            Works when the image shows a person with a visible face — the
            clip&rsquo;s length follows the narration
            {narrationSeconds !== null
              ? ` (${narrationSeconds.toFixed(1)}s)`
              : ''}
            .
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
              aria-label={`Lip-sync scene ${n} narration`}
              disabled={
                lipSyncModel === null ||
                activeImage === null ||
                narrationSeconds === null ||
                generating
              }
              onClick={onRequestLipSync}
            >
              Lip-sync narration
            </button>
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {narrationSeconds === null
                ? 'Narrate the scene first (Audio stage).'
                : lipSyncModel === null
                  ? 'Pick a lip-sync model to see the price.'
                  : (() => {
                      const est = lipSyncEstimate(
                        lipSyncModel,
                        narrationSeconds,
                      )
                      return est.usd === null
                        ? `At ${est.resolution ?? 'default resolution'} — price varies, charged at submission.`
                        : `≈${formatUsd(est.usd)} at ${est.resolution ?? 'default resolution'} (cheapest), charged at submission.`
                    })()}
            </span>
          </div>
        </div>
        {pendingCount > 0 && (
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-3)',
            }}
          >
            <button
              type="button"
              disabled={model === null}
              onClick={onRequestAll}
            >
              {`Animate ${String(pendingCount)} remaining ${pendingCount === 1 ? 'scene' : 'scenes'}`}
            </button>
          </div>
        )}
      </div>

      {/* Clips panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Clips — scene {n}</div>
        {videoUrl !== null ? (
          <>
            <video
              // Keyed by take: a fresh clip develops into focus instead of
              // hard-swapping (ADR-013).
              key={activeVideo?.id}
              className="develop-in"
              ref={videoRef}
              src={videoUrl}
              controls
              aria-label={`Scene ${n} video`}
              onLoadedMetadata={(e) => {
                const seconds = e.currentTarget.duration
                setClipSeconds(Number.isFinite(seconds) ? seconds : null)
              }}
              onPlay={(e) => {
                if (narrationQuiet) return // the clip sings for itself
                syncNarrationTo(e.currentTarget)
                void narrationRef.current?.play().catch(() => undefined)
              }}
              onPause={() => {
                narrationRef.current?.pause()
              }}
              onSeeked={(e) => {
                if (narrationQuiet) return
                syncNarrationTo(e.currentTarget)
              }}
              onEnded={() => {
                narrationRef.current?.pause()
              }}
              style={{
                width: '10rem',
                aspectRatio: formatSpec.cssAspect,
                borderRadius: 'var(--radius)',
                background: 'var(--color-surface)',
                display: 'block',
                // Centered in the panel (15.17.5): a left-hugging clip
                // left a lopsided blank right half.
                margin: '0 auto',
              }}
            />
            {clipSeconds !== null && (
              <p
                aria-label={`Scene ${n} clip length`}
                style={{
                  margin: 0,
                  fontSize: 'var(--text-sm)',
                  color:
                    narrationSeconds !== null &&
                    Math.abs(clipSeconds - narrationSeconds) > 0.75
                      ? 'var(--color-accent)'
                      : 'var(--color-text-muted)',
                }}
              >
                clip runs {clipSeconds.toFixed(1)}s
                {!narrationEmbedded &&
                  narrationSeconds !== null &&
                  Math.abs(clipSeconds - narrationSeconds) > 0.75 &&
                  ` — the narration runs ${narrationSeconds.toFixed(1)}s, so it will be ${
                    clipSeconds < narrationSeconds
                      ? 'cut off'
                      : 'over before the clip ends'
                  }`}
              </p>
            )}
          </>
        ) : (
          <p
            style={{
              margin: 0,
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            No clip yet — the first animation lands here.
          </p>
        )}
        {scene.videoVersions.length > 1 && (
          <div
            style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}
          >
            {scene.videoVersions.map((version, vIndex) => (
              <button
                key={version.id}
                type="button"
                aria-label={`Scene ${n} clip ${String(vIndex + 1)}`}
                aria-pressed={version.id === scene.activeVideoVersionId}
                onClick={() => void setActiveVideoVersion(scene.id, version.id)}
                style={{
                  border:
                    version.id === scene.activeVideoVersionId
                      ? '2px solid var(--color-accent)'
                      : '1px solid var(--color-border)',
                  background:
                    version.id === scene.activeVideoVersionId
                      ? 'var(--color-accent-soft)'
                      : 'var(--color-surface)',
                  color: 'var(--color-text)',
                  padding: 'var(--space-1) var(--space-3)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                Clip {vIndex + 1}
              </button>
            ))}
          </div>
        )}
        {audioUrl !== null && (
          <div
            style={{
              borderTop: '1px solid var(--color-border)',
              paddingTop: 'var(--space-3)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 'var(--space-2)',
                marginBottom: narrationQuiet ? 0 : 'var(--space-2)',
              }}
            >
              <p style={{ margin: 0 }}>
                <strong style={{ fontSize: 'var(--text-sm)' }}>
                  Narration
                </strong>{' '}
                <span
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  {narrationEmbedded
                    ? '— embedded in this lip-sync clip'
                    : narrationSilenced
                      ? '— silenced for this take, here and in the export'
                      : '— plays along with the clip'}
                </span>
              </p>
              {!narrationEmbedded && (
                <button
                  type="button"
                  aria-label="Mute narration"
                  aria-pressed={narrationSilenced}
                  onClick={() => {
                    // Persisted on the take (20.2): a muted narration stays
                    // muted in the premiere and the export files too —
                    // Angel's lip-sync clip double-played before this.
                    if (activeVideo !== null) {
                      void setClipNarrationSilenced(
                        scene.id,
                        activeVideo.id,
                        !narrationSilenced,
                      )
                    }
                    if (narrationRef.current !== null) {
                      narrationRef.current.muted = !narrationSilenced
                      if (!narrationSilenced) narrationRef.current.pause()
                    }
                  }}
                  style={{
                    fontSize: 'var(--text-sm)',
                    padding: 'var(--space-1) var(--space-3)',
                  }}
                >
                  {narrationSilenced ? 'Unmute' : 'Mute'}
                </button>
              )}
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- generated narration of the scene's script excerpt, shown as text on the Audio stage */}
            <audio
              ref={narrationRef}
              src={audioUrl}
              controls={!narrationQuiet}
              muted={narrationQuiet}
              aria-label={`Scene ${n} narration`}
              onLoadedMetadata={(e) => {
                const seconds = e.currentTarget.duration
                if (Number.isFinite(seconds)) setNarrationSeconds(seconds)
              }}
              style={narrationQuiet ? { display: 'none' } : { width: '100%' }}
            />
          </div>
        )}
        <div>
          <input
            ref={clipFileRef}
            type="file"
            accept="video/*"
            aria-label={`Import a clip file for scene ${n}`}
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file !== undefined) {
                void importSceneClip(scene.id, file)
              }
              e.target.value = ''
            }}
          />
          <button
            type="button"
            onClick={() => clipFileRef.current?.click()}
            style={{ fontSize: 'var(--text-sm)' }}
          >
            Import clip
          </button>
          <span
            style={{
              marginLeft: 'var(--space-2)',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            — a video file from your computer becomes a take (free)
          </span>
        </div>
        <GenerationHistory
          versions={scene.videoVersions}
          activeVersionId={scene.activeVideoVersionId}
          label={`Scene ${n} clip`}
          onRegenerate={onRequestTweak}
          regenerateDisabled={
            model === null || activeImage === null || generating
          }
          regenerateDisabledHint={
            model === null
              ? 'Pick a video model first.'
              : activeImage === null
                ? 'The scene needs an active image first.'
                : 'A generation is already running for this scene.'
          }
          regenerateCostText="You will confirm the exact price before the job is submitted."
        />
      </div>
    </div>
  )
}

/**
 * "?" beside the camera field (15.13, Angel's ask): a short guide to
 * phrasing camera direction so models actually obey — assert what the
 * camera DOES; negations like "no zoom" are usually ignored or even
 * backfire (mentioning a concept makes it MORE likely to appear).
 */
function CameraHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        aria-label="Camera direction help"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="How to phrase camera direction"
        onClick={() => {
          setOpen(true)
        }}
        style={{
          width: '1.3rem',
          height: '1.3rem',
          padding: 0,
          borderRadius: '50%',
          border: '1px solid var(--color-border)',
          background: 'transparent',
          color: 'var(--color-text-muted)',
          fontSize: '11px',
          fontWeight: 700,
          lineHeight: 1,
          boxShadow: 'none',
          flexShrink: 0,
        }}
      >
        ?
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
              alignItems: 'center',
              justifyContent: 'center',
              padding: 'var(--space-6) var(--space-4)',
              cursor: 'zoom-out',
            }}
          >
            <div
              className="motion-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Camera direction guide"
              onClick={(e) => {
                e.stopPropagation()
              }}
              style={{
                width: 'min(30rem, 96vw)',
                background: 'var(--color-bg)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-card)',
                padding: 'var(--space-6)',
                cursor: 'default',
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--space-3)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
                Directing the camera
              </h3>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                Video models are bad at <strong>negations</strong>. &ldquo;No
                zoom&rdquo; asks the model to picture a zoom and then suppress
                it — mentioning the concept often makes it MORE likely to
                appear. They also lean toward adding motion, because static
                clips look like failures in their training data.
              </p>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                So assert what the camera <strong>does</strong>, as the only
                truth:
              </p>
              <p
                style={{
                  margin: 0,
                  padding: 'var(--space-3)',
                  borderRadius: 'var(--radius)',
                  background: 'var(--color-surface)',
                  border: '1px solid var(--color-border)',
                  lineHeight: 1.6,
                }}
              >
                &ldquo;Static shot. Fixed camera locked on a tripod. The framing
                never changes; only the subject moves.&rdquo;
              </p>
              <p style={{ margin: 0, lineHeight: 1.6 }}>
                The same applies to movement you DO want: &ldquo;slow
                push-in&rdquo;, &ldquo;pan left following the subject&rdquo;,
                &ldquo;drone pull-back revealing the valley&rdquo;. Adherence
                still varies by model — when a locked-off shot really matters, a
                retry or another model is sometimes the answer.
              </p>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false)
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}
