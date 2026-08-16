import { create } from 'zustand'
import type { TextModel } from '../api/nanogpt'
import { applyJobEvent } from '../domain/transitions'
import {
  sceneBreakdownSystemPrompt,
  sceneBreakdownUserPrompt,
  scriptSystemPrompt,
  scriptUserPrompt,
} from '../domain/prompts'
import { parseSceneBreakdown, SceneParseError } from '../domain/sceneParser'
import { createScene } from '../domain/types'
import type { GenerationJob, Project, Scene } from '../domain/types'
import {
  computeActualChatCostUsd,
  estimateChatCostUsd,
  SCENES_OUTPUT_TOKEN_BUDGET,
  SCRIPT_OUTPUT_TOKEN_BUDGET,
} from '../lib/costEstimate'
import { getClient } from './settings'
import { getRepository } from './repo'
import { useSettingsStore } from './settings'

const nowIso = () => new Date().toISOString()

const AUTOSAVE_DELAY_MS = 500

let autosaveTimer: ReturnType<typeof setTimeout> | null = null

interface ProjectState {
  project: Project | null
  projectStatus: 'idle' | 'loading' | 'ready'
  scriptGenStatus: 'idle' | 'generating' | 'error'
  scriptGenError: string | null
  scenesGenStatus: 'idle' | 'generating' | 'error'
  scenesGenError: string | null
  loadProject: (id: string) => Promise<void>
  closeProject: () => void
  /** Update script text in memory and schedule a debounced persist. */
  updateScriptText: (text: string) => void
  /** Persist any pending debounced edits immediately. */
  flushProject: () => Promise<void>
  setScriptLocked: (locked: boolean) => Promise<void>
  /** Generate a script via the chosen model. Returns true on success. */
  generateScript: (model: TextModel, instructions: string) => Promise<boolean>
  updateStyleNotes: (text: string) => void
  updateScene: (
    sceneId: string,
    fields: Partial<Pick<Scene, 'textExcerpt' | 'visualDescription'>>,
  ) => void
  addScene: () => Promise<void>
  removeScene: (sceneId: string) => Promise<void>
  /** Move a scene one position up (-1) or down (+1). */
  moveScene: (sceneId: string, direction: -1 | 1) => Promise<void>
  /** AI scene breakdown of the locked script. Replaces existing scenes. */
  generateScenes: (model: TextModel) => Promise<boolean>
}

