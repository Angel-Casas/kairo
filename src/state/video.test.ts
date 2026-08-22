import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import type { VideoModel } from '../api/nanogpt'
import { createProject, createScene } from '../domain/types'
import type { AssetVersion, GenerationJob } from '../domain/types'
import { __resetRepositoryForTests, getRepository } from './repo'
import { __setVideoPollIntervalForTests, useProjectStore } from './project'
import { useSettingsStore } from './settings'

const BASE = 'https://nano-gpt.com/api'
const VIDEO_URL = 'https://cdn.test/clip.mp4'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  __setVideoPollIntervalForTests(10)
})
afterEach(() => {
  server.resetHandlers()
  useProjectStore.getState().closeProject()
})
afterAll(() => {
  server.close()
})

const nowIso = () => new Date().toISOString()

const VIDEO_MODEL: VideoModel = {
  id: 'vid/model',
  name: 'Video Model',
  description: '',
  supportsTextToVideo: false,
  supportsImageToVideo: true,
  priceRangeUsd: { min: 0.72, max: 1.8 },
  resolutions: ['480p', '1080p'],
  durations: ['5', '8'],
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  __resetRepositoryForTests()
  useProjectStore.setState({
    project: null,
    projectStatus: 'idle',
    sceneVideoStatus: {},
  })
  useSettingsStore.setState({
    apiKey: 'key-1234',
    keyStatus: 'valid',
    keyError: null,
    balanceUsd: 10,
  })
})

/** Seed a project whose first scene has an active image stored as a blob. */
async function seedProjectWithImage() {
  const repo = await getRepository()
  const project = createProject('Vid', nowIso)
  const scene = createScene(0)
  scene.visualDescription = 'A lighthouse at sunset'
  const imageVersion: AssetVersion = {
    id: 'img-v1',
    kind: 'image',
    model: 'img/model',
    prompt: 'a lighthouse',
    costUsd: 0.01,
    blobPath: `${project.id}/img-v1`,
    mimeType: 'image/png',
    createdAt: nowIso(),
  }
  scene.imageVersions = [imageVersion]
  scene.activeImageVersionId = imageVersion.id
  project.scenes = [scene]
  project.script = { text: 'A lighthouse.', locked: true }
  await repo.blobs.put(
    imageVersion.blobPath,
    new Blob(['png'], { type: 'image/png' }),
  )
  await repo.putProject(project)
  await useProjectStore.getState().loadProject(project.id)
  return { project, sceneId: scene.id }
}

function mockSubmission(costUsd = 0.35) {
  let submittedBody: unknown = null
  server.use(
    http.post(`${BASE}/generate-video`, async ({ request }) => {
      submittedBody = await request.json()
      return HttpResponse.json({
        runId: 'vid_run_1',
        id: 'vid_run_1',
        status: 'pending',
        cost: costUsd,
      })
    }),
  )
  return () => submittedBody
}

function mockStatusSequence(statuses: string[]) {
  let call = 0
  server.use(
    http.get(`${BASE}/video/status`, () => {
      const status = statuses[Math.min(call, statuses.length - 1)]
      call += 1
      return HttpResponse.json({
        requestId: 'vid_run_1',
        data: {
          status,
          output:
            status === 'COMPLETED' ? { video: { url: VIDEO_URL } } : undefined,
          cost: 0.35,
          error: status === 'FAILED' ? 'provider exploded' : null,
        },
      })
    }),
  )
}

function mockVideoDownload() {
  server.use(
    http.get(VIDEO_URL, () =>
      HttpResponse.arrayBuffer(new TextEncoder().encode('mp4-bytes').buffer, {
        headers: { 'content-type': 'video/mp4' },
      }),
    ),
  )
}

