import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  extractFinalFrames,
  sharpestIndex,
  type GrabbedFrame,
} from '../lib/frameGrab'
import { useFormatSpec } from './useFormatSpec'
import { useProjectStore } from '../state/project'
import { getRepository } from '../state/repo'
import type { Scene } from '../domain/types'

/**
 * The handoff (Slice 21): pick the cleanest of a clip's closing frames
 * and save it as the NEXT scene's image — so the next shot starts exactly
 * where this one ended. Client-side and free: a hidden video + canvas
 * reads the frames; nothing is generated or uploaded. The literal last
 * frame is often blurred mid-motion, so the sharpest candidate is
 * suggested and the user has the final say.
 */
export function HandoffOverlay({
  clipBlobPath,
  fromN,
  toScene,
  toN,
  onClose,
}: {
  clipBlobPath: string
  fromN: number
  toScene: Scene
  toN: number
  onClose: () => void
}) {
  const formatSpec = useFormatSpec()
  const addSceneImageVersion = useProjectStore((s) => s.addSceneImageVersion)
  const [frames, setFrames] = useState<GrabbedFrame[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<number | null>(null)
  const [urls, setUrls] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    let objectUrls: string[] = []
    getRepository()
      .then((repo) => repo.blobs.get(clipBlobPath))
      .then((blob) => {
        if (blob === null) throw new Error('The clip could not be loaded.')
        return extractFinalFrames(blob)
      })
      .then((grabbed) => {
        if (cancelled) return
        objectUrls = grabbed.map((f) => URL.createObjectURL(f.blob))
        setFrames(grabbed)
        setUrls(objectUrls)
        setPicked(sharpestIndex(grabbed))
      })
      .catch((e: unknown) => {
        if (cancelled) return
        setError(
          e instanceof Error
            ? e.message
            : 'The clip could not be read for frames.',
        )
      })
    return () => {
      cancelled = true
      for (const url of objectUrls) URL.revokeObjectURL(url)
    }
  }, [clipBlobPath])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose])

  const suggested = frames === null ? null : sharpestIndex(frames)

  const save = async () => {
    if (frames === null || picked === null) return
    const frame = frames[picked]
    if (frame === undefined) return
    setSaving(true)
    const ok = await addSceneImageVersion(
      toScene.id,
      frame.blob,
      `Handoff frame from scene ${String(fromN)} (${frame.time.toFixed(2)}s)`,
    )
    setSaving(false)
    if (ok) onClose()
  }

  return createPortal(
    <div
      className="motion-veil"
      onClick={onClose}
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
        overflowY: 'auto',
      }}
    >
      <div
        className="motion-dialog card"
        role="dialog"
        aria-modal="true"
        aria-label="Carry a frame forward"
        onClick={(e) => {
          e.stopPropagation()
        }}
        style={{
          width: 'min(42rem, 96vw)',
          padding: 'var(--space-6)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-4)',
        }}
      >
        <div>
          <div
            style={{
              fontSize: 'var(--text-sm)',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--color-accent)',
              fontWeight: 700,
            }}
          >
            The handoff
          </div>
          <h3 style={{ margin: 'var(--space-1) 0 0' }}>
            Scene {fromN} hands the frame to scene {toN}
          </h3>
          <p
            style={{
              margin: 'var(--space-2) 0 0',
              color: 'var(--color-text-muted)',
              fontSize: 'var(--text-sm)',
            }}
          >
            Pick the cleanest of the clip&rsquo;s closing frames — the sharpest
            is suggested; the very last one is often mid-motion. It becomes
            scene {toN}&rsquo;s image, ready to animate from, so the next shot
            starts exactly where this one ended. Free — nothing is generated,
            and you can remove it any time from scene {toN}&rsquo;s takes on the
            Images stage.
          </p>
        </div>

        {error !== null ? (
          <p role="alert" style={{ margin: 0, color: 'var(--color-danger)' }}>
            {error}
          </p>
        ) : frames === null ? (
          <p style={{ margin: 0, color: 'var(--color-text-muted)' }}>
            Reading the clip&rsquo;s closing frames…
          </p>
        ) : (
          <div
            role="radiogroup"
            aria-label="Closing frames"
            style={{
              display: 'flex',
              gap: 'var(--space-2)',
              overflowX: 'auto',
              paddingBottom: 'var(--space-1)',
            }}
          >
            {frames.map((frame, i) => (
              <button
                key={frame.time}
                type="button"
                role="radio"
                aria-checked={picked === i}
                aria-label={`Frame at ${frame.time.toFixed(2)}s${
                  suggested === i ? ' (suggested)' : ''
                }`}
                onClick={() => {
                  setPicked(i)
                }}
                style={{
                  padding: 0,
                  position: 'relative',
                  flexShrink: 0,
                  width: formatSpec.ratio > 1 ? '9rem' : '5.5rem',
                  border:
                    picked === i
                      ? '2px solid var(--color-accent)'
                      : '1px solid var(--color-border)',
                  borderRadius: 'var(--radius)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  background: 'var(--color-surface)',
                }}
              >
                <img
                  src={urls[i]}
                  alt=""
                  style={{
                    width: '100%',
                    aspectRatio: formatSpec.cssAspect,
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                {suggested === i && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '4px',
                      left: '4px',
                      fontSize: '10px',
                      fontWeight: 700,
                      letterSpacing: '0.06em',
                      padding: '1px 6px',
                      borderRadius: 'var(--radius-pill)',
                      background: 'var(--color-accent-soft)',
                      color: 'var(--color-text)',
                    }}
                  >
                    sharpest
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <button
            type="button"
            className="primary"
            disabled={frames === null || picked === null || saving}
            onClick={() => {
              void save()
            }}
          >
            {saving ? 'Saving…' : `Use as scene ${String(toN)}'s image`}
          </button>
          <button type="button" onClick={onClose}>
            Never mind
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
