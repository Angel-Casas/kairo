import { describe, expect, it } from 'vitest'
import { createProject } from '../domain/types'
import type { AssetVersion } from '../domain/types'
import { MemoryBlobStore } from './blobStore'
import { exportProject, importProject, ProjectFileError } from './projectFile'

const now = () => new Date('2026-08-16T12:00:00Z').toISOString()

function version(projectId: string, id: string): AssetVersion {
  return {
    id,
    kind: 'image',
    model: 'm',
    prompt: 'a castle',
    costUsd: 0.01,
    blobPath: `${projectId}/${id}`,
    mimeType: 'image/png',
    createdAt: now(),
  }
}

async function text(blob: Blob): Promise<string> {
  return new TextDecoder().decode(await blob.arrayBuffer())
}

describe('project file export/import', () => {
  it('round-trips a project with assets, assigning a new id', async () => {
    const source = new MemoryBlobStore()
    const project = createProject('Round trip', now)
    const v = version(project.id, 'v-1')
    project.scenes.push({
      id: 's-1',
      order: 0,
      textExcerpt: 'text',
      visualDescription: 'castle',
      imageVersions: [v],
      activeImageVersionId: v.id,
      videoVersions: [],
      activeVideoVersionId: null,
    })
    await source.put(v.blobPath, new Blob(['png-bytes']))

    const file = await exportProject(project, source)
    const target = new MemoryBlobStore()
    const imported = await importProject(file, target)

    expect(imported.id).not.toBe(project.id)
    expect(imported.title).toBe('Round trip')
    expect(imported.scenes).toHaveLength(1)
    const importedVersion = imported.scenes[0]?.imageVersions[0]
    expect(importedVersion?.blobPath).toBe(`${imported.id}/v-1`)
    const restored = await target.get(`${imported.id}/v-1`)
    expect(restored).not.toBeNull()
    expect(await text(restored as Blob)).toBe('png-bytes')
  })

  it('exports a half-finished project with no assets', async () => {
    const store = new MemoryBlobStore()
    const project = createProject('Empty-ish', now)
    const file = await exportProject(project, store)
    const imported = await importProject(file, store)
    expect(imported.title).toBe('Empty-ish')
    expect(imported.scenes).toEqual([])
  })

  it('rejects a non-zip file', async () => {
    await expect(
      importProject(new Blob(['not a zip']), new MemoryBlobStore()),
    ).rejects.toThrow(ProjectFileError)
  })

  it('rejects a zip without project.json', async () => {
    const { zipSync, strToU8 } = await import('fflate')
    const zipped = zipSync({ 'other.txt': strToU8('hi') })
    const copy = new Uint8Array(zipped.length)
    copy.set(zipped)
    await expect(
      importProject(new Blob([copy.buffer]), new MemoryBlobStore()),
    ).rejects.toThrow(/missing project.json/)
  })

  it('rejects unsupported schema versions', async () => {
    const { zipSync, strToU8 } = await import('fflate')
    const bogus = { ...createProject('Future', now), schemaVersion: 99 }
    const zipped = zipSync({ 'project.json': strToU8(JSON.stringify(bogus)) })
    const copy = new Uint8Array(zipped.length)
    copy.set(zipped)
    await expect(
      importProject(new Blob([copy.buffer]), new MemoryBlobStore()),
    ).rejects.toThrow(/schema version/)
  })
})
