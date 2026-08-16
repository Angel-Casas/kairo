import type { Stage, StageItem } from '../domain/stages'

export function StagesNav({
  stages,
  active,
  onSelect,
}: {
  stages: StageItem[]
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
      {stages.map((stage) => (
        <button
          key={stage.id}
          type="button"
          disabled={!stage.available}
          aria-current={active === stage.id ? 'step' : undefined}
          onClick={() => {
            onSelect(stage.id)
          }}
          title={stage.hint ?? undefined}
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
