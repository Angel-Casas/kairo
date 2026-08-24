import { strToU8, zipSync } from 'fflate'
import { clipCarriesOwnAudio } from '../domain/types'
import type { Project, Scene } from '../domain/types'
import type { BlobStore } from '../persistence/blobStore'

/**
 * Export builders. Pure data-in/blob-out so they unit-test cleanly; the UI
 * only triggers downloads. Works for incomplete projects by design: whatever
 * is ready gets exported ("never lose paid assets").
 */

export interface ClipsExportPlan {
  /** Scenes with an active clip, in order, with their export file names. */
  included: { scene: Scene; fileName: string }[]
  /** 1-based scene numbers that have no clip yet. */
  missingSceneNumbers: number[]
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('webm')) return 'webm'
  if (mimeType.includes('quicktime')) return 'mov'
  return 'mp4'
}

/** Decide what goes into the clips zip (pure; unit-testable). */
export function planClipsExport(project: Project): ClipsExportPlan {
  const ordered = [...project.scenes].sort((a, b) => a.order - b.order)
  const included: ClipsExportPlan['included'] = []
  const missingSceneNumbers: number[] = []
  ordered.forEach((scene, index) => {
    const active = scene.videoVersions.find(
      (v) => v.id === scene.activeVideoVersionId,
    )
    if (active === undefined) {
      missingSceneNumbers.push(index + 1)
      return
    }
    const number = String(index + 1).padStart(2, '0')
    included.push({
      scene,
      fileName: `scene-${number}.${extensionForMime(active.mimeType)}`,
    })
  })
  return { included, missingSceneNumbers }
}

function audioExtensionForMime(mimeType: string): string {
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('ogg')) return 'ogg'
  return 'mp3'
}

/**
 * Build the clips zip: numbered clips + matching numbered narration files
 * (Slice 15) + script.txt. Narration is exported for every scene that has
 * one — including scenes whose clip is still missing — so the editor gets
 * all the voice that exists. Exception: scenes whose active clip EMBEDS
 * the narration (lip-sync takes) skip the separate file — the voice is
 * already inside the clip, and a duplicate invites doubled audio.
 */
export async function buildClipsZip(
  project: Project,
  blobs: BlobStore,
): Promise<{ zip: Blob; plan: ClipsExportPlan }> {
  const plan = planClipsExport(project)
  const files: Record<string, Uint8Array> = {
    'script.txt': strToU8(project.script.text),
  }
  for (const { scene, fileName } of plan.included) {
    const active = scene.videoVersions.find(
      (v) => v.id === scene.activeVideoVersionId,
    )
    if (active === undefined) continue
    const blob = await blobs.get(active.blobPath)
    if (blob === null) continue
    files[fileName] = new Uint8Array(await blob.arrayBuffer())
  }
  const orderedScenes = [...project.scenes].sort((a, b) => a.order - b.order)
  for (const [index, scene] of orderedScenes.entries()) {
    const narration = scene.audioVersions.find(
      (v) => v.id === scene.activeAudioVersionId,
    )
    if (narration === undefined) continue
    // A lip-sync clip already CARRIES the narration in its audio track —
    // a separate narration file would invite doubled voice in the edit
    // (15.16.3). The voice still ships, inside scene-NN itself.
    const activeClip = scene.videoVersions.find(
      (v) => v.id === scene.activeVideoVersionId,
    )
    if (clipCarriesOwnAudio(activeClip)) continue
    const blob = await blobs.get(narration.blobPath)
    if (blob === null) continue
    const number = String(index + 1).padStart(2, '0')
    files[`narration-${number}.${audioExtensionForMime(narration.mimeType)}`] =
      new Uint8Array(await blob.arrayBuffer())
  }
  const zipped = zipSync(files, { level: 0 }) // clips are already compressed
  const bytes = new Uint8Array(zipped.length)
  bytes.set(zipped)
  return { zip: new Blob([bytes.buffer], { type: 'application/zip' }), plan }
}

/** Sanitize a project title into a safe download file name stem. */
export function exportFileStem(title: string): string {
  const stem = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return stem.length > 0 ? stem : 'kairo-project'
}

/** Trigger a browser download for a blob. */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  // Give the browser a beat to start the download before revoking.
  setTimeout(() => {
    URL.revokeObjectURL(url)
  }, 10_000)
}
