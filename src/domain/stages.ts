import type { Project } from './types'

export type Stage =
  'script' | 'scenes' | 'audio' | 'images' | 'animation' | 'export'

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
  const hasClip = project.scenes.some((s) => s.activeVideoVersionId !== null)
  return [
    { id: 'script', label: 'Script', available: true, hint: null },
    {
      id: 'scenes',
      label: 'Scenes',
      available: scriptLocked,
      hint: scriptLocked ? null : 'Lock the script first',
    },
    {
      id: 'audio',
      label: 'Audio',
      available: scriptLocked && hasScenes,
      hint:
        scriptLocked && hasScenes ? null : 'Break the script into scenes first',
    },
    {
      id: 'images',
      label: 'Images',
      available: scriptLocked && hasScenes,
      hint:
        scriptLocked && hasScenes ? null : 'Break the script into scenes first',
    },
    {
      id: 'animation',
      label: 'Animation',
      available: scriptLocked && hasActiveImage,
      hint:
        scriptLocked && hasActiveImage
          ? null
          : 'Generate at least one scene image first',
    },
    {
      id: 'export',
      label: 'Export',
      available: hasClip,
      hint: hasClip ? null : 'Animate at least one scene first',
    },
  ]
}
