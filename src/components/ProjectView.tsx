import { useEffect, useState } from 'react'
import { useProjectStore } from '../state/project'
import { CostSummary } from './CostSummary'
import { ScriptStage } from './ScriptStage'
import { StagesNav, type Stage } from './StagesNav'

export function ProjectView({
  projectId,
  onBack,
}: {
  projectId: string
  onBack: () => void
}) {
  const project = useProjectStore((s) => s.project)
  const status = useProjectStore((s) => s.projectStatus)
  const loadProject = useProjectStore((s) => s.loadProject)
  const closeProject = useProjectStore((s) => s.closeProject)
  const flushScript = useProjectStore((s) => s.flushScript)
  const [stage, setStage] = useState<Stage>('script')

  useEffect(() => {
    void loadProject(projectId)
    return () => {
      closeProject()
    }
  }, [projectId, loadProject, closeProject])

  if (status !== 'ready') {
    return <p style={{ color: 'var(--color-text-muted)' }}>Loading project…</p>
  }
  if (project === null) {
    return (
      <section>
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          This project could not be found.
        </p>
        <button type="button" onClick={onBack}>
          ← All projects
        </button>
      </section>
    )
  }

  return (
    <section>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-4)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <button
          type="button"
          onClick={() => {
            void flushScript().then(onBack)
          }}
        >
          ← All projects
        </button>
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
          {project.title}
        </h2>
      </div>
      <StagesNav active={stage} onSelect={setStage} />
      <CostSummary />
      {stage === 'script' && <ScriptStage />}
    </section>
  )
}
