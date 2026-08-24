import { useBlobUrl } from './useBlobUrl'
import { useFormatSpec } from './useFormatSpec'

/** Small clickable version thumbnail used for scene and reference images. */
export function VersionThumb({
  blobPath,
  label,
  active,
  onSelect,
}: {
  blobPath: string
  label: string
  active: boolean
  onSelect: () => void
}) {
  const formatSpec = useFormatSpec()
  const url = useBlobUrl(blobPath)
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onSelect}
      style={{
        padding: 0,
        border: active
          ? '2px solid var(--color-accent)'
          : '1px solid var(--color-border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'var(--color-surface)',
        width: formatSpec.ratio > 1 ? '6rem' : '3.5rem',
      }}
    >
      {url !== null ? (
        <img
          src={url}
          alt=""
          style={{
            width: '100%',
            aspectRatio: formatSpec.cssAspect,
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <div style={{ width: '100%', aspectRatio: formatSpec.cssAspect }} />
      )}
    </button>
  )
}