async function persistProject(project: Project): Promise<void> {
  const repo = await getRepository()
  await repo.putProject(project)
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  projectStatus: 'idle',
  scriptGenStatus: 'idle',
  scriptGenError: null,
  scenesGenStatus: 'idle',
  scenesGenError: null,

  loadProject: async (id: string) => {
    set({
      projectStatus: 'loading',
      scriptGenStatus: 'idle',
      scriptGenError: null,
      scenesGenStatus: 'idle',
      scenesGenError: null,
    })
    const repo = await getRepository()
    const project = await repo.getProject(id)
    set({ project: project ?? null, projectStatus: 'ready' })
  },

  closeProject: () => {
    if (autosaveTimer !== null) clearTimeout(autosaveTimer)
    autosaveTimer = null
    set({ project: null, projectStatus: 'idle' })
  },

  updateScriptText: (text: string) => {
    const { project } = get()
    if (project === null || project.script.locked) return
    const updated: Project = {
      ...project,
      script: { ...project.script, text },
      updatedAt: nowIso(),
    }
    set({ project: updated })
    scheduleAutosave(get)
  },

  flushProject: async () => {
    if (autosaveTimer !== null) {
      clearTimeout(autosaveTimer)
      autosaveTimer = null
    }
    const { project } = get()
    if (project !== null) await persistProject(project)
  },

  setScriptLocked: async (locked: boolean) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      script: { ...project.script, locked },
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  generateScript: async (model: TextModel, instructions: string) => {
    const { project } = get()
    const apiKey = useSettingsStore.getState().apiKey
    if (project === null || apiKey === null || project.script.locked) {
      return false
    }
    set({ scriptGenStatus: 'generating', scriptGenError: null })

    const repo = await getRepository()
    const promptText = `${scriptSystemPrompt()}\n${scriptUserPrompt(instructions)}`
    const estimatedUsd = estimateChatCostUsd({
      promptText,
      outputTokenBudget: SCRIPT_OUTPUT_TOKEN_BUDGET,
      promptPricePerMTok: model.promptPricePerMTok,
      completionPricePerMTok: model.completionPricePerMTok,
    })

    let job: GenerationJob = {
      id: crypto.randomUUID(),
      projectId: project.id,
      sceneId: null,
      kind: 'text',
      model: model.id,
      state: 'queued',
      remoteJobId: null,
      error: null,
      estimatedUsd,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await repo.putJob(job)
    job = applyJobEvent(job, { type: 'submit', remoteJobId: null }, nowIso)
    await repo.putJob(job)

    try {
      const result = await getClient(apiKey).chatComplete(
        model.id,
        [
          { role: 'system', content: scriptSystemPrompt() },
          { role: 'user', content: scriptUserPrompt(instructions) },
        ],
        { maxTokens: SCRIPT_OUTPUT_TOKEN_BUDGET },
      )
      job = applyJobEvent(job, { type: 'succeed' }, nowIso)
      await repo.putJob(job)

      const actualUsd =
        result.usage === null
          ? null
          : computeActualChatCostUsd({
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              promptPricePerMTok: model.promptPricePerMTok,
              completionPricePerMTok: model.completionPricePerMTok,
            })

      const current = get().project
      if (current === null) return false
      const updated: Project = {
        ...current,
        script: { ...current.script, text: result.content.trim() },
        costLog: [
          ...current.costLog,
          {
            id: crypto.randomUUID(),
            at: nowIso(),
            kind: 'text',
            model: model.id,
            estimatedUsd,
            actualUsd,
            note: 'Script generation',
          },
        ],
        updatedAt: nowIso(),
      }
      set({ project: updated, scriptGenStatus: 'idle' })
      await persistProject(updated)
      return true
    } catch (error) {
      job = applyJobEvent(
        job,
        {
          type: 'fail',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        nowIso,
      )
      await repo.putJob(job)
      set({
        scriptGenStatus: 'error',
        scriptGenError:
          error instanceof Error ? error.message : 'Generation failed.',
      })
      return false
    }
  },

  updateStyleNotes: (text: string) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      styleNotes: text,
      updatedAt: nowIso(),
    }
    set({ project: updated })
    scheduleAutosave(get)
  },

  updateScene: (sceneId, fields) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      scenes: project.scenes.map((s) =>
        s.id === sceneId ? { ...s, ...fields } : s,
      ),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    scheduleAutosave(get)
  },

  addScene: async () => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      scenes: [...project.scenes, createScene(project.scenes.length)],
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  removeScene: async (sceneId: string) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      scenes: project.scenes
        .filter((s) => s.id !== sceneId)
        .map((s, index) => ({ ...s, order: index })),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  moveScene: async (sceneId: string, direction: -1 | 1) => {
    const { project } = get()
    if (project === null) return
    const sorted = [...project.scenes].sort((a, b) => a.order - b.order)
    const index = sorted.findIndex((s) => s.id === sceneId)
    const target = index + direction
    if (index === -1 || target < 0 || target >= sorted.length) return
    const swapped = sorted[target]
    const moving = sorted[index]
    if (swapped === undefined || moving === undefined) return
    sorted[target] = moving
    sorted[index] = swapped
    const updated: Project = {
      ...project,
      scenes: sorted.map((s, i) => ({ ...s, order: i })),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  generateScenes: async (model: TextModel) => {
    const { project } = get()
    const apiKey = useSettingsStore.getState().apiKey
    if (
      project === null ||
      apiKey === null ||
      !project.script.locked ||
      project.script.text.trim().length === 0
    ) {
      return false
    }
    set({ scenesGenStatus: 'generating', scenesGenError: null })

    const repo = await getRepository()
    const promptText = `${sceneBreakdownSystemPrompt()}\n${sceneBreakdownUserPrompt(project.script.text)}`
    const estimatedUsd = estimateChatCostUsd({
      promptText,
      outputTokenBudget: SCENES_OUTPUT_TOKEN_BUDGET,
      promptPricePerMTok: model.promptPricePerMTok,
      completionPricePerMTok: model.completionPricePerMTok,
    })

    let job: GenerationJob = {
      id: crypto.randomUUID(),
      projectId: project.id,
      sceneId: null,
      kind: 'text',
      model: model.id,
      state: 'queued',
      remoteJobId: null,
      error: null,
      estimatedUsd,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await repo.putJob(job)
    job = applyJobEvent(job, { type: 'submit', remoteJobId: null }, nowIso)
    await repo.putJob(job)

    try {
      const result = await getClient(apiKey).chatComplete(
        model.id,
        [
          { role: 'system', content: sceneBreakdownSystemPrompt() },
          {
            role: 'user',
            content: sceneBreakdownUserPrompt(project.script.text),
          },
        ],
        { maxTokens: SCENES_OUTPUT_TOKEN_BUDGET },
      )
      const parsed = parseSceneBreakdown(result.content)
      job = applyJobEvent(job, { type: 'succeed' }, nowIso)
      await repo.putJob(job)

      const actualUsd =
        result.usage === null
          ? null
          : computeActualChatCostUsd({
              promptTokens: result.usage.promptTokens,
              completionTokens: result.usage.completionTokens,
              promptPricePerMTok: model.promptPricePerMTok,
              completionPricePerMTok: model.completionPricePerMTok,
            })

      const current = get().project
      if (current === null) return false
      const scenes: Scene[] = parsed.map((p, index) => ({
        ...createScene(index),
        textExcerpt: p.textExcerpt,
        visualDescription: p.visualDescription,
      }))
      const updated: Project = {
        ...current,
        scenes,
        costLog: [
          ...current.costLog,
          {
            id: crypto.randomUUID(),
            at: nowIso(),
            kind: 'text',
            model: model.id,
            estimatedUsd,
            actualUsd,
            note: 'Scene breakdown',
          },
        ],
        updatedAt: nowIso(),
      }
      set({ project: updated, scenesGenStatus: 'idle' })
      await persistProject(updated)
      return true
    } catch (error) {
      job = applyJobEvent(
        job,
        {
          type: 'fail',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        nowIso,
      )
      await repo.putJob(job)
      set({
        scenesGenStatus: 'error',
        scenesGenError:
          error instanceof SceneParseError
            ? error.message
            : error instanceof Error
              ? error.message
              : 'Scene breakdown failed.',
      })
      return false
    }
  },
}))

function scheduleAutosave(get: () => ProjectState): void {
  if (autosaveTimer !== null) clearTimeout(autosaveTimer)
  autosaveTimer = setTimeout(() => {
    autosaveTimer = null
    const current = get().project
    if (current !== null) void persistProject(current)
  }, AUTOSAVE_DELAY_MS)
}
