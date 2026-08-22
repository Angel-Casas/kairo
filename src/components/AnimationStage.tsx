import { useRef, useState, type CSSProperties } from 'react'
import type { VideoModel } from '../api/nanogpt'
import type { Scene } from '../domain/types'
import { formatUsd } from '../lib/format'
import { sortVideoResolutionsCheapestFirst } from '../lib/resolution'
import { useProjectStore } from '../state/project'
import { ConfirmDialog } from './ConfirmDialog'
import { GenerationHistory } from './GenerationHistory'
import { Lightbox, type LightboxItem } from './Lightbox'
import { VideoModelPicker } from './ModelPicker'
import { ReelShell } from './Reel'
import { useBlobUrl } from './useBlobUrl'

const DURATIONS = ['5', '8', '10']
/** Offered when a model does not advertise its supported resolutions. */
const COMMON_RESOLUTIONS = ['480p', '720p', '1080p']

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
  | { type: 'one'; sceneId: string; label: string }
  | { type: 'all'; count: number }
  | { type: 'tweak'; sceneId: string; label: string; prompt: string }

/**
 * The Animation stage as a reel (ADR-011): frames show each scene's source
 * image with a clip badge once animated; the workbench below plays and
 * regenerates the selected scene's clip. Every submission still passes the
 * cost-confirmation dialog (Slice 6.1) — video is the expensive kind.
 */
