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
} from 'vitest'
import type { TextModel } from '../api/nanogpt'
import { createProject } from '../domain/types'
import { __resetRepositoryForTests, getRepository } from './repo'
import { useProjectStore } from './project'
import { useSettingsStore } from './settings'

const BASE = 'https://nano-gpt.com/api'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

const nowIso = () => new Date().toISOString()

const MODEL: TextModel = {
  id: 'test/model',
  name: 'Test Model',
  description: '',
  promptPricePerMTok: 2,
  completionPricePerMTok: 10,
}

async function seedProject(title = 'P') {
  const repo = await getRepository()
  const project = createProject(title, nowIso)
  await repo.putProject(project)
  await useProjectStore.getState().loadProject(project.id)
  return project
}

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  __resetRepositoryForTests()
  useProjectStore.setState({
    project: null,
    projectStatus: 'idle',
    scriptGenStatus: 'idle',
    scriptGenError: null,
  })
  useSettingsStore.setState({
    apiKey: 'key-1234',
    keyStatus: 'valid',
    keyError: null,
    balanceUsd: 10,
  })
})

describe('project store — script editing', () => {
  it('loads a project', async () => {
    const project = await seedProject('Loaded')
    expect(useProjectStore.getState().project?.id).toBe(project.id)
    expect(useProjectStore.getState().projectStatus).toBe('ready')
  })

  it('updates script text and persists on flush', async () => {
    const project = await seedProject()
    useProjectStore.getState().updateScriptText('Hello world')
    await useProjectStore.getState().flushProject()
    const repo = await getRepository()
    const stored = await repo.getProject(project.id)
    expect(stored?.script.text).toBe('Hello world')
  })

  it('ignores edits while the script is locked', async () => {
    await seedProject()
    await useProjectStore.getState().setScriptLocked(true)
    useProjectStore.getState().updateScriptText('should not apply')
    expect(useProjectStore.getState().project?.script.text).toBe('')
  })

  it('lock state persists', async () => {
    const project = await seedProject()
    await useProjectStore.getState().setScriptLocked(true)
    const repo = await getRepository()
    expect((await repo.getProject(project.id))?.script.locked).toBe(true)
  })
})

describe('project store — script generation', () => {
  it('writes the result, records a succeeded job and a cost log entry', async () => {
    const project = await seedProject()
    server.use(
      http.post(`${BASE}/v1/chat/completions`, () =>
        HttpResponse.json({
          model: MODEL.id,
          choices: [
            { message: { role: 'assistant', content: '  A great script.  ' } },
          ],
          usage: { prompt_tokens: 117, completion_tokens: 192 },
        }),
      ),
    )

    const ok = await useProjectStore.getState().generateScript(MODEL, 'space')
    expect(ok).toBe(true)

    const state = useProjectStore.getState()
    expect(state.project?.script.text).toBe('A great script.')
    expect(state.scriptGenStatus).toBe('idle')

    const repo = await getRepository()
    const stored = await repo.getProject(project.id)
    expect(stored?.script.text).toBe('A great script.')
    expect(stored?.costLog).toHaveLength(1)
    expect(stored?.costLog[0]?.kind).toBe('text')
    expect(stored?.costLog[0]?.estimatedUsd).toBeGreaterThan(0)
    // Actual cost from usage: 117/1M*$2 + 192/1M*$10 = $0.002154
    expect(stored?.costLog[0]?.actualUsd).toBeCloseTo(0.002154, 7)
    // The estimate is a ceiling: actual must not exceed it.
    expect(stored?.costLog[0]?.actualUsd ?? 0).toBeLessThanOrEqual(
      stored?.costLog[0]?.estimatedUsd ?? 0,
    )

    const jobs = await repo.getJobsByProject(project.id)
    expect(jobs).toHaveLength(1)
    expect(jobs[0]?.state).toBe('succeeded')
    expect(jobs[0]?.kind).toBe('text')
  })

  it('records a failed job and surfaces the error', async () => {
    const project = await seedProject()
    server.use(
      http.post(`${BASE}/v1/chat/completions`, () =>
        HttpResponse.json({ message: 'model unavailable' }, { status: 503 }),
      ),
    )

    const ok = await useProjectStore.getState().generateScript(MODEL, 'space')
    expect(ok).toBe(false)

    const state = useProjectStore.getState()
    expect(state.scriptGenStatus).toBe('error')
    expect(state.scriptGenError).toBe('model unavailable')
    expect(state.project?.script.text).toBe('')

    const repo = await getRepository()
    const jobs = await repo.getJobsByProject(project.id)
    expect(jobs[0]?.state).toBe('failed')
    expect(jobs[0]?.error).toBe('model unavailable')
    expect((await repo.getProject(project.id))?.costLog).toHaveLength(0)
  })

  it('refuses to generate while locked', async () => {
    await seedProject()
    await useProjectStore.getState().setScriptLocked(true)
    const ok = await useProjectStore.getState().generateScript(MODEL, 'x')
    expect(ok).toBe(false)
  })
})

