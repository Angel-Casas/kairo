import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { useBlobUrl } from './useBlobUrl'

export interface LightboxItem {
  blobPath: string
  /** Stored asset mime type — OPFS strips it, players need it back. */
  mimeType?: string
  alt: string
  kind: 'image' | 'video'
  /** Caption plate, e.g. "Scene 3". */
  title?: string
  /** The visual description (image prompt basis), shown on the media. */
  prompt?: string
  /** The script excerpt the scene narrates. */
  excerpt?: string
  /**
   * The scene's narration take (video items): it plays in sync with the
   * clip in the viewer, with its own mute toggle.
   */
  narrationBlobPath?: string
  narrationMimeType?: string
}

/**
 * Fullscreen media viewer: a dark veil with the image or clip at its natural
 * best size. Arrow keys (or the side buttons) move between the scenes'
 * media; clicking anywhere outside the media (or pressing Escape) returns
 * to the page, while clicking the media itself does nothing so a stray
 * click while studying it never throws the viewer out.
 */
export function Lightbox({
  items,
  startIndex,
  onClose,
}: {
  items: LightboxItem[]
  startIndex: number
  onClose: () => void
}) {
  const [index, setIndex] = useState(startIndex)
  const item = items[Math.min(index, items.length - 1)]
  const url = useBlobUrl(item?.blobPath ?? null, item?.mimeType)
  const narrationUrl = useBlobUrl(
    item?.narrationBlobPath ?? null,
    item?.narrationMimeType,
  )
  const narrationRef = useRef<HTMLAudioElement | null>(null)
  const [narrationMuted, setNarrationMuted] = useState(false)
  const hasPrev = index > 0
  const hasNext = index < items.length - 1

  // Keep the narration locked to the clip: same start, same seeks, pause
  // together — and when the (looping) clip wraps past the narration's end,
  // the drift check restarts it from the top on the next lap. The narration
  // is shorter or longer than the clip at times, so never let a finished
  // take restart mid-lap.
  const syncNarration = (video: HTMLVideoElement) => {
    const narration = narrationRef.current
    if (narration === null) return
    const withinTake = Number.isFinite(narration.duration)
      ? video.currentTime < narration.duration - 0.2
      : true
    if (
      withinTake &&
      Math.abs(narration.currentTime - video.currentTime) > 0.4
    ) {
      narration.currentTime = video.currentTime
    }
    if (!video.paused && withinTake && narration.paused) {
      void narration.play().catch(() => undefined)
    }
    if ((video.paused || !withinTake) && !narration.paused) {
      narration.pause()
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowLeft') {
        setIndex((i) => Math.max(0, i - 1))
      }
      if (event.key === 'ArrowRight') {
        setIndex((i) => Math.min(items.length - 1, i + 1))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onClose, items.length])

  if (item === undefined) return null

  const mediaStyle: CSSProperties = {
    // Fill the viewer's height regardless of the source resolution — the
    // point of the lightbox is BIG — while staying inside the viewport.
    height: '92vh',
    width: 'auto',
    maxWidth: '86vw',
    objectFit: 'contain',
    borderRadius: '16px',
    border: '1px solid var(--color-border)',
    boxShadow: '0 30px 80px rgba(0, 0, 0, 0.6)',
    cursor: 'default',
  }
  const navStyle: CSSProperties = {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '46px',
    height: '46px',
    padding: 0,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0, 0, 0, 0.55)',
    border: '1px solid rgba(255, 255, 255, 0.4)',
    color: '#ffffff',
    fontSize: '20px',
    cursor: 'pointer',
  }

  // Portaled to <body>: the lightbox renders inside a stage whose entrance
  // animation applies a transform, and a transformed ancestor traps
  // position:fixed — the veil would cover the stage, not the screen.
  return createPortal(
    <div
      className="motion-veil"
      role="dialog"
      aria-modal="true"
      aria-label={item.alt}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10,
        background: 'rgba(0, 0, 0, 0.82)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'zoom-out',
      }}
    >
      {url !== null && (
        <div
          // Keyed by the asset: paging to another scene re-develops the
          // print rather than hard-swapping pixels (ADR-013).
          key={item.blobPath}
          className="develop-in"
          onClick={(e) => {
            e.stopPropagation()
          }}
          style={{ position: 'relative', display: 'inline-block' }}
        >
          {item.kind === 'video' ? (
            <video
              src={url}
              controls
              autoPlay
              loop
              aria-label={item.alt}
              onPlay={(e) => {
                syncNarration(e.currentTarget)
              }}
              onPause={(e) => {
                syncNarration(e.currentTarget)
              }}
              onSeeked={(e) => {
                syncNarration(e.currentTarget)
              }}
              onTimeUpdate={(e) => {
                syncNarration(e.currentTarget)
              }}
              onEnded={() => {
                narrationRef.current?.pause()
              }}
              style={mediaStyle}
            />
          ) : (
            <img src={url} alt={item.alt} style={mediaStyle} />
          )}
          {item.kind === 'video' && narrationUrl !== null && (
            <>
              <audio
                ref={narrationRef}
                src={narrationUrl}
                muted={narrationMuted}
                aria-label={`${item.title ?? 'Scene'} narration (plays with the clip)`}
              />
              <button
                type="button"
                aria-label="Mute narration"
                aria-pressed={narrationMuted}
                onClick={(e) => {
                  e.stopPropagation()
                  const next = !narrationMuted
                  setNarrationMuted(next)
                  if (narrationRef.current !== null) {
                    narrationRef.current.muted = next
                  }
                }}
                style={{
                  position: 'absolute',
                  right: 'var(--space-4)',
                  top: 'var(--space-4)',
                  // Above the caption drape, which is a later sibling.
                  zIndex: 1,
                  padding: 'var(--space-1) var(--space-3)',
                  background: 'rgba(0, 0, 0, 0.55)',
                  border: '1px solid rgba(255, 255, 255, 0.4)',
                  color: '#ffffff',
                  fontSize: 'var(--text-sm)',
                  cursor: 'pointer',
                }}
              >
                {narrationMuted ? '♪ Unmute narration' : '♪ Mute narration'}
              </button>
            </>
          )}
          {(item.prompt != null || item.excerpt != null) && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                // Clips keep their bottom edge free for the player controls —
                // their caption drapes from the top instead.
                ...(item.kind === 'video'
                  ? {
                      top: 0,
                      borderRadius: '16px 16px 0 0',
                      background:
                        'linear-gradient(rgba(0, 0, 0, 0.72), transparent)',
                      paddingBottom: 'var(--space-8)',
                    }
                  : {
                      bottom: 0,
                      borderRadius: '0 0 16px 16px',
                      background:
                        'linear-gradient(transparent, rgba(0, 0, 0, 0.72))',
                      paddingTop: 'var(--space-8)',
                    }),
                padding: 'var(--space-4)',
                color: '#ffffff',
                cursor: 'default',
              }}
            >
              {item.title != null && (
                <div
                  style={{
                    fontSize: '12px',
                    letterSpacing: '0.14em',
                    textTransform: 'uppercase',
                    color: 'rgba(255, 255, 255, 0.75)',
                    marginBottom: 'var(--space-1)',
                  }}
                >
                  {item.title}
                </div>
              )}
              {item.prompt != null && item.prompt.length > 0 && (
                <div style={{ lineHeight: 1.5 }}>{item.prompt}</div>
              )}
              {item.excerpt != null && item.excerpt.length > 0 && (
                <div
                  style={{
                    marginTop: 'var(--space-1)',
                    fontSize: 'var(--text-sm)',
                    color: 'rgba(255, 255, 255, 0.75)',
                    fontStyle: 'italic',
                  }}
                >
                  “{item.excerpt}”
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {items.length > 1 && (
        <>
          <button
            type="button"
            aria-label="Previous scene"
            disabled={!hasPrev}
            onClick={(e) => {
              e.stopPropagation()
              setIndex((i) => Math.max(0, i - 1))
            }}
            style={{ ...navStyle, left: 'var(--space-4)' }}
          >
            ‹
          </button>
          <button
            type="button"
            aria-label="Next scene"
            disabled={!hasNext}
            onClick={(e) => {
              e.stopPropagation()
              setIndex((i) => Math.min(items.length - 1, i + 1))
            }}
            style={{ ...navStyle, right: 'var(--space-4)' }}
          >
            ›
          </button>
        </>
      )}
    </div>,
    document.body,
  )
}
