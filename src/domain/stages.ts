import type { Project } from './types'

export type Stage = 'script' | 'scenes' | 'images' | 'animation' | 'export'

export interface StageItem {
  id: Stage
  label: string
  available: boolean
  hint: string | null
}

/** Which pipeline stages are usable for a given project state. */
export function buildStages(project: Project): StageItem[] {
  const scriptLocked = project.script.locked
  const hasScenes = project.scenes.length > 0
  const hasActiveImage = project.scenes.some(
    (s) => s.activeImageVersionId !== null,
  )
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
      available: scriptLocked && hasActiveImage,
      hint:
        scriptLocked && hasActiveImage
          ? null
          : 'Generate at least one scene image first',
    },
    {
      id: 'export',
      label: '5. Export',
      available: false,
      hint: 'Coming in a later slice',
    },
  ]
}
