import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { VideoModel } from '../api/nanogpt'
import type { Scene } from '../domain/types'
import { audioBlobDuration } from '../lib/audioBlob'
import { pickClipDuration } from '../lib/clipDuration'
import { FilmProgress } from './FilmProgress'
import { formatUsd } from '../lib/format'
import { sortVideoResolutionsCheapestFirst } from '../lib/resolution'
import { getRepository } from '../state/repo'
import { useBlobUrl } from './useBlobUrl'

/**
 * Pre-flight overlay for "Animate X remaining scenes" (Slice 15.12, from
 * Angel's feedback): instead of a blind confirm, every pending scene gets
 * a row — thumbnail, its text, its narration length — with its OWN model
 * and duration inputs. Durations arrive PRE-FITTED to each narration
 * (15.11's rule: smallest offered length that covers it), and any row can
 * be overridden before one Submit charges the lot.
 */

export interface BatchItem {
  sceneId: string
  model: VideoModel
  /** null = the model takes no clip length; nothing is sent (15.15). */
  duration: string | null
  resolution: string | null
}

/**
 * An empty listing means the model does not TAKE that parameter — no
 * fallback options, no fabricated field (15.15, LESSONS).
 */
function durationOptionsFor(model: VideoModel): string[] {
  return model.durations
}

/** Cheapest valid resolution for the model, honoring the global pick. */
function resolutionFor(
  model: VideoModel,
  globalResolution: string | null,
): string | null {
  if (model.resolutions.length === 0) return null
  const options = sortVideoResolutionsCheapestFirst(model.resolutions)
  if (globalResolution !== null && options.includes(globalResolution)) {
    return globalResolution
  }
  return options[0] ?? null
}

function fitDuration(
  model: VideoModel,
  narrationSeconds: number | null,
  globalDuration: string | null,
): string | null {
  const options = durationOptionsFor(model)
  if (options.length === 0) return null // fixed-length model
  const fallback =
    globalDuration !== null && options.includes(globalDuration)
      ? globalDuration
      : (options[0] ?? null)
  if (fallback === null) return null
  return pickClipDuration(options, narrationSeconds, fallback)
}

