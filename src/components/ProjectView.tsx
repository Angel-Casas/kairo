import { useEffect, useState } from 'react'
import { useProjectStore } from '../state/project'
import { AnimationStage } from './AnimationStage'
import { AudioStage } from './AudioStage'
import { ExportStage } from './ExportStage'
import { ImagesStage } from './ImagesStage'
import { ScenesStage } from './ScenesStage'
import { ScriptStage } from './ScriptStage'
import { buildStages, type Stage } from '../domain/stages'
import type { Project } from '../domain/types'
import { StagesNav } from './StagesNav'

/** Short "where am I" note for the rail's active segment, e.g. "4/6". */
function stageProgressNote(project: Project, stage: Stage): string | null {
  const total = project.scenes.length
  if (stage === 'scenes') return total > 0 ? String(total) : null
  if (stage === 'audio') {
    const done = project.scenes.filter(
      (s) => s.activeAudioVersionId !== null,
    ).length
    return total > 0 ? `${String(done)}/${String(total)}` : null
  }
  if (stage === 'images') {
    const done = project.scenes.filter(
      (s) => s.activeImageVersionId !== null,
    ).length
    return total > 0 ? `${String(done)}/${String(total)}` : null
  }
  if (stage === 'animation') {
    const done = project.scenes.filter(
      (s) => s.activeVideoVersionId !== null,
    ).length
    return total > 0 ? `${String(done)}/${String(total)}` : null
  }
  return null
}

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
        progressNote={stageProgressNote(project, stage)}
      />
      {stage === 'script' && <ScriptStage />}
      {stage === 'scenes' && <ScenesStage />}
      {stage === 'audio' && <AudioStage />}
      {stage === 'images' && <ImagesStage />}
      {stage === 'animation' && <AnimationStage />}
      {stage === 'export' && <ExportStage />}
    </section>
  )
}
