import type { ReactNode } from 'react'

/**
 * The prompt recipe (Slice 22, Angel's request): every ingredient that
 * goes into a generation prompt, laid out in the order it is sent, each
 * editable where it lives — plus the exact composed prompt, expandable.
 * No more guessing what the model was actually told.
 */

/** One labeled ingredient row. */
export function RecipeRow({
  label,
  hint,
  children,
}: {
  label: string
  hint?: ReactNode
  children: ReactNode
}) {
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 'var(--space-2)',
          marginBottom: 'var(--space-1)',
          flexWrap: 'wrap',
        }}
      >
        <span
          style={{
            fontSize: '11px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--color-text-muted)',
          }}
        >
          {label}
        </span>
        {hint !== undefined && (
          <span
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
            }}
          >
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  )
}

/**
 * A read-only ingredient (baked-in lines, preset fragments): the SAME box
 * shape as the editable textareas, but visibly inert — dashed border,
 * muted italic — so fixed and editable rows share one visual grammar and
 * only the affordance differs (22.1).
 */
export function RecipeFixedText({ text }: { text: string }) {
  return (
    <p
      style={{
        margin: 0,
        padding: 'var(--space-2) var(--space-3)',
        border: '1px dashed var(--color-border)',
        borderRadius: 'var(--radius)',
        color: 'var(--color-text-muted)',
        fontSize: 'var(--text-sm)',
        fontStyle: 'italic',
      }}
    >
      {text}
    </p>
  )
}

/** The exact prompt, composed live, behind a disclosure. */
export function ComposedPrompt({
  label,
  text,
  note,
}: {
  label: string
  text: string
  note?: string
}) {
  return (
    <details>
      <summary
        style={{
          cursor: 'pointer',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text-muted)',
        }}
      >
        {label}
      </summary>
      <p
        aria-label={label}
        style={{
          margin: 'var(--space-2) 0 0',
          padding: 'var(--space-3)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius)',
          background: 'var(--color-surface-2)',
          fontSize: 'var(--text-sm)',
          color: 'var(--color-text)',
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
        }}
      >
        {text}
      </p>
      {note !== undefined && (
        <p
          style={{
            margin: 'var(--space-1) 0 0',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-muted)',
          }}
        >
          {note}
        </p>
      )}
    </details>
  )
}
