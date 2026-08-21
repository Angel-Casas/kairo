import { describe, expect, it } from 'vitest'
import {
  createProject,
  createReference,
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
