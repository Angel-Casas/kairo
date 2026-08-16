import type { Project } from '../domain/types'

export type Stage = 'script' | 'scenes' | 'images' | 'animation' | 'export'

export interface StageItem {
  id: Stage
  label: string
  available: boolean
  hint: string | null
}

/** Which stages are usable for a given project state. */
export function buildStages(project: Project): StageItem[] {
  const scriptLocked = project.script.locked
  const hasScenes = project.scenes.length > 0
  return [
    { id: 'script', label: '1. Script', available: true, hint: null },
    {
      id: 'scenes',
      label: '2. Scenes',
      available: scriptLocked,
      hint: scriptLocked ? null : 'Lock the script first',
    },
    {
      id: 'images',
      label: '3. Images',
      available: scriptLocked && hasScenes,
      hint:
        scriptLocked && hasScenes ? null : 'Break the script into scenes first',
    },
    {
      id: 'animation',
      label: '4. Animation',
      available: false,
      hint: 'Coming in a later slice',
    },
    {
      id: 'export',
      label: '5. Export',
      available: false,
      hint: 'Coming in a later slice',
    },
  ]
}

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
