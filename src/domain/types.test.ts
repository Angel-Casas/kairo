import { describe, expect, it } from 'vitest'
import {
  createProject,
  createReference,
  createScene,
  normalizeProject,
  type Project,
} from './types'

const nowIso = () => new Date().toISOString()

describe('createProject / createReference', () => {
  it('new projects start with no references', () => {
    const project = createProject('P', nowIso)
    expect(project.references).toEqual([])
  })

  it('createReference starts empty with the requested kind', () => {
    const reference = createReference('character', nowIso)
    expect(reference.kind).toBe('character')
    expect(reference.name).toBe('')
    expect(reference.descriptor).toBe('')
    expect(reference.imageVersions).toEqual([])
    expect(reference.activeImageVersionId).toBeNull()
  })
})

describe('normalizeProject — Slice 10 backfill', () => {
  it('backfills references and scene referenceIds on pre-Slice-10 projects', () => {
    const project = createProject('Old', nowIso)
    const stored = {
      ...project,
      scenes: [
        {
          id: 'scene-1',
          order: 0,
          textExcerpt: '',
          visualDescription: '',
          imageVersions: [],
          activeImageVersionId: null,
          videoVersions: [],
          activeVideoVersionId: null,
        },
      ],
    } as unknown as Project
    // Simulate a project stored before the fields existed.
    delete (stored as unknown as Record<string, unknown>).references
    delete (stored.scenes[0] as unknown as Record<string, unknown>).referenceIds

    const normalized = normalizeProject(stored)
    expect(normalized.references).toEqual([])
    expect(normalized.scenes[0]?.referenceIds).toEqual([])
    // Slice 15.6: camera notes backfill to empty on older projects.
    expect(normalized.scenes[0]?.cameraNotes).toBe('')
  })

  it('backfills image fields on references stored before Part B', () => {
    const project = createProject('Old', nowIso)
    const reference = createReference('location', nowIso)
    const stored = { ...project, references: [reference] }
    delete (stored.references[0] as unknown as Record<string, unknown>)
      .imageVersions
    delete (stored.references[0] as unknown as Record<string, unknown>)
      .activeImageVersionId

    const normalized = normalizeProject(stored)
    expect(normalized.references[0]?.imageVersions).toEqual([])
    expect(normalized.references[0]?.activeImageVersionId).toBeNull()
  })

  it('heals media versions stored with a wrong-kind MIME type', () => {
    const project = createProject('Old', nowIso)
    const scene = createScene(0)
    const version = (kind: 'image' | 'video' | 'audio', mimeType: string) => ({
      id: `${kind}-${mimeType}`,
      kind,
      model: 'm',
      prompt: '',
      costUsd: null,
      blobPath: 'p/x',
      mimeType,
      createdAt: nowIso(),
    })
    const stored = {
      ...project,
      scenes: [
        {
          ...scene,
          imageVersions: [version('image', 'application/octet-stream')],
          videoVersions: [
            version('video', 'application/octet-stream'),
            version('video', 'video/webm'),
          ],
          audioVersions: [version('audio', 'text/plain')],
        },
      ],
    }
    const normalized = normalizeProject(stored as unknown as Project)
    expect(normalized.scenes[0]?.imageVersions[0]?.mimeType).toBe('image/png')
    expect(normalized.scenes[0]?.videoVersions[0]?.mimeType).toBe('video/mp4')
    // A correct type of the right kind is left alone.
    expect(normalized.scenes[0]?.videoVersions[1]?.mimeType).toBe('video/webm')
    expect(normalized.scenes[0]?.audioVersions[0]?.mimeType).toBe('audio/mpeg')
  })

  it('leaves populated references untouched', () => {
    const project = createProject('New', nowIso)
    const reference = {
      ...createReference('character', nowIso),
      name: 'Mara',
      descriptor: 'silver hair',
    }
    const normalized = normalizeProject({
      ...project,
      references: [reference],
    })
    expect(normalized.references[0]).toEqual(reference)
  })
})
