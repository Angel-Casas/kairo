import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { beforeEach, describe, expect, it } from 'vitest'
import { createProject } from '../domain/types'
import type { GenerationJob } from '../domain/types'
import { MemoryBlobStore } from './blobStore'
import { openKairoDB } from './db'
import { Repository } from './repository'

const now = () => new Date('2026-08-16T12:00:00Z').toISOString()

function makeJob(projectId: string): GenerationJob {
  return {
    id: crypto.randomUUID(),
    projectId,
    sceneId: null,
    kind: 'text',
    model: 'm',
    state: 'queued',
    remoteJobId: null,
    error: null,
    estimatedUsd: null,
    createdAt: now(),
    updatedAt: now(),
  }
}

describe('Repository', () => {
  let repo: Repository
  let blobs: MemoryBlobStore

  beforeEach(async () => {
    // Fresh IndexedDB per test.
    globalThis.indexedDB = new IDBFactory()
    blobs = new MemoryBlobStore()
    repo = new Repository(await openKairoDB(), blobs)
  })

  it('stores and retrieves a project', async () => {
    const project = createProject('My short', now)
    await repo.putProject(project)
    expect(await repo.getProject(project.id)).toEqual(project)
  })

  it('lists projects most recently updated first', async () => {
    const a = { ...createProject('A', now), updatedAt: '2026-08-16T10:00:00Z' }
    const b = { ...createProject('B', now), updatedAt: '2026-08-16T11:00:00Z' }
    await repo.putProject(a)
    await repo.putProject(b)
    expect((await repo.listProjects()).map((p) => p.title)).toEqual(['B', 'A'])
  })

  it('round-trips jobs and finds them by project', async () => {
    const project = createProject('P', now)
    await repo.putProject(project)
    const job = makeJob(project.id)
    await repo.putJob(job)
    await repo.putJob(makeJob('some-other-project'))
    expect(await repo.getJobsByProject(project.id)).toEqual([job])
    expect(await repo.listAllJobs()).toHaveLength(2)
  })

  it('deleteProject cascades to jobs and blobs, leaving others untouched', async () => {
    const doomed = createProject('Doomed', now)
    const survivor = createProject('Survivor', now)
    await repo.putProject(doomed)
    await repo.putProject(survivor)
    await repo.putJob(makeJob(doomed.id))
    await repo.putJob(makeJob(survivor.id))
    await blobs.put(`${doomed.id}/v1`, new Blob(['doomed asset']))
    await blobs.put(`${survivor.id}/v1`, new Blob(['survivor asset']))

    await repo.deleteProject(doomed.id)

    expect(await repo.getProject(doomed.id)).toBeUndefined()
    expect(await repo.getJobsByProject(doomed.id)).toEqual([])
    expect(await blobs.list(doomed.id)).toEqual([])
    expect(await repo.getProject(survivor.id)).toBeDefined()
    expect(await repo.getJobsByProject(survivor.id)).toHaveLength(1)
    expect(await blobs.list(survivor.id)).toHaveLength(1)
  })
})
