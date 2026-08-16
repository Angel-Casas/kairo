import { create } from 'zustand'
import type { ImageModel, TextModel } from '../api/nanogpt'
import { applyJobEvent } from '../domain/transitions'
import {
  buildImagePrompt,
  sceneBreakdownSystemPrompt,
  sceneBreakdownUserPrompt,
  scriptSystemPrompt,
  scriptUserPrompt,
} from '../domain/prompts'
import { parseSceneBreakdown, SceneParseError } from '../domain/sceneParser'
import { getStylePreset } from '../domain/stylePresets'
import { createScene } from '../domain/types'
import type {
  AssetVersion,
  GenerationJob,
  Project,
  Scene,
} from '../domain/types'
import {
  computeActualChatCostUsd,
  estimateChatCostUsd,
  SCENES_OUTPUT_TOKEN_BUDGET,
  SCRIPT_OUTPUT_TOKEN_BUDGET,
} from '../lib/costEstimate'
import { getPerImagePriceUsd } from '../lib/resolution'
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
  /** Per-scene image generation status, keyed by scene id. */
  sceneImageStatus: Record<
    string,
    { generating: boolean; error: string | null }
  >
  /** Progress of a running generate-all, or null when not running. */
  allImagesProgress: { done: number; total: number } | null
  setStylePreset: (presetId: string | null) => Promise<void>
  setActiveImageVersion: (sceneId: string, versionId: string) => Promise<void>
  /** Generate one image for a scene as a NEW version. Returns true on success. */
  generateSceneImage: (
    sceneId: string,
    model: ImageModel,
    resolution: string | null,
  ) => Promise<boolean>
  /** Generate images sequentially for every scene without one. */
  generateAllImages: (
    model: ImageModel,
    resolution: string | null,
  ) => Promise<void>
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
  sceneImageStatus: {},
  allImagesProgress: null,

  loadProject: async (id: string) => {
    set({
      projectStatus: 'loading',
      scriptGenStatus: 'idle',
      scriptGenError: null,
      scenesGenStatus: 'idle',
      scenesGenError: null,
      sceneImageStatus: {},
      allImagesProgress: null,
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
  setStylePreset: async (presetId: string | null) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      stylePresetId: presetId,
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  setActiveImageVersion: async (sceneId: string, versionId: string) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      scenes: project.scenes.map((s) =>
        s.id === sceneId && s.imageVersions.some((v) => v.id === versionId)
          ? { ...s, activeImageVersionId: versionId }
          : s,
      ),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  generateSceneImage: async (
    sceneId: string,
    model: ImageModel,
    resolution: string | null,
  ) => {
    const { project } = get()
    const apiKey = useSettingsStore.getState().apiKey
    if (project === null || apiKey === null) return false
    const scene = project.scenes.find((s) => s.id === sceneId)
    if (scene === undefined || scene.visualDescription.trim().length === 0) {
      return false
    }

    set({
      sceneImageStatus: {
        ...get().sceneImageStatus,
        [sceneId]: { generating: true, error: null },
      },
    })

    const repo = await getRepository()
    const prompt = buildImagePrompt({
      stylePromptFragment:
        getStylePreset(project.stylePresetId)?.promptFragment ?? null,
      styleNotes: project.styleNotes,
      visualDescription: scene.visualDescription,
    })
    const priceUsd = getPerImagePriceUsd(model, resolution)

    let job: GenerationJob = {
      id: crypto.randomUUID(),
      projectId: project.id,
      sceneId,
      kind: 'image',
      model: model.id,
      state: 'queued',
      remoteJobId: null,
      error: null,
      estimatedUsd: priceUsd,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await repo.putJob(job)
    job = applyJobEvent(job, { type: 'submit', remoteJobId: null }, nowIso)
    await repo.putJob(job)

    try {
      const images = await getClient(apiKey).generateImage({
        model: model.id,
        prompt,
        ...(resolution !== null ? { resolution } : { aspectRatio: '9:16' }),
        n: 1,
      })
      const image = images[0]
      if (image === undefined) throw new Error('No image was returned.')

      let blob: Blob
      if (image.b64Json !== null) {
        const binary = atob(image.b64Json)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i += 1) {
          bytes[i] = binary.charCodeAt(i)
        }
        blob = new Blob([bytes.buffer], { type: 'image/png' })
      } else if (image.url !== null) {
        const response = await fetch(image.url)
        if (!response.ok) {
          throw new Error('The generated image could not be downloaded.')
        }
        blob = await response.blob()
      } else {
        throw new Error('The response contained no image data.')
      }

      const versionId = crypto.randomUUID()
      const blobPath = `${project.id}/${versionId}`
      await repo.blobs.put(blobPath, blob)

      job = applyJobEvent(job, { type: 'succeed' }, nowIso)
      await repo.putJob(job)

      const current = get().project
      if (current === null) return false
      const version: AssetVersion = {
        id: versionId,
        kind: 'image',
        model: model.id,
        prompt,
        costUsd: priceUsd,
        blobPath,
        mimeType: blob.type.length > 0 ? blob.type : 'image/png',
        createdAt: nowIso(),
      }
      const updated: Project = {
        ...current,
        scenes: current.scenes.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                imageVersions: [...s.imageVersions, version],
                activeImageVersionId: version.id,
              }
            : s,
        ),
        costLog: [
          ...current.costLog,
          {
            id: crypto.randomUUID(),
            at: nowIso(),
            kind: 'image',
            model: model.id,
            estimatedUsd: priceUsd,
            actualUsd: priceUsd,
            note: 'Scene image',
          },
        ],
        updatedAt: nowIso(),
      }
      const { [sceneId]: _done, ...restStatus } = get().sceneImageStatus
      set({ project: updated, sceneImageStatus: restStatus })
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
        sceneImageStatus: {
          ...get().sceneImageStatus,
          [sceneId]: {
            generating: false,
            error:
              error instanceof Error
                ? error.message
                : 'Image generation failed.',
          },
        },
      })
      return false
    }
  },

  generateAllImages: async (model: ImageModel, resolution: string | null) => {
    const { project, generateSceneImage } = get()
    if (project === null) return
    const pending = [...project.scenes]
      .sort((a, b) => a.order - b.order)
      .filter((s) => s.imageVersions.length === 0)
      .filter((s) => s.visualDescription.trim().length > 0)
    if (pending.length === 0) return
    set({ allImagesProgress: { done: 0, total: pending.length } })
    let done = 0
    for (const scene of pending) {
      await generateSceneImage(scene.id, model, resolution)
      done += 1
      set({ allImagesProgress: { done, total: pending.length } })
    }
    set({ allImagesProgress: null })
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
