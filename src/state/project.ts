import { create } from 'zustand'
import type { TextModel } from '../api/nanogpt'
import { applyJobEvent } from '../domain/transitions'
import { scriptSystemPrompt, scriptUserPrompt } from '../domain/prompts'
import type { GenerationJob, Project } from '../domain/types'
import {
  computeActualChatCostUsd,
  estimateChatCostUsd,
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
  loadProject: (id: string) => Promise<void>
  closeProject: () => void
  /** Update script text in memory and schedule a debounced persist. */
  updateScriptText: (text: string) => void
  /** Persist any pending script edits immediately. */
  flushScript: () => Promise<void>
  setScriptLocked: (locked: boolean) => Promise<void>
  /** Generate a script via the chosen model. Returns true on success. */
  generateScript: (model: TextModel, instructions: string) => Promise<boolean>
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

  loadProject: async (id: string) => {
    set({
      projectStatus: 'loading',
      scriptGenStatus: 'idle',
      scriptGenError: null,
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
    if (autosaveTimer !== null) clearTimeout(autosaveTimer)
    autosaveTimer = setTimeout(() => {
      autosaveTimer = null
      const current = get().project
      if (current !== null) void persistProject(current)
    }, AUTOSAVE_DELAY_MS)
  },

  flushScript: async () => {
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
}))