describe('video generation', () => {
  it('submits, polls to completion, stores the clip and logs the submission cost', async () => {
    const { project, sceneId } = await seedProjectWithImage()
    const getBody = mockSubmission(0.35)
    mockStatusSequence(['IN_QUEUE', 'IN_PROGRESS', 'COMPLETED'])
    mockVideoDownload()

    const ok = await useProjectStore
      .getState()
      .generateSceneVideo(sceneId, VIDEO_MODEL, '5', '480p')
    expect(ok).toBe(true)

    // Submission params: image-to-video with 9:16, duration, and the
    // cheapest-by-default resolution (cost driver — see LESSONS.md).
    expect(getBody()).toMatchObject({
      model: VIDEO_MODEL.id,
      duration: '5',
      aspect_ratio: '9:16',
      resolution: '480p',
    })
    expect((getBody() as { imageDataUrl?: string }).imageDataUrl).toMatch(
      /^data:image\/png;base64,/,
    )

    // Cost was logged at submission, before completion.
    expect(useProjectStore.getState().project?.costLog.at(-1)?.actualUsd).toBe(
      0.35,
    )

    await vi.waitFor(
      () => {
        const scene = useProjectStore.getState().project?.scenes[0]
        expect(scene?.videoVersions).toHaveLength(1)
      },
      { timeout: 3000 },
    )

    const repo = await getRepository()
    const stored = await repo.getProject(project.id)
    const scene = stored?.scenes[0]
    const version = scene?.videoVersions[0]
    expect(scene?.activeVideoVersionId).toBe(version?.id)
    expect(version?.kind).toBe('video')
    expect(version?.costUsd).toBe(0.35)
    expect(await repo.blobs.get(version?.blobPath ?? '')).not.toBeNull()
    const jobs = await repo.getJobsByProject(project.id)
    expect(jobs.at(-1)?.state).toBe('succeeded')
    expect(useProjectStore.getState().sceneVideoStatus[sceneId]).toBeUndefined()
  })

  it('surfaces provider failure with a retryable error', async () => {
    const { project, sceneId } = await seedProjectWithImage()
    mockSubmission()
    mockStatusSequence(['IN_PROGRESS', 'FAILED'])

    await useProjectStore
      .getState()
      .generateSceneVideo(sceneId, VIDEO_MODEL, '5', '480p')

    await vi.waitFor(
      () => {
        expect(
          useProjectStore.getState().sceneVideoStatus[sceneId]?.error,
        ).toBe('provider exploded')
      },
      { timeout: 3000 },
    )
    const repo = await getRepository()
    const jobs = await repo.getJobsByProject(project.id)
    expect(jobs.at(-1)?.state).toBe('failed')
    expect(
      (await repo.getProject(project.id))?.scenes[0]?.videoVersions,
    ).toHaveLength(0)
  })

  it('marks the job failed when submission itself is rejected', async () => {
    const { project, sceneId } = await seedProjectWithImage()
    server.use(
      http.post(`${BASE}/generate-video`, () =>
        HttpResponse.json({ message: 'insufficient balance' }, { status: 402 }),
      ),
    )
    const ok = await useProjectStore
      .getState()
      .generateSceneVideo(sceneId, VIDEO_MODEL, '5', '480p')
    expect(ok).toBe(false)
    expect(useProjectStore.getState().sceneVideoStatus[sceneId]?.error).toBe(
      'insufficient balance',
    )
    const repo = await getRepository()
    const jobs = await repo.getJobsByProject(project.id)
    expect(jobs.at(-1)?.state).toBe('failed')
    // No cost log entry — nothing was charged.
    expect((await repo.getProject(project.id))?.costLog).toHaveLength(0)
  })

  it('resumes an interrupted polling job on project load and collects the clip', async () => {
    const { project, sceneId } = await seedProjectWithImage()
    // Simulate a job left behind by a closed tab: polling, with a runId.
    const repo = await getRepository()
    const interrupted: GenerationJob = {
      id: 'job-interrupted',
      projectId: project.id,
      sceneId,
      kind: 'video',
      model: VIDEO_MODEL.id,
      state: 'polling',
      remoteJobId: 'vid_run_1',
      error: null,
      estimatedUsd: null,
      prompt: 'a lighthouse, subtle motion',
      submittedCostUsd: 0.35,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await repo.putJob(interrupted)
    mockStatusSequence(['COMPLETED'])
    mockVideoDownload()

    // Reopen the project — resume happens inside loadProject.
    useProjectStore.getState().closeProject()
    await useProjectStore.getState().loadProject(project.id)
    expect(
      useProjectStore.getState().sceneVideoStatus[sceneId]?.generating,
    ).toBe(true)

    await vi.waitFor(
      () => {
        const scene = useProjectStore.getState().project?.scenes[0]
        expect(scene?.videoVersions).toHaveLength(1)
      },
      { timeout: 3000 },
    )
    const stored = await repo.getProject(project.id)
    expect(stored?.scenes[0]?.videoVersions[0]?.costUsd).toBe(0.35)
    expect((await repo.getJobsByProject(project.id)).at(-1)?.state).toBe(
      'succeeded',
    )
  })

  it('fails jobs that were interrupted before submission', async () => {
    const { project } = await seedProjectWithImage()
    const repo = await getRepository()
    const neverSubmitted: GenerationJob = {
      id: 'job-never-submitted',
      projectId: project.id,
      sceneId: null,
      kind: 'video',
      model: VIDEO_MODEL.id,
      state: 'queued',
      remoteJobId: null,
      error: null,
      estimatedUsd: null,
      prompt: null,
      submittedCostUsd: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await repo.putJob(neverSubmitted)

    useProjectStore.getState().closeProject()
    await useProjectStore.getState().loadProject(project.id)

    const job = (await repo.getJobsByProject(project.id)).find(
      (j) => j.id === 'job-never-submitted',
    )
    expect(job?.state).toBe('failed')
    expect(job?.error).toMatch(/before submission/)
  })

  it('generateAllVideos only submits scenes with an image and no video', async () => {
    const { sceneId } = await seedProjectWithImage()
    // Add a second scene without an image — must be skipped.
    const current = useProjectStore.getState().project
    if (current === null) throw new Error('project missing')
    const withExtraScene = {
      ...current,
      scenes: [...current.scenes, createScene(1)],
    }
    useProjectStore.setState({ project: withExtraScene })
    const repo = await getRepository()
    await repo.putProject(withExtraScene)

    let submissions = 0
    server.use(
      http.post(`${BASE}/generate-video`, () => {
        submissions += 1
        return HttpResponse.json({
          runId: `vid_run_${String(submissions)}`,
          status: 'pending',
          cost: 0.2,
        })
      }),
    )
    mockStatusSequence(['COMPLETED'])
    mockVideoDownload()

    await useProjectStore.getState().generateAllVideos(VIDEO_MODEL, '5', '480p')
    expect(submissions).toBe(1)

    await vi.waitFor(
      () => {
        const scene = useProjectStore
          .getState()
          .project?.scenes.find((s) => s.id === sceneId)
        expect(scene?.videoVersions).toHaveLength(1)
      },
      { timeout: 3000 },
    )
  })
})

describe('importSceneClip (Slice 15.3)', () => {
  it('imports a video file as a new active take, free of cost', async () => {
    const { sceneId } = await seedProjectWithImage()
    const ok = await useProjectStore
      .getState()
      .importSceneClip(
        sceneId,
        new Blob(['webm-bytes'], { type: 'video/webm' }),
      )
    expect(ok).toBe(true)
    const scene = useProjectStore
      .getState()
      .project?.scenes.find((s) => s.id === sceneId)
    expect(scene?.videoVersions).toHaveLength(1)
    const take = scene?.videoVersions[0]
    expect(take?.model).toBe('imported')
    expect(take?.mimeType).toBe('video/webm')
    expect(take?.costUsd).toBeNull()
    expect(scene?.activeVideoVersionId).toBe(take?.id)
    // The bytes actually landed in the blob store.
    const repo = await getRepository()
    const stored = await repo.blobs.get(take?.blobPath ?? '')
    expect(stored).not.toBeNull()
    // No cost-log entry — nothing was charged.
    expect(useProjectStore.getState().project?.costLog).toHaveLength(0)
  })

  it('refuses a non-video file with a clear error', async () => {
    const { sceneId } = await seedProjectWithImage()
    const ok = await useProjectStore
      .getState()
      .importSceneClip(sceneId, new Blob(['<html>'], { type: 'text/html' }))
    expect(ok).toBe(false)
    expect(
      useProjectStore.getState().sceneVideoStatus[sceneId]?.error,
    ).toContain('Only video files')
    expect(
      useProjectStore.getState().project?.scenes[0]?.videoVersions,
    ).toHaveLength(0)
  })
})

describe('motion prompt override (Slice 11.1)', () => {
  it('sends the override verbatim and stores it on the version', async () => {
    const { project, sceneId } = await seedProjectWithImage()
    const getBody = mockSubmission(0.35)
    mockStatusSequence(['COMPLETED'])
    mockVideoDownload()

    const override = 'the lantern light sweeps slowly across the waves'
    const ok = await useProjectStore
      .getState()
      .generateSceneVideo(sceneId, VIDEO_MODEL, '5', '480p', override)
    expect(ok).toBe(true)
    expect((getBody() as { prompt?: string }).prompt).toBe(override)

    await vi.waitFor(
      () => {
        const scene = useProjectStore.getState().project?.scenes[0]
        expect(scene?.videoVersions).toHaveLength(1)
      },
      { timeout: 3000 },
    )
    const repo = await getRepository()
    const stored = await repo.getProject(project.id)
    expect(stored?.scenes[0]?.videoVersions[0]?.prompt).toBe(override)
  })

  it('refuses an empty override without submitting', async () => {
    const { sceneId } = await seedProjectWithImage()
    const ok = await useProjectStore
      .getState()
      .generateSceneVideo(sceneId, VIDEO_MODEL, '5', '480p', '   ')
    expect(ok).toBe(false)
  })
})
