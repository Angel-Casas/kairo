import { useState } from 'react'
import type { VideoModel } from '../api/nanogpt'
import type { Scene } from '../domain/types'
import { formatUsd } from '../lib/format'
import { sortVideoResolutionsCheapestFirst } from '../lib/resolution'
import { useProjectStore } from '../state/project'
import { ConfirmDialog } from './ConfirmDialog'
import { GenerationHistory } from './GenerationHistory'
import { VideoModelPicker } from './ModelPicker'
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

export function AnimationStage() {
  const project = useProjectStore((s) => s.project)
  const generateAllVideos = useProjectStore((s) => s.generateAllVideos)
  const generateSceneVideo = useProjectStore((s) => s.generateSceneVideo)

  const [model, setModel] = useState<VideoModel | null>(null)
  const [duration, setDuration] = useState('5')
  const [resolution, setResolution] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<PendingConfirm | null>(null)

  if (project === null) return null
  const scenes = [...project.scenes].sort((a, b) => a.order - b.order)

  const resolutionOptions = sortVideoResolutionsCheapestFirst(
    model !== null && model.resolutions.length > 0
      ? model.resolutions
      : COMMON_RESOLUTIONS,
  )
  // Default to the CHEAPEST resolution — never let a provider default pick
  // an expensive tier silently (learned the hard way, see LESSONS.md).
  const effectiveResolution = resolution ?? resolutionOptions[0] ?? null

  const pendingCount = scenes.filter(
    (s) => s.activeImageVersionId !== null && s.videoVersions.length === 0,
  ).length

  const confirmMessage = (countLabel: string) =>
    model === null
      ? ''
      : `${countLabel} with ${model.name} at ${effectiveResolution ?? 'default resolution'}, ${duration}s. ${describeClipPrice(model)}`

  return (
    <section>
      <h3 style={{ fontSize: 'var(--text-lg)', marginTop: 0 }}>Animation</h3>

      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          padding: 'var(--space-4)',
          marginBottom: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)',
        }}
      >
        <h4 style={{ margin: 0 }}>Video model</h4>
        <VideoModelPicker
          selectedId={model?.id ?? null}
          onSelect={(m) => {
            setModel(m)
            setResolution(null)
          }}
        />
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-4)',
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
              Clip duration (seconds)
            </span>
            <select
              aria-label="Clip duration"
              value={duration}
              onChange={(e) => {
                setDuration(e.target.value)
              }}
            >
              {DURATIONS.map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>
          </label>
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
                setResolution(e.target.value)
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
        <p
          style={{
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
            margin: 0,
          }}
        >
          {model === null
            ? 'Pick a model to see its price. Resolution and duration are the main cost drivers — Kairo defaults to the cheapest resolution.'
            : describeClipPrice(model)}{' '}
          Generation can take a few minutes per clip — you can close the tab,
          Kairo resumes and collects finished clips when you return.
        </p>
        {pendingCount > 0 && (
          <div>
            <button
              type="button"
              disabled={model === null}
              onClick={() => {
                setConfirming({ type: 'all', count: pendingCount })
              }}
            >
              {`Animate ${String(pendingCount)} remaining ${pendingCount === 1 ? 'scene' : 'scenes'}`}
            </button>
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
            <SceneVideoCard
              key={scene.id}
              scene={scene}
              index={index}
              model={model}
              onRequestGenerate={() => {
                setConfirming({
                  type: 'one',
                  sceneId: scene.id,
                  label: `Animate scene ${String(index + 1)}`,
                })
              }}
            />
          ))}
        </ol>
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
              void generateAllVideos(model, duration, effectiveResolution)
            } else {
              void generateSceneVideo(
                pending.sceneId,
                model,
                duration,
                effectiveResolution,
              )
            }
          }}
          onCancel={() => {
            setConfirming(null)
          }}
        />
      )}
    </section>
  )
}

function SceneVideoCard({
  scene,
  index,
  model,
  onRequestGenerate,
}: {
  scene: Scene
  index: number
  model: VideoModel | null
  onRequestGenerate: () => void
}) {
  const setActiveVideoVersion = useProjectStore((s) => s.setActiveVideoVersion)
  const status = useProjectStore((s) => s.sceneVideoStatus[scene.id])

  const activeImage =
    scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ?? null
  const activeVideo =
    scene.videoVersions.find((v) => v.id === scene.activeVideoVersionId) ?? null
  const imageUrl = useBlobUrl(activeImage?.blobPath ?? null)
  const videoUrl = useBlobUrl(activeVideo?.blobPath ?? null)
  const generating = status?.generating === true

  return (
    <li
      aria-label={`Scene ${String(index + 1)} animation`}
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-3)',
        marginBottom: 'var(--space-3)',
        display: 'flex',
        gap: 'var(--space-4)',
      }}
    >
      <div style={{ width: '8rem', flexShrink: 0 }}>
        {imageUrl !== null ? (
          <img
            src={imageUrl}
            alt={`Scene ${String(index + 1)} source image`}
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
            No image — generate one on the Images stage
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
          {scene.visualDescription}
        </p>

        {videoUrl !== null && (
          <video
            src={videoUrl}
            controls
            aria-label={`Scene ${String(index + 1)} video`}
            style={{
              width: '10rem',
              aspectRatio: '9 / 16',
              borderRadius: 'var(--radius)',
              background: 'var(--color-surface)',
              display: 'block',
              marginBottom: 'var(--space-3)',
            }}
          />
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
          <p role="alert" style={{ color: 'var(--color-danger)' }}>
            {status.error}
          </p>
        )}

        {scene.videoVersions.length > 1 && (
          <div style={{ marginTop: 'var(--space-3)' }}>
            <span
              style={{
                color: 'var(--color-text-muted)',
                fontSize: 'var(--text-sm)',
                display: 'block',
                marginBottom: 'var(--space-1)',
              }}
            >
              Clip versions (click to make active)
            </span>
            <div
              style={{
                display: 'flex',
                gap: 'var(--space-2)',
                flexWrap: 'wrap',
              }}
            >
              {scene.videoVersions.map((version, vIndex) => (
                <button
                  key={version.id}
                  type="button"
                  aria-label={`Scene ${String(index + 1)} clip ${String(vIndex + 1)}`}
                  aria-pressed={version.id === scene.activeVideoVersionId}
                  onClick={() =>
                    void setActiveVideoVersion(scene.id, version.id)
                  }
                  style={{
                    border:
                      version.id === scene.activeVideoVersionId
                        ? '2px solid var(--color-accent)'
                        : '1px solid var(--color-border)',
                    borderRadius: 'var(--radius)',
                    background: 'var(--color-surface)',
                    color: 'var(--color-text)',
                    padding: 'var(--space-1) var(--space-2)',
                    cursor: 'pointer',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  Clip {vIndex + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        <GenerationHistory
          versions={scene.videoVersions}
          activeVersionId={scene.activeVideoVersionId}
          label={`Scene ${String(index + 1)} clip`}
        />
      </div>
    </li>
  )
}