export function AnimateBatchOverlay({
  scenes,
  sceneNumbers,
  defaultModel,
  models,
  globalDuration,
  globalResolution,
  onSubmit,
  onCancel,
}: {
  /** Pending scenes only (image present, no clip yet), reel order. */
  scenes: Scene[]
  /** Scene id → 1-based number in the full reel. */
  sceneNumbers: Map<string, number>
  defaultModel: VideoModel
  /** The image-to-video catalog for per-row overrides. */
  models: VideoModel[]
  globalDuration: string | null
  globalResolution: string | null
  onSubmit: (items: BatchItem[]) => void
  onCancel: () => void
}) {
  const [narration, setNarration] = useState<Record<string, number | null>>({})
  const [measured, setMeasured] = useState(false)
  const [rows, setRows] = useState<
    Record<string, { modelId: string; duration: string | null }>
  >({})

  // Measure every pending scene's narration once, then pre-fit durations.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const repo = await getRepository()
      const seconds: Record<string, number | null> = {}
      for (const scene of scenes) {
        const active = scene.audioVersions.find(
          (v) => v.id === scene.activeAudioVersionId,
        )
        if (active === undefined) {
          seconds[scene.id] = null
          continue
        }
        const blob = await repo.blobs.get(active.blobPath)
        seconds[scene.id] = blob === null ? null : await audioBlobDuration(blob)
      }
      if (cancelled) return
      setNarration(seconds)
      setRows(
        Object.fromEntries(
          scenes.map((scene) => [
            scene.id,
            {
              modelId: defaultModel.id,
              duration: fitDuration(
                defaultModel,
                seconds[scene.id] ?? null,
                globalDuration,
              ),
            },
          ]),
        ),
      )
      setMeasured(true)
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- measure once per open
  }, [])

  const modelById = (id: string): VideoModel =>
    models.find((m) => m.id === id) ?? defaultModel

  const items: BatchItem[] = scenes.map((scene) => {
    const row = rows[scene.id]
    const model = modelById(row?.modelId ?? defaultModel.id)
    return {
      sceneId: scene.id,
      model,
      duration:
        row?.duration ??
        fitDuration(model, narration[scene.id] ?? null, globalDuration),
      resolution: resolutionFor(model, globalResolution),
    }
  })

  // Exact-honesty estimate: sum of each row model's advertised range.
  const ranges = items.map((i) => i.model.priceRangeUsd)
  const totalEstimate = ranges.some((r) => r === null)
    ? null
    : {
        min: ranges.reduce((s, r) => s + (r?.min ?? 0), 0),
        max: ranges.reduce((s, r) => s + (r?.max ?? 0), 0),
      }

  return createPortal(
    <div
      className="motion-veil"
      onClick={onCancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 12,
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: 'var(--space-6) var(--space-4)',
        cursor: 'zoom-out',
      }}
    >
      <div
        className="motion-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Animate remaining scenes"
        onClick={(e) => {
          e.stopPropagation()
        }}
        style={{
          width: 'min(46rem, 96vw)',
          maxHeight: '86vh',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--color-bg)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: 'var(--shadow-card)',
          overflow: 'hidden',
          cursor: 'default',
        }}
      >
        <div
          style={{
            padding: 'var(--space-4) var(--space-6)',
            borderBottom: '1px solid var(--color-border)',
          }}
        >
          <h3 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
            Animate {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
          </h3>
          <p
            style={{
              margin: 'var(--space-1) 0 0',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Durations are pre-fitted to each scene&rsquo;s narration — tweak any
            row before submitting.
          </p>
        </div>

        <div
          style={{
            overflowY: 'auto',
            minHeight: 0,
            padding: 'var(--space-3) var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-3)',
          }}
        >
          {scenes.map((scene) => {
            const n = String(sceneNumbers.get(scene.id) ?? 0)
            const row = rows[scene.id]
            const rowModel = modelById(row?.modelId ?? defaultModel.id)
            const seconds = narration[scene.id] ?? null
            return (
              <BatchRow
                key={scene.id}
                scene={scene}
                n={n}
                model={rowModel}
                models={models}
                duration={
                  row?.duration ??
                  fitDuration(rowModel, seconds, globalDuration)
                }
                narrationSeconds={seconds}
                measured={measured}
                onModel={(id) => {
                  const next = modelById(id)
                  setRows((prev) => ({
                    ...prev,
                    [scene.id]: {
                      modelId: id,
                      // Model switch re-fits the duration to the narration.
                      duration: fitDuration(next, seconds, globalDuration),
                    },
                  }))
                }}
                onDuration={(d) => {
                  setRows((prev) => ({
                    ...prev,
                    [scene.id]: {
                      modelId: prev[scene.id]?.modelId ?? defaultModel.id,
                      duration: d,
                    },
                  }))
                }}
              />
            )
          })}
        </div>

        <div
          style={{
            padding: 'var(--space-3) var(--space-6)',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
            flexWrap: 'wrap',
          }}
        >
          {!measured && (
            <div style={{ flexBasis: '100%' }}>
              <FilmProgress label="Measuring narrations" />
            </div>
          )}
          <span
            style={{
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            {totalEstimate === null
              ? 'Some prices vary — each job is charged at submission.'
              : totalEstimate.min === totalEstimate.max
                ? `≈${formatUsd(totalEstimate.min)} total, charged at submission.`
                : `≈${formatUsd(totalEstimate.min)}–${formatUsd(totalEstimate.max)} total, charged at submission.`}
          </span>
          <span style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <button type="button" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="primary"
              disabled={!measured}
              onClick={() => {
                onSubmit(items)
              }}
            >
              {measured
                ? `Submit ${String(scenes.length)} ${scenes.length === 1 ? 'job' : 'jobs'} and charge`
                : 'Measuring narrations…'}
            </button>
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function BatchRow({
  scene,
  n,
  model,
  models,
  duration,
  narrationSeconds,
  measured,
  onModel,
  onDuration,
}: {
  scene: Scene
  n: string
  model: VideoModel
  models: VideoModel[]
  duration: string | null
  narrationSeconds: number | null
  measured: boolean
  onModel: (modelId: string) => void
  onDuration: (duration: string) => void
}) {
  const still =
    scene.imageVersions.find((v) => v.id === scene.activeImageVersionId) ?? null
  const thumbUrl = useBlobUrl(still?.blobPath ?? null, still?.mimeType)
  const options = durationOptionsFor(model)

  return (
    <div
      aria-label={`Scene ${n} batch row`}
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 'var(--space-3)',
        alignItems: 'center',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        padding: 'var(--space-2) var(--space-3)',
      }}
    >
      {thumbUrl !== null ? (
        <img
          src={thumbUrl}
          alt={`Scene ${n} still`}
          style={{
            width: '3.2rem',
            aspectRatio: '9 / 16',
            objectFit: 'cover',
            borderRadius: 'var(--radius)',
            flexShrink: 0,
            background: 'var(--color-surface)',
          }}
        />
      ) : (
        <div
          aria-hidden="true"
          style={{
            width: '3.2rem',
            aspectRatio: '9 / 16',
            borderRadius: 'var(--radius)',
            flexShrink: 0,
            background: 'var(--color-surface)',
          }}
        />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          <strong>Scene {n}</strong>{' '}
          <span style={{ color: 'var(--color-text-muted)' }}>
            {scene.textExcerpt.trim() || scene.visualDescription.trim()}
          </span>
        </div>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color:
              narrationSeconds !== null
                ? 'var(--color-accent)'
                : 'var(--color-text-muted)',
          }}
        >
          {!measured
            ? 'measuring narration…'
            : narrationSeconds !== null
              ? `♪ narration ${narrationSeconds.toFixed(1)}s`
              : 'no narration'}
        </div>
      </div>
      <label style={{ flexShrink: 0 }}>
        <select
          aria-label={`Scene ${n} model`}
          value={model.id}
          onChange={(e) => {
            onModel(e.target.value)
          }}
          style={{ maxWidth: '11rem' }}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id} title={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </label>
      {options.length > 0 && duration !== null ? (
        <label style={{ flexShrink: 0 }}>
          <select
            aria-label={`Scene ${n} duration`}
            value={duration}
            onChange={(e) => {
              onDuration(e.target.value)
            }}
          >
            {options.map((d) => (
              <option key={d} value={d}>
                {d}s
              </option>
            ))}
          </select>
        </label>
      ) : (
        <span
          aria-label={`Scene ${n} duration`}
          style={{
            flexShrink: 0,
            color: 'var(--color-text-muted)',
            fontSize: 'var(--text-sm)',
          }}
        >
          fixed length
        </span>
      )}
    </div>
  )
}