async function seedLockedProject() {
  const project = await seedProject('Scened')
  useProjectStore.getState().updateScriptText('A tale of two castles.')
  await useProjectStore.getState().flushProject()
  await useProjectStore.getState().setScriptLocked(true)
  return project
}

const BREAKDOWN = JSON.stringify([
  { textExcerpt: 'A tale', visualDescription: 'A castle at dawn' },
  {
    textExcerpt: 'of two castles.',
    visualDescription: 'Two castles facing off',
  },
])

describe('project store — scene breakdown generation', () => {
  it('replaces scenes, records job + cost log with actuals', async () => {
    const project = await seedLockedProject()
    server.use(
      http.post(`${BASE}/v1/chat/completions`, () =>
        HttpResponse.json({
          model: MODEL.id,
          choices: [
            {
              message: {
                role: 'assistant',
                content: '```json\n' + BREAKDOWN + '\n```',
              },
            },
          ],
          usage: { prompt_tokens: 200, completion_tokens: 150 },
        }),
      ),
    )

    const ok = await useProjectStore.getState().generateScenes(MODEL)
    expect(ok).toBe(true)

    const stored = await (await getRepository()).getProject(project.id)
    expect(stored?.scenes).toHaveLength(2)
    expect(stored?.scenes[0]?.order).toBe(0)
    expect(stored?.scenes[0]?.visualDescription).toBe('A castle at dawn')
    expect(stored?.scenes[1]?.order).toBe(1)
    expect(stored?.costLog).toHaveLength(1)
    expect(stored?.costLog[0]?.note).toBe('Scene breakdown')
    expect(stored?.costLog[0]?.actualUsd).toBeGreaterThan(0)
  })

  it('fails the job on unparseable output without touching scenes', async () => {
    const project = await seedLockedProject()
    server.use(
      http.post(`${BASE}/v1/chat/completions`, () =>
        HttpResponse.json({
          model: MODEL.id,
          choices: [
            { message: { role: 'assistant', content: 'I refuse to answer.' } },
          ],
        }),
      ),
    )

    const ok = await useProjectStore.getState().generateScenes(MODEL)
    expect(ok).toBe(false)
    expect(useProjectStore.getState().scenesGenStatus).toBe('error')
    expect(useProjectStore.getState().scenesGenError).toMatch(/scene list/)

    const repo = await getRepository()
    const stored = await repo.getProject(project.id)
    expect(stored?.scenes).toHaveLength(0)
    const jobs = await repo.getJobsByProject(project.id)
    expect(jobs[jobs.length - 1]?.state).toBe('failed')
  })

  it('refuses to generate scenes while the script is unlocked', async () => {
    await seedProject()
    useProjectStore.getState().updateScriptText('text')
    const ok = await useProjectStore.getState().generateScenes(MODEL)
    expect(ok).toBe(false)
  })
})

describe('project store — manual scene editing', () => {
  it('adds, updates, and persists scenes', async () => {
    const project = await seedLockedProject()
    await useProjectStore.getState().addScene()
    const scene = useProjectStore.getState().project?.scenes[0]
    expect(scene).toBeDefined()
    useProjectStore
      .getState()
      .updateScene(scene?.id ?? '', { visualDescription: 'A misty forest' })
    await useProjectStore.getState().flushProject()
    const stored = await (await getRepository()).getProject(project.id)
    expect(stored?.scenes[0]?.visualDescription).toBe('A misty forest')
  })

  it('removes scenes and renumbers orders', async () => {
    const project = await seedLockedProject()
    await useProjectStore.getState().addScene()
    await useProjectStore.getState().addScene()
    await useProjectStore.getState().addScene()
    const ids = (useProjectStore.getState().project?.scenes ?? []).map(
      (s) => s.id,
    )
    await useProjectStore.getState().removeScene(ids[1] ?? '')
    const stored = await (await getRepository()).getProject(project.id)
    expect(stored?.scenes).toHaveLength(2)
    expect(stored?.scenes.map((s) => s.order)).toEqual([0, 1])
    expect(stored?.scenes.map((s) => s.id)).toEqual([ids[0], ids[2]])
  })

  it('moves scenes up and down within bounds', async () => {
    await seedLockedProject()
    await useProjectStore.getState().addScene()
    await useProjectStore.getState().addScene()
    const [first, second] = useProjectStore.getState().project?.scenes ?? []
    await useProjectStore.getState().moveScene(second?.id ?? '', -1)
    let scenes = useProjectStore.getState().project?.scenes ?? []
    expect(scenes[0]?.id).toBe(second?.id)
    expect(scenes[1]?.id).toBe(first?.id)
    // Moving the top scene up is a no-op.
    await useProjectStore.getState().moveScene(second?.id ?? '', -1)
    scenes = useProjectStore.getState().project?.scenes ?? []
    expect(scenes[0]?.id).toBe(second?.id)
  })

  it('persists style notes', async () => {
    const project = await seedLockedProject()
    useProjectStore.getState().updateStyleNotes('watercolor, warm tones')
    await useProjectStore.getState().flushProject()
    const stored = await (await getRepository()).getProject(project.id)
    expect(stored?.styleNotes).toBe('watercolor, warm tones')
  })
})
