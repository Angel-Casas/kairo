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
          className={active === stage.id ? 'primary' : undefined}
          style={{
            background: active === stage.id ? undefined : 'transparent',
            color: active === stage.id ? undefined : 'var(--color-text-muted)',
            cursor: stage.available ? 'pointer' : 'not-allowed',
          }}
        >
          {stage.label}
        </button>
      ))}
    </nav>
  )
}