export function AnimationStage() {
  const project = useProjectStore((s) => s.project)
  const generateAllVideos = useProjectStore((s) => s.generateAllVideos)
  const generateSceneVideo = useProjectStore((s) => s.generateSceneVideo)

  const [model, setModel] = useState<VideoModel | null>(null)
  const [duration, setDuration] = useState('5')
  const [resolution, setResolution] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null)
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

  const resolutionOptions = sortVideoResolutionsCheapestFirst(
    model !== null && model.resolutions.length > 0
      ? model.resolutions
      : COMMON_RESOLUTIONS,
  )
  // Default to the CHEAPEST resolution — never let a provider default pick
  // an expensive tier silently (learned the hard way, see LESSONS.md).
  const effectiveResolution = resolution ?? resolutionOptions[0] ?? null
  // When the model advertises its supported durations, offer exactly those —
  // asking for a length a model can't make just gets silently clamped
  // server-side (an "8s" request coming back as a 5s clip).
  const durationOptions =
    model !== null && model.durations.length > 0 ? model.durations : DURATIONS
  const effectiveDuration = durationOptions.includes(duration)
    ? duration
    : (durationOptions[0] ?? duration)

  const pendingCount = scenes.filter(
    (s) => s.activeImageVersionId !== null && s.videoVersions.length === 0,
  ).length

  const confirmMessage = (countLabel: string) =>
    model === null
      ? ''
      : `${countLabel} with ${model.name} at ${effectiveResolution ?? 'default resolution'}, ${effectiveDuration}s. ${describeClipPrice(model)}`

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
        narrationBlobPath: narration?.blobPath,
        narrationMimeType: narration?.mimeType,
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
      <ReelShell hint="select a frame to animate it below">
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
            setConfirming({
              type: 'one',
              sceneId: selectedScene.id,
              label: `Animate scene ${String(selectedIndex + 1)}`,
            })
          }}
          onRequestTweak={(prompt) => {
            setConfirming({
              type: 'tweak',
              sceneId: selectedScene.id,
              label: `Animate scene ${String(selectedIndex + 1)} with the edited motion prompt`,
              prompt,
            })
          }}
          onRequestAll={() => {
            setConfirming({ type: 'all', count: pendingCount })
          }}
        />
      )}

      {confirming !== null && model !== null && (
        <ConfirmDialog
          title={
            confirming.type === 'all'
              ? `Animate ${String(confirming.count)} ${confirming.count === 1 ? 'scene' : 'scenes'}?`
              : `${confirming.label}?`
          }
          message={confirmMessage(
            confirming.type === 'all'
              ? `This submits ${String(confirming.count)} video ${confirming.count === 1 ? 'job' : 'jobs'}`
              : 'This submits one video job',
          )}
          confirmLabel="Submit and charge"
          onConfirm={() => {
            const pending = confirming
            setConfirming(null)
            if (pending.type === 'all') {
              void generateAllVideos(
                model,
                effectiveDuration,
                effectiveResolution,
              )
            } else if (pending.type === 'tweak') {
              void generateSceneVideo(
                pending.sceneId,
                model,
                effectiveDuration,
                effectiveResolution,
                pending.prompt,
              )
            } else {
              void generateSceneVideo(
                pending.sceneId,
                model,
                effectiveDuration,
                effectiveResolution,
              )
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
      }}
    >
      <button
        type="button"
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
              aspectRatio: '9 / 16',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div
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
}: {
  scene: Scene
  index: number
  model: VideoModel | null
  onSelectModel: (m: VideoModel) => void
  duration: string
  durationOptions: string[]
  onSelectDuration: (d: string) => void
  effectiveResolution: string | null
  resolutionOptions: string[]
  onSelectResolution: (r: string) => void
  pendingCount: number
  onRequestGenerate: () => void
  onRequestTweak: (prompt: string) => void
  onRequestAll: () => void
}) {
  const setActiveVideoVersion = useProjectStore((s) => s.setActiveVideoVersion)
  const importSceneClip = useProjectStore((s) => s.importSceneClip)
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
  const [narrationMuted, setNarrationMuted] = useState(false)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const narrationRef = useRef<HTMLAudioElement | null>(null)
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
      style={{
        display: 'grid',
        gridTemplateColumns: '1.2fr 1fr 1fr',
        gap: 'var(--space-4)',
        alignItems: 'start',
      }}
    >
      {/* Motion panel */}
      <div className="card" style={panel}>
        <div style={panelTitle}>Scene {n} — motion</div>
        <p style={{ margin: 0, lineHeight: 1.6 }}>{scene.visualDescription}</p>
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
            <select
              aria-label="Clip duration"
              value={duration}
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
          </label>
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
            <select
              aria-label="Video resolution"
              value={effectiveResolution ?? ''}
              onChange={(e) => {
                onSelectResolution(e.target.value)
              }}
            >
              {resolutionOptions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
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
            This model does not publish which lengths it supports — if it cannot
            make a {duration}s clip it produces the nearest length it can. The
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
        {status?.error != null && (
          <p role="alert" style={{ margin: 0, color: 'var(--color-danger)' }}>
            {status.error}
          </p>
        )}
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
              ref={videoRef}
              src={videoUrl}
              controls
              aria-label={`Scene ${n} video`}
              onLoadedMetadata={(e) => {
                const seconds = e.currentTarget.duration
                setClipSeconds(Number.isFinite(seconds) ? seconds : null)
              }}
              onPlay={(e) => {
                syncNarrationTo(e.currentTarget)
                void narrationRef.current?.play().catch(() => undefined)
              }}
              onPause={() => {
                narrationRef.current?.pause()
              }}
              onSeeked={(e) => {
                syncNarrationTo(e.currentTarget)
              }}
              onEnded={() => {
                narrationRef.current?.pause()
              }}
              style={{
                width: '10rem',
                aspectRatio: '9 / 16',
                borderRadius: 'var(--radius)',
                background: 'var(--color-surface)',
                display: 'block',
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
                {narrationSeconds !== null &&
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
                marginBottom: 'var(--space-2)',
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
                  — plays along with the clip
                </span>
              </p>
              <button
                type="button"
                aria-label="Mute narration"
                aria-pressed={narrationMuted}
                onClick={() => {
                  const next = !narrationMuted
                  setNarrationMuted(next)
                  if (narrationRef.current !== null) {
                    narrationRef.current.muted = next
                  }
                }}
                style={{
                  fontSize: 'var(--text-sm)',
                  padding: 'var(--space-1) var(--space-3)',
                }}
              >
                {narrationMuted ? 'Unmute' : 'Mute'}
              </button>
            </div>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption -- generated narration of the scene's script excerpt, shown as text on the Audio stage */}
            <audio
              ref={narrationRef}
              src={audioUrl}
              controls
              muted={narrationMuted}
              aria-label={`Scene ${n} narration`}
              onLoadedMetadata={(e) => {
                const seconds = e.currentTarget.duration
                if (Number.isFinite(seconds)) setNarrationSeconds(seconds)
              }}
              style={{ width: '100%' }}
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
