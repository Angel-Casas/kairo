import { unzipSync, strFromU8 } from 'fflate'
import { describe, expect, it } from 'vitest'
import { createProject, createScene } from '../domain/types'
import type { AssetVersion } from '../domain/types'
import { MemoryBlobStore } from '../persistence/blobStore'
import { buildClipsZip, exportFileStem, planClipsExport } from './exporter'

const nowIso = () => new Date('2026-08-16T12:00:00Z').toISOString()

function videoVersion(
  projectId: string,
  id: string,
  mimeType = 'video/mp4',
): AssetVersion {
  return {
    id,
    kind: 'video',
    model: 'vid/model',
    prompt: 'motion',
    costUsd: 0.35,
    blobPath: `${projectId}/${id}`,
    mimeType,
    createdAt: nowIso(),
  }
}

async function seed() {
  const blobs = new MemoryBlobStore()
  const project = createProject('My Great Short!', nowIso)
  project.script = { text: 'Narration text here.', locked: true }
  // Scene order deliberately scrambled to verify sorting.
  const sceneB = createScene(1)
  const sceneA = createScene(0)
  const sceneC = createScene(2) // no clip
  const clipA = videoVersion(project.id, 'clip-a')
  const clipB = videoVersion(project.id, 'clip-b', 'video/webm')
  sceneA.videoVersions = [clipA]
  sceneA.activeVideoVersionId = clipA.id
  sceneB.videoVersions = [clipB]
  sceneB.activeVideoVersionId = clipB.id
  project.scenes = [sceneB, sceneC, sceneA]
  await blobs.put(clipA.blobPath, new Blob(['clip-a-bytes']))
  await blobs.put(clipB.blobPath, new Blob(['clip-b-bytes']))
  return { project, blobs }
}

describe('planClipsExport', () => {
  it('numbers included scenes by order and reports missing ones', async () => {
    const { project } = await seed()
    const plan = planClipsExport(project)
    expect(plan.included.map((i) => i.fileName)).toEqual([
      'scene-01.mp4',
      'scene-02.webm',
    ])
    expect(plan.missingSceneNumbers).toEqual([3])
  })
})

describe('buildClipsZip', () => {
  it('packs numbered clips and script.txt, skipping clipless scenes', async () => {
    const { project, blobs } = await seed()
    const { zip, plan } = await buildClipsZip(project, blobs)
    expect(plan.missingSceneNumbers).toEqual([3])

    const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()))
    expect(Object.keys(entries).sort()).toEqual([
      'scene-01.mp4',
      'scene-02.webm',
      'script.txt',
    ])
    expect(strFromU8(entries['script.txt'] ?? new Uint8Array())).toBe(
      'Narration text here.',
    )
    expect(strFromU8(entries['scene-01.mp4'] ?? new Uint8Array())).toBe(
      'clip-a-bytes',
    )
  })

  it('exports script-only for a project with no clips at all', async () => {
    const blobs = new MemoryBlobStore()
    const project = createProject('Empty', nowIso)
    project.script = { text: 'Just words.', locked: true }
    project.scenes = [createScene(0)]
    const { zip, plan } = await buildClipsZip(project, blobs)
    const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()))
    expect(Object.keys(entries)).toEqual(['script.txt'])
    expect(plan.missingSceneNumbers).toEqual([1])
  })
})

describe('exportFileStem', () => {
  it('sanitizes titles into safe file stems', () => {
    expect(exportFileStem('My Great Short!')).toBe('my-great-short')
    expect(exportFileStem('  ¡Olé! 2026  ')).toBe('ol-2026')
    expect(exportFileStem('***')).toBe('kairo-project')
  })
})
