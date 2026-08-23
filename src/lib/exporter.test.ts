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

function audioVersion(projectId: string, id: string): AssetVersion {
  return {
    id,
    kind: 'audio',
    model: 'tts/model',
    prompt: 'spoken text',
    costUsd: 0.0001,
    blobPath: `${projectId}/${id}`,
    mimeType: 'audio/mpeg',
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
  const sceneC = createScene(2) // no clip — but it DOES have narration
  const clipA = videoVersion(project.id, 'clip-a')
  const clipB = videoVersion(project.id, 'clip-b', 'video/webm')
  const voiceA = audioVersion(project.id, 'voice-a')
  const voiceC = audioVersion(project.id, 'voice-c')
  sceneA.videoVersions = [clipA]
  sceneA.activeVideoVersionId = clipA.id
  sceneA.audioVersions = [voiceA]
  sceneA.activeAudioVersionId = voiceA.id
  sceneB.videoVersions = [clipB]
  sceneB.activeVideoVersionId = clipB.id
  sceneC.audioVersions = [voiceC]
  sceneC.activeAudioVersionId = voiceC.id
  project.scenes = [sceneB, sceneC, sceneA]
  await blobs.put(clipA.blobPath, new Blob(['clip-a-bytes']))
  await blobs.put(clipB.blobPath, new Blob(['clip-b-bytes']))
  await blobs.put(voiceA.blobPath, new Blob(['voice-a-bytes']))
  await blobs.put(voiceC.blobPath, new Blob(['voice-c-bytes']))
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
    // Narration exports for every scene that has one — including scene 3,
    // whose clip is still missing (Slice 15).
    expect(Object.keys(entries).sort()).toEqual([
      'narration-01.mp3',
      'narration-03.mp3',
      'scene-01.mp4',
      'scene-02.webm',
      'script.txt',
    ])
    expect(strFromU8(entries['narration-01.mp3'] ?? new Uint8Array())).toBe(
      'voice-a-bytes',
    )
    expect(strFromU8(entries['script.txt'] ?? new Uint8Array())).toBe(
      'Narration text here.',
    )
    expect(strFromU8(entries['scene-01.mp4'] ?? new Uint8Array())).toBe(
      'clip-a-bytes',
    )
  })

  it('skips the narration file when the active clip embeds it (15.16.3)', async () => {
    const { project, blobs } = await seed()
    // Scene 1's active clip becomes a lip-sync take: narration baked in.
    const sceneA = project.scenes.find((sc) => sc.order === 0)
    if (sceneA?.videoVersions[0] === undefined) throw new Error('seed broke')
    sceneA.videoVersions[0].embedsNarration = true

    const { zip } = await buildClipsZip(project, blobs)
    const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()))
    // narration-01 is gone (its voice is inside scene-01.mp4);
    // narration-03 still ships — that scene's clip is missing entirely.
    expect(Object.keys(entries).sort()).toEqual([
      'narration-03.mp3',
      'scene-01.mp4',
      'scene-02.webm',
      'script.txt',
    ])
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
