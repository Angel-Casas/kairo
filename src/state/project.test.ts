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
    await useProjectStore.getState().flushScript()
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
