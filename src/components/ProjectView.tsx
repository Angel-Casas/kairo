import { useEffect, useState } from 'react'
import { useProjectStore } from '../state/project'
import { CostSummary } from './CostSummary'
import { ImagesStage } from './ImagesStage'
import { ScenesStage } from './ScenesStage'
import { ScriptStage } from './ScriptStage'
import { buildStages, type Stage } from '../domain/stages'
import { StagesNav } from './StagesNav'

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
  const flushProject = useProjectStore((s) => s.flushProject)
  const [stage, setStage] = useState<Stage>('script')

  useEffect(() => {
    void loadProject(projectId)
    return () => {
      closeProject()
    }
  }, [projectId, loadProject, closeProject])

  // If the active stage becomes unavailable (e.g. script unlocked while on
  // Scenes), fall back to the script stage.
  useEffect(() => {
    if (project === null) return
    const item = buildStages(project).find((s) => s.id === stage)
    if (item !== undefined && !item.available) setStage('script')
  }, [project, stage])

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
            void flushProject().then(onBack)
          }}
        >
          ← All projects
        </button>
        <h2 style={{ margin: 0, fontSize: 'var(--text-lg)' }}>
          {project.title}
        </h2>
      </div>
      <StagesNav
        stages={buildStages(project)}
        active={stage}
        onSelect={setStage}
      />
      <CostSummary />
      {stage === 'script' && <ScriptStage />}
      {stage === 'scenes' && <ScenesStage />}
      {stage === 'images' && <ImagesStage />}
    </section>
  )
}
