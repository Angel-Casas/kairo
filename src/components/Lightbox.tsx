import { useEffect, useState, type CSSProperties } from 'react'
import { useBlobUrl } from './useBlobUrl'

export interface LightboxItem {
  blobPath: string
  alt: string
  kind: 'image' | 'video'
  /** Caption plate, e.g. "Scene 3". */
  title?: string
  /** The visual description (image prompt basis), shown on the media. */
  prompt?: string
  /** The script excerpt the scene narrates. */
  excerpt?: string
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
  const url = useBlobUrl(item?.blobPath ?? null)
  const hasPrev = index > 0
  const hasNext = index < items.length - 1

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

  return (
    <div
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
              style={mediaStyle}
            />
          ) : (
            <img src={url} alt={item.alt} style={mediaStyle} />
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
    </div>
  )
}
