import { describe, expect, it } from 'vitest'
import { deriveSceneAssetStatus, findResumableJobs } from './derive'
import type { GenerationJob, JobState, Scene } from './types'

function scene(overrides: Partial<Scene> = {}): Scene {
  return {
    id: 's-1',
    order: 0,
    textExcerpt: 'Once upon a time',
    visualDescription: 'A castle at dawn',
    cameraNotes: '',
    referenceIds: [],
    imageVersions: [],
    activeImageVersionId: null,
    videoVersions: [],
    activeVideoVersionId: null,
    audioVersions: [],
    activeAudioVersionId: null,
    ...overrides,
  }
}

function job(
  state: JobState,
  overrides: Partial<GenerationJob> = {},
): GenerationJob {
  return {
    id: crypto.randomUUID(),
    projectId: 'p-1',
    sceneId: 's-1',
    kind: 'image',
    model: 'm',
    state,
    remoteJobId: null,
    error: null,
    estimatedUsd: null,
    prompt: null,
    submittedCostUsd: null,
    createdAt: '2026-08-16T11:00:00.000Z',
    updatedAt: '2026-08-16T11:00:00.000Z',
    ...overrides,
  }
}

describe('deriveSceneAssetStatus', () => {
  it('is empty with no jobs and no versions', () => {
    expect(deriveSceneAssetStatus(scene(), [], 'image')).toBe('empty')
  })

  it('is generating while any job for the scene+kind is active', () => {
    expect(deriveSceneAssetStatus(scene(), [job('polling')], 'image')).toBe(
      'generating',
    )
  })

  it('generating wins even if an active version already exists (regeneration)', () => {
    const s = scene({ activeImageVersionId: 'v-1' })
    expect(deriveSceneAssetStatus(s, [job('queued')], 'image')).toBe(
      'generating',
    )
  })

  it('is ready when an active version exists and nothing is running', () => {
    const s = scene({ activeImageVersionId: 'v-1' })
    expect(deriveSceneAssetStatus(s, [job('succeeded')], 'image')).toBe('ready')
  })

  it('is failed when the latest job failed and there is no active version', () => {
    const older = job('succeeded', { updatedAt: '2026-08-16T10:00:00.000Z' })
    const newer = job('failed', { updatedAt: '2026-08-16T11:30:00.000Z' })
    expect(deriveSceneAssetStatus(scene(), [older, newer], 'image')).toBe(
      'failed',
    )
  })

  it('ignores jobs for other scenes and other kinds', () => {
    const otherScene = job('polling', { sceneId: 's-2' })
    const otherKind = job('polling', { kind: 'video' })
    expect(
      deriveSceneAssetStatus(scene(), [otherScene, otherKind], 'image'),
    ).toBe('empty')
  })
})

describe('findResumableJobs', () => {
  it('returns only active jobs', () => {
    const jobs = [
      job('queued'),
      job('submitted'),
      job('polling'),
      job('succeeded'),
      job('failed'),
    ]
    expect(findResumableJobs(jobs).map((j) => j.state)).toEqual([
      'queued',
      'submitted',
      'polling',
    ])
  })
})
