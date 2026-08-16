import { isActiveJobState } from './transitions'
import type { AssetKind, GenerationJob, Scene } from './types'

/**
 * Displayed status of a scene for one asset kind. Derived, never stored —
 * jobs + versions are the single source of truth.
 */
export type SceneAssetStatus = 'empty' | 'generating' | 'ready' | 'failed'

export function deriveSceneAssetStatus(
  scene: Scene,
  jobs: readonly GenerationJob[],
  kind: AssetKind,
): SceneAssetStatus {
  const sceneJobs = jobs.filter(
    (j) => j.sceneId === scene.id && j.kind === kind,
  )
  if (sceneJobs.some((j) => isActiveJobState(j.state))) return 'generating'

  const activeVersionId =
    kind === 'image' ? scene.activeImageVersionId : scene.activeVideoVersionId
  if (activeVersionId !== null) return 'ready'

  const latest = [...sceneJobs].sort((a, b) =>
    a.updatedAt.localeCompare(b.updatedAt),
  )[sceneJobs.length - 1]
  if (latest?.state === 'failed') return 'failed'

  return 'empty'
}

/** Jobs that were interrupted (e.g. tab closed) and should resume polling. */
export function findResumableJobs(
  jobs: readonly GenerationJob[],
): GenerationJob[] {
  return jobs.filter((j) => isActiveJobState(j.state))
}
