import { useEffect, useRef } from 'react'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  // Move focus into the dialog on open (onto the safe choice) and let
  // Escape cancel — basic dialog a11y.
  useEffect(() => {
    cancelRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onCancel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        className="card"
        style={{
          /* Solid ground: the glass surface is too sheer over the scrim. */
          background: 'var(--color-bg)',
          padding: 'var(--space-6)',
          maxWidth: '28rem',
        }}
      >
        <h2 style={{ marginTop: 0, fontSize: 'var(--text-lg)' }}>{title}</h2>
        <p style={{ color: 'var(--color-text-muted)' }}>{message}</p>
        <div
          style={{
            display: 'flex',
            gap: 'var(--space-2)',
            justifyContent: 'flex-end',
          }}
        >
          <button ref={cancelRef} type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              background: 'var(--color-danger)',
              color: 'var(--color-danger-ink)',
              borderColor: 'transparent',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
