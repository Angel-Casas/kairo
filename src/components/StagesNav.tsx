export type Stage = 'script' | 'scenes' | 'images' | 'animation' | 'export'

const STAGES: { id: Stage; label: string; available: boolean }[] = [
  { id: 'script', label: '1. Script', available: true },
  { id: 'scenes', label: '2. Scenes', available: false },
  { id: 'images', label: '3. Images', available: false },
  { id: 'animation', label: '4. Animation', available: false },
  { id: 'export', label: '5. Export', available: false },
]

export function StagesNav({
  active,
  onSelect,
}: {
  active: Stage
  onSelect: (stage: Stage) => void
}) {
  return (
    <nav
      aria-label="Pipeline stages"
      style={{
        display: 'flex',
        gap: 'var(--space-2)',
        borderBottom: '1px solid var(--color-border)',
        paddingBottom: 'var(--space-3)',
        marginBottom: 'var(--space-6)',
        flexWrap: 'wrap',
      }}
    >
      {STAGES.map((stage) => (
        <button
          key={stage.id}
          type="button"
          disabled={!stage.available}
          aria-current={active === stage.id ? 'step' : undefined}
          onClick={() => {
            onSelect(stage.id)
          }}
          title={stage.available ? undefined : 'Coming in a later slice'}
          style={{
            background:
              active === stage.id ? 'var(--color-surface)' : 'transparent',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius)',
            color:
              active === stage.id
                ? 'var(--color-text)'
                : 'var(--color-text-muted)',
            padding: 'var(--space-2) var(--space-3)',
            cursor: stage.available ? 'pointer' : 'not-allowed',
          }}
        >
          {stage.label}
        </button>
      ))}
    </nav>
  )
}
