import { useEffect, useRef, useState } from 'react'
import { useProjectStore } from '../state/project'
import { AnimationStage } from './AnimationStage'
import { AudioStage } from './AudioStage'
import { ExportStage } from './ExportStage'
import { ImagesStage } from './ImagesStage'
import { ScenesStage } from './ScenesStage'
import { ScriptStage } from './ScriptStage'
import { buildStages, type Stage } from '../domain/stages'
import type { Project, ProjectFormat } from '../domain/types'
import { StagesNav } from './StagesNav'
import { VIDEO_FORMATS } from '../domain/formats'

/**
 * Stage order for the direction-aware transition (ADR-013): moving to a
 * later stage advances the film left←right; moving back rewinds it.
 */
const STAGE_ORDER: Stage[] = [
  'script',
  'scenes',
  'audio',
  'images',
  'animation',
  'export',
]

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
  const setFormat = useProjectStore((s) => s.setFormat)
  const [stage, setStage] = useState<Stage>('script')
  // Remember where we came from so the incoming stage knows which way the
  // film is travelling (forward advance vs. rewind).
  const prevStageRef = useRef<Stage>('script')
  const cameFrom = prevStageRef.current
  useEffect(() => {
    prevStageRef.current = stage
  }, [stage])
  const goingForward =
    STAGE_ORDER.indexOf(stage) >= STAGE_ORDER.indexOf(cameFrom)

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
        {/* The frame the whole production is shot in (Slice 18). Editable
            any time: new generations use it; finished takes keep their
            shape. */}
        <select
          aria-label="Video format"
          value={project.format}
          onChange={(e) => {
            void setFormat(e.target.value as ProjectFormat)
          }}
          style={{ marginLeft: 'auto' }}
          title="New generations use this format — already-generated takes keep their shape"
        >
          {VIDEO_FORMATS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name} {f.ratioLabel}
            </option>
          ))}
        </select>
      </div>
      <StagesNav
        stages={buildStages(project)}
        active={stage}
        onSelect={setStage}
        progressNote={stageProgressNote(project, stage)}
      />
      <div
        key={stage}
        className={goingForward ? 'stage-in-fwd' : 'stage-in-back'}
      >
        {stage === 'script' && <ScriptStage />}
        {stage === 'scenes' && <ScenesStage />}
        {stage === 'audio' && <AudioStage />}
        {stage === 'images' && <ImagesStage />}
        {stage === 'animation' && <AnimationStage />}
        {stage === 'export' && <ExportStage />}
      </div>
    </section>
  )
}
