import { create } from 'zustand'
import type {
  ImageModel,
  TextModel,
  TtsModel,
  VideoModel,
} from '../api/nanogpt'
import {
  buildImagePrompt,
  buildVideoPrompt,
  sceneBreakdownSystemPrompt,
  sceneBreakdownUserPrompt,
  scriptSystemPrompt,
  scriptUserPrompt,
  styleFromImageSystemPrompt,
  styleFromImageUserText,
} from '../domain/prompts'
import { parseSceneBreakdown } from '../domain/sceneParser'
import { getStylePreset } from '../domain/stylePresets'
import { applyJobEvent, isActiveJobState } from '../domain/transitions'
import { createReference, createScene } from '../domain/types'
import type {
  AssetVersion,
  GenerationJob,
  Project,
  ReferenceAsset,
  ReferenceKind,
  Scene,
} from '../domain/types'
import {
  computeActualChatCostUsd,
  estimateChatCostUsd,
  SCENES_OUTPUT_TOKEN_BUDGET,
  SCRIPT_OUTPUT_TOKEN_BUDGET,
  STYLE_FROM_IMAGE_OUTPUT_TOKEN_BUDGET,
} from '../lib/costEstimate'
import { isPlayableAudio, normalizeAudioBlob } from '../lib/audioBlob'
import { getPerImagePriceUsd } from '../lib/resolution'
import {
  ttsCostUsd,
  VOICE_PREVIEW_TEXT,
  voiceLabel,
  voicePreviewPath,
} from '../domain/ttsModels'
import { withGenerationJob } from './generationJob'
import { getClient } from './settings'
import { getRepository } from './repo'
import { useSettingsStore } from './settings'

const nowIso = () => new Date().toISOString()

export type VoicePreviewResult =
  { ok: true; blob: Blob } | { ok: false; error: string }

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
    fields: Partial<
      Pick<Scene, 'textExcerpt' | 'visualDescription' | 'cameraNotes'>
    >,
  ) => void
  addScene: () => Promise<void>
  removeScene: (sceneId: string) => Promise<void>
  /** Move a scene one position up (-1) or down (+1). */
  moveScene: (sceneId: string, direction: -1 | 1) => Promise<void>
  /** AI scene breakdown of the locked script. Replaces existing scenes. */
  generateScenes: (model: TextModel) => Promise<boolean>
  styleFromImageStatus: 'idle' | 'generating' | 'error'
  styleFromImageError: string | null
  /**
   * Style-from-image (Slice 12): a vision model turns a local reference
   * image into style-notes text. Returns the proposed notes (the caller
   * previews them; nothing is applied to the project here), or null on
   * failure. The image goes to NanoGPT only, as a base64 data URL.
   */
  describeStyleFromImage: (
    model: TextModel,
    file: Blob,
  ) => Promise<string | null>
  /** Add an empty reference of the given kind (Slice 10). */
  addReference: (kind: ReferenceKind) => Promise<void>
  /** Update reference text fields in memory; debounced persist. */
  updateReference: (
    referenceId: string,
    fields: Partial<Pick<ReferenceAsset, 'kind' | 'name' | 'descriptor'>>,
  ) => void
  /** Remove a reference and untick it from every scene. */
  removeReference: (referenceId: string) => Promise<void>
  /** Tick or untick a reference on a scene. */
  toggleSceneReference: (sceneId: string, referenceId: string) => Promise<void>
  /** Per-reference image generation/import status, keyed by reference id. */
  referenceImageStatus: Record<
    string,
    { generating: boolean; error: string | null }
  >
  setActiveReferenceImageVersion: (
    referenceId: string,
    versionId: string,
  ) => Promise<void>
  /** Import a user-provided image file as a new reference image version. */
  importReferenceImage: (referenceId: string, file: Blob) => Promise<boolean>
  /**
   * Generate a reference image from its descriptor as a NEW version.
   * `promptOverride` (Slice 11) sends the given prompt VERBATIM instead of
   * composing style + descriptor — surgical iteration on a past prompt.
   */
  generateReferenceImage: (
    referenceId: string,
    model: ImageModel,
    resolution: string | null,
    promptOverride?: string,
  ) => Promise<boolean>
  /** Per-scene image generation status, keyed by scene id. */
  sceneImageStatus: Record<
    string,
    { generating: boolean; error: string | null }
  >
  /** Progress of a running generate-all, or null when not running. */
  allImagesProgress: { done: number; total: number } | null
  setStylePreset: (presetId: string | null) => Promise<void>
  setActiveImageVersion: (sceneId: string, versionId: string) => Promise<void>
  /**
   * Generate one image for a scene as a NEW version. Returns true on success.
   * `promptOverride` (Slice 11) sends the given prompt VERBATIM instead of
   * composing style + references + description; reference image attachment
   * still follows the scene's ticks and the model's capability.
   */
  generateSceneImage: (
    sceneId: string,
    model: ImageModel,
    resolution: string | null,
    promptOverride?: string,
  ) => Promise<boolean>
  /** Generate images sequentially for every scene without one. */
  generateAllImages: (
    model: ImageModel,
    resolution: string | null,
  ) => Promise<void>
  /** Per-scene narration (TTS) status, keyed by scene id. */
  sceneAudioStatus: Record<
    string,
    { generating: boolean; error: string | null }
  >
  /** Progress of a running narrate-all, or null when not running. */
  allAudioProgress: { done: number; total: number } | null
  setActiveAudioVersion: (sceneId: string, versionId: string) => Promise<void>
  /**
   * Narrate one scene's script excerpt as a NEW audio version. TTS is billed
   * by input characters, so the cost is EXACT before the call. `textOverride`
   * narrates the given text verbatim instead of the excerpt.
   */
  generateSceneAudio: (
    sceneId: string,
    model: TtsModel,
    voice: string,
    textOverride?: string,
  ) => Promise<boolean>
  /** Narrate sequentially every scene without narration. */
  generateAllAudio: (model: TtsModel, voice: string) => Promise<void>
  /**
   * Play-before-you-pay voice preview (Slice 15.9): narrate the short
   * fixed preview sentence with the given model+voice ONCE, cache the
   * audio in OPFS forever, and log the exact spend. Cached previews
   * replay free; unplayable cache entries are evicted and regenerated.
   * Failures carry the real reason (15.9.2) — the API's own error, or
   * "the model returned unplayable data" when the provider billed us
   * but sent bytes no decoder understands (spend still logged then).
   */
  previewVoice: (model: TtsModel, voice: string) => Promise<VoicePreviewResult>
  /** Per-scene video generation status, keyed by scene id. */
  sceneVideoStatus: Record<
    string,
    { generating: boolean; error: string | null }
  >
  setActiveVideoVersion: (sceneId: string, versionId: string) => Promise<void>
  /**
   * Submit an image-to-video job for a scene's active image. Charged at
   * submission; polling continues in the background (and resumes after a
   * reload). Returns true if the submission succeeded. `promptOverride`
   * (Slice 11.1) sends the given motion prompt VERBATIM instead of deriving
   * it from the visual description — callers must confirm cost first.
   */
  generateSceneVideo: (
    sceneId: string,
    model: VideoModel,
    duration: string,
    resolution: string | null,
    promptOverride?: string,
  ) => Promise<boolean>
  /**
   * Import a video file as a NEW clip take for a scene. The escape hatch
   * for models whose storage blocks browser downloads (CORS): download the
   * clip from NanoGPT's site, then bring it in here — no regeneration cost.
   */
  importSceneClip: (sceneId: string, file: Blob) => Promise<boolean>
  /** Submit video jobs for every scene with an image but no video. */
  generateAllVideos: (
    model: VideoModel,
    duration: string,
    resolution: string | null,
  ) => Promise<void>
  /** Resume polling for interrupted video jobs (called on project load). */
  resumeVideoJobs: () => Promise<void>
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
  sceneAudioStatus: {},
  allAudioProgress: null,
  sceneVideoStatus: {},
  referenceImageStatus: {},

  loadProject: async (id: string) => {
    set({
      projectStatus: 'loading',
      scriptGenStatus: 'idle',
      scriptGenError: null,
      scenesGenStatus: 'idle',
      scenesGenError: null,
      sceneImageStatus: {},
      allImagesProgress: null,
      sceneAudioStatus: {},
      allAudioProgress: null,
      sceneVideoStatus: {},
      referenceImageStatus: {},
      styleFromImageStatus: 'idle',
      styleFromImageError: null,
    })
    const repo = await getRepository()
    const project = await repo.getProject(id)
    set({ project: project ?? null, projectStatus: 'ready' })
    await get().resumeVideoJobs()
  },

  closeProject: () => {
    if (autosaveTimer !== null) clearTimeout(autosaveTimer)
    autosaveTimer = null
    stopAllVideoPollers()
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

    const promptText = `${scriptSystemPrompt()}\n${scriptUserPrompt(instructions)}`
    const estimatedUsd = estimateChatCostUsd({
      promptText,
      outputTokenBudget: SCRIPT_OUTPUT_TOKEN_BUDGET,
      promptPricePerMTok: model.promptPricePerMTok,
      completionPricePerMTok: model.completionPricePerMTok,
    })

    const outcome = await withGenerationJob({
      projectId: project.id,
      sceneId: null,
      kind: 'text',
      model: model.id,
      estimatedUsd,
      run: () =>
        getClient(apiKey).chatComplete(
          model.id,
          [
            { role: 'system', content: scriptSystemPrompt() },
            { role: 'user', content: scriptUserPrompt(instructions) },
          ],
          { maxTokens: SCRIPT_OUTPUT_TOKEN_BUDGET },
        ),
    })

    if (!outcome.ok) {
      set({ scriptGenStatus: 'error', scriptGenError: outcome.error.message })
      return false
    }
    const result = outcome.value

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

    const promptText = `${sceneBreakdownSystemPrompt()}\n${sceneBreakdownUserPrompt(project.script.text)}`
    const estimatedUsd = estimateChatCostUsd({
      promptText,
      outputTokenBudget: SCENES_OUTPUT_TOKEN_BUDGET,
      promptPricePerMTok: model.promptPricePerMTok,
      completionPricePerMTok: model.completionPricePerMTok,
    })

    const outcome = await withGenerationJob({
      projectId: project.id,
      sceneId: null,
      kind: 'text',
      model: model.id,
      estimatedUsd,
      run: async () => {
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
        return { parsed: parseSceneBreakdown(result.content), result }
      },
    })

    if (!outcome.ok) {
      set({ scenesGenStatus: 'error', scenesGenError: outcome.error.message })
      return false
    }
    const { parsed, result } = outcome.value

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
  },
  styleFromImageStatus: 'idle',
  styleFromImageError: null,

  describeStyleFromImage: async (model: TextModel, file: Blob) => {
    const { project } = get()
    const apiKey = useSettingsStore.getState().apiKey
    if (project === null || apiKey === null) return null
    const acceptedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
    if (!acceptedTypes.includes(file.type)) {
      set({
        styleFromImageStatus: 'error',
        styleFromImageError:
          'Only PNG, JPEG, or WebP images can be used as a style reference.',
      })
      return null
    }
    set({ styleFromImageStatus: 'generating', styleFromImageError: null })

    const promptText = `${styleFromImageSystemPrompt()}\n${styleFromImageUserText()}`
    // Text-side estimate only — the image adds model-dependent prompt
    // tokens the catalog does not price upfront; actuals cover them.
    const estimatedUsd = estimateChatCostUsd({
      promptText,
      outputTokenBudget: STYLE_FROM_IMAGE_OUTPUT_TOKEN_BUDGET,
      promptPricePerMTok: model.promptPricePerMTok,
      completionPricePerMTok: model.completionPricePerMTok,
    })

    const imageDataUrl = await blobToDataUrl(file)
    const outcome = await withGenerationJob({
      projectId: project.id,
      sceneId: null,
      kind: 'text',
      model: model.id,
      estimatedUsd,
      run: () =>
        getClient(apiKey).chatComplete(
          model.id,
          [
            { role: 'system', content: styleFromImageSystemPrompt() },
            {
              role: 'user',
              content: [
                { type: 'text', text: styleFromImageUserText() },
                { type: 'image_url', image_url: { url: imageDataUrl } },
              ],
            },
          ],
          { maxTokens: STYLE_FROM_IMAGE_OUTPUT_TOKEN_BUDGET },
        ),
    })

    if (!outcome.ok) {
      set({
        styleFromImageStatus: 'error',
        styleFromImageError: outcome.error.message,
      })
      return null
    }
    const result = outcome.value

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
    if (current === null || current.id !== project.id) return null
    const updated: Project = {
      ...current,
      costLog: [
        ...current.costLog,
        {
          id: crypto.randomUUID(),
          at: nowIso(),
          kind: 'text',
          model: model.id,
          estimatedUsd,
          actualUsd,
          note: 'Style from image',
        },
      ],
      updatedAt: nowIso(),
    }
    set({ project: updated, styleFromImageStatus: 'idle' })
    await persistProject(updated)
    return result.content.trim()
  },

  addReference: async (kind: ReferenceKind) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      references: [...project.references, createReference(kind, nowIso)],
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  updateReference: (referenceId, fields) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      references: project.references.map((r) =>
        r.id === referenceId ? { ...r, ...fields } : r,
      ),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    scheduleAutosave(get)
  },

  removeReference: async (referenceId: string) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      references: project.references.filter((r) => r.id !== referenceId),
      scenes: project.scenes.map((s) =>
        s.referenceIds.includes(referenceId)
          ? {
              ...s,
              referenceIds: s.referenceIds.filter((id) => id !== referenceId),
            }
          : s,
      ),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  toggleSceneReference: async (sceneId: string, referenceId: string) => {
    const { project } = get()
    if (project === null) return
    if (!project.references.some((r) => r.id === referenceId)) return
    const updated: Project = {
      ...project,
      scenes: project.scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              referenceIds: s.referenceIds.includes(referenceId)
                ? s.referenceIds.filter((id) => id !== referenceId)
                : [...s.referenceIds, referenceId],
            }
          : s,
      ),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  setActiveReferenceImageVersion: async (
    referenceId: string,
    versionId: string,
  ) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      references: project.references.map((r) =>
        r.id === referenceId && r.imageVersions.some((v) => v.id === versionId)
          ? { ...r, activeImageVersionId: versionId }
          : r,
      ),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  importReferenceImage: async (referenceId: string, file: Blob) => {
    const { project } = get()
    if (project === null) return false
    const reference = project.references.find((r) => r.id === referenceId)
    if (reference === undefined) return false
    if (!file.type.startsWith('image/')) {
      set({
        referenceImageStatus: {
          ...get().referenceImageStatus,
          [referenceId]: {
            generating: false,
            error: 'Only image files can be imported as references.',
          },
        },
      })
      return false
    }

    const repo = await getRepository()
    const versionId = crypto.randomUUID()
    const blobPath = `${project.id}/${versionId}`
    await repo.blobs.put(blobPath, file)

    const version: AssetVersion = {
      id: versionId,
      kind: 'image',
      model: 'imported',
      prompt: '',
      costUsd: null,
      blobPath,
      mimeType: file.type,
      createdAt: nowIso(),
    }
    const current = get().project
    if (current === null) return false
    const updated: Project = {
      ...current,
      references: current.references.map((r) =>
        r.id === referenceId
          ? {
              ...r,
              imageVersions: [...r.imageVersions, version],
              activeImageVersionId: version.id,
            }
          : r,
      ),
      updatedAt: nowIso(),
    }
    const { [referenceId]: _cleared, ...restStatus } =
      get().referenceImageStatus
    set({ project: updated, referenceImageStatus: restStatus })
    await persistProject(updated)
    return true
  },

  generateReferenceImage: async (
    referenceId: string,
    model: ImageModel,
    resolution: string | null,
    promptOverride?: string,
  ) => {
    const { project } = get()
    const apiKey = useSettingsStore.getState().apiKey
    if (project === null || apiKey === null) return false
    const reference = project.references.find((r) => r.id === referenceId)
    if (reference === undefined) return false
    if (promptOverride !== undefined) {
      if (promptOverride.trim().length === 0) return false
    } else if (reference.descriptor.trim().length === 0) {
      return false
    }

    set({
      referenceImageStatus: {
        ...get().referenceImageStatus,
        [referenceId]: { generating: true, error: null },
      },
    })

    const repo = await getRepository()
    // The reference image carries the project style so scenes built on it
    // match; an override (Slice 11) is sent verbatim instead.
    const prompt =
      promptOverride ??
      buildImagePrompt({
        stylePromptFragment:
          getStylePreset(project.stylePresetId)?.promptFragment ?? null,
        styleNotes: project.styleNotes,
        visualDescription: reference.descriptor,
      })
    const priceUsd = getPerImagePriceUsd(model, resolution)

    const outcome = await withGenerationJob({
      projectId: project.id,
      sceneId: null,
      kind: 'image',
      model: model.id,
      estimatedUsd: priceUsd,
      run: async () => {
        const images = await getClient(apiKey).generateImage({
          model: model.id,
          prompt,
          ...(resolution !== null ? { resolution } : { aspectRatio: '9:16' }),
          n: 1,
        })
        const image = images[0]
        if (image === undefined) throw new Error('No image was returned.')
        const blob = await imageResultToBlob(image)
        const versionId = crypto.randomUUID()
        const blobPath = `${project.id}/${versionId}`
        await repo.blobs.put(blobPath, blob)
        return { blob, versionId, blobPath }
      },
    })

    if (!outcome.ok) {
      set({
        referenceImageStatus: {
          ...get().referenceImageStatus,
          [referenceId]: { generating: false, error: outcome.error.message },
        },
      })
      return false
    }
    const { blob, versionId, blobPath } = outcome.value

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
      references: current.references.map((r) =>
        r.id === referenceId
          ? {
              ...r,
              imageVersions: [...r.imageVersions, version],
              activeImageVersionId: version.id,
            }
          : r,
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
          note: 'Reference image',
        },
      ],
      updatedAt: nowIso(),
    }
    const { [referenceId]: _done, ...restStatus } = get().referenceImageStatus
    set({ project: updated, referenceImageStatus: restStatus })
    await persistProject(updated)
    return true
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
    promptOverride?: string,
  ) => {
    const { project } = get()
    const apiKey = useSettingsStore.getState().apiKey
    if (project === null || apiKey === null) return false
    const scene = project.scenes.find((s) => s.id === sceneId)
    if (scene === undefined) return false
    if (promptOverride !== undefined) {
      if (promptOverride.trim().length === 0) return false
    } else if (scene.visualDescription.trim().length === 0) {
      return false
    }

    set({
      sceneImageStatus: {
        ...get().sceneImageStatus,
        [sceneId]: { generating: true, error: null },
      },
    })

    const repo = await getRepository()
    // References in project order; descriptors go in verbatim (Slice 10).
    const sceneReferences = project.references.filter((r) =>
      scene.referenceIds.includes(r.id),
    )
    // An override (Slice 11) is sent verbatim — no recomposition. Reference
    // image attachment below is a separate input and still applies.
    const prompt =
      promptOverride ??
      buildImagePrompt({
        stylePromptFragment:
          getStylePreset(project.stylePresetId)?.promptFragment ?? null,
        styleNotes: project.styleNotes,
        referenceDescriptors: sceneReferences.map((r) => r.descriptor),
        visualDescription: scene.visualDescription,
      })
    const priceUsd = getPerImagePriceUsd(model, resolution)

    // Attach active reference images for image-to-image capable models
    // (Slice 10 Part B). Models without the capability generate text-only —
    // the Images stage says so next to the scene.
    const referenceImageUrls: string[] = []
    if (model.supportsImageToImage) {
      for (const reference of sceneReferences) {
        const active = reference.imageVersions.find(
          (v) => v.id === reference.activeImageVersionId,
        )
        if (active === undefined) continue
        const referenceBlob = await repo.blobs.get(active.blobPath)
        if (referenceBlob === null) continue
        referenceImageUrls.push(await blobToDataUrl(referenceBlob))
      }
    }

    const outcome = await withGenerationJob({
      projectId: project.id,
      sceneId,
      kind: 'image',
      model: model.id,
      estimatedUsd: priceUsd,
      run: async () => {
        const images = await getClient(apiKey).generateImage({
          model: model.id,
          prompt,
          ...(resolution !== null ? { resolution } : { aspectRatio: '9:16' }),
          n: 1,
          ...(referenceImageUrls.length > 0
            ? { inputReferences: referenceImageUrls }
            : {}),
        })
        const image = images[0]
        if (image === undefined) throw new Error('No image was returned.')
        const blob = await imageResultToBlob(image)
        const versionId = crypto.randomUUID()
        const blobPath = `${project.id}/${versionId}`
        await repo.blobs.put(blobPath, blob)
        return { blob, versionId, blobPath }
      },
    })

    if (!outcome.ok) {
      set({
        sceneImageStatus: {
          ...get().sceneImageStatus,
          [sceneId]: { generating: false, error: outcome.error.message },
        },
      })
      return false
    }
    const { blob, versionId, blobPath } = outcome.value

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

  setActiveAudioVersion: async (sceneId: string, versionId: string) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      scenes: project.scenes.map((s) =>
        s.id === sceneId && s.audioVersions.some((v) => v.id === versionId)
          ? { ...s, activeAudioVersionId: versionId }
          : s,
      ),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  generateSceneAudio: async (
    sceneId: string,
    model: TtsModel,
    voice: string,
    textOverride?: string,
  ) => {
    const { project } = get()
    const apiKey = useSettingsStore.getState().apiKey
    if (project === null || apiKey === null) return false
    const scene = project.scenes.find((s) => s.id === sceneId)
    if (scene === undefined) return false
    const text = (textOverride ?? scene.textExcerpt).trim()
    if (text.length === 0) return false
    if (model.maxInputChars !== null && text.length > model.maxInputChars) {
      set({
        sceneAudioStatus: {
          ...get().sceneAudioStatus,
          [sceneId]: {
            generating: false,
            error: `This excerpt is ${String(text.length)} characters — ${model.name} accepts at most ${String(model.maxInputChars)}.`,
          },
        },
      })
      return false
    }

    set({
      sceneAudioStatus: {
        ...get().sceneAudioStatus,
        [sceneId]: { generating: true, error: null },
      },
    })

    const repo = await getRepository()
    // Billed by input characters — this price is exact, not an estimate.
    const priceUsd = ttsCostUsd(model, text)
    // Queue models charge at submission; a failed run must still be booked.
    const queuedCharge = { charged: false, costUsd: null as number | null }

    const outcome = await withGenerationJob({
      projectId: project.id,
      sceneId,
      kind: 'audio',
      model: model.id,
      estimatedUsd: priceUsd,
      run: async () => {
        const raw = await getClient(apiKey).generateSpeech({
          model: model.id,
          input: text,
          voice,
          onQueued: (info) => {
            queuedCharge.charged = info.charged
            queuedCharge.costUsd = info.costUsd
          },
        })
        // Providers behind the speech endpoint don't all honor
        // response_format — sniff the real container (or unwrap a JSON
        // envelope) so playback never silently fails (Slice 15.9.1).
        const blob = await normalizeAudioBlob(raw)
        if (blob === null) {
          throw new Error(
            'The model returned no playable audio. Try another voice or model.',
          )
        }
        const versionId = crypto.randomUUID()
        const blobPath = `${project.id}/${versionId}`
        await repo.blobs.put(blobPath, blob)
        return { blob, versionId, blobPath }
      },
    })

    if (!outcome.ok) {
      if (queuedCharge.charged) {
        const current = get().project
        if (current !== null) {
          const booked: Project = {
            ...current,
            costLog: [
              ...current.costLog,
              {
                id: crypto.randomUUID(),
                at: nowIso(),
                kind: 'audio',
                model: model.id,
                estimatedUsd: priceUsd,
                actualUsd: queuedCharge.costUsd ?? priceUsd,
                note: 'Scene narration — run failed after being charged at submission',
              },
            ],
            updatedAt: nowIso(),
          }
          set({ project: booked })
          await persistProject(booked)
        }
      }
      set({
        sceneAudioStatus: {
          ...get().sceneAudioStatus,
          [sceneId]: { generating: false, error: outcome.error.message },
        },
      })
      return false
    }
    const { blob, versionId, blobPath } = outcome.value

    const current = get().project
    if (current === null) return false
    const version: AssetVersion = {
      id: versionId,
      kind: 'audio',
      model: model.id,
      prompt: text,
      // Queue models report the authoritative charge in their envelope.
      costUsd: queuedCharge.costUsd ?? priceUsd,
      blobPath,
      mimeType: blob.type.length > 0 ? blob.type : 'audio/mpeg',
      createdAt: nowIso(),
    }
    const updated: Project = {
      ...current,
      scenes: current.scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              audioVersions: [...s.audioVersions, version],
              activeAudioVersionId: version.id,
            }
          : s,
      ),
      costLog: [
        ...current.costLog,
        {
          id: crypto.randomUUID(),
          at: nowIso(),
          kind: 'audio',
          model: model.id,
          estimatedUsd: priceUsd,
          actualUsd: queuedCharge.costUsd ?? priceUsd,
          note: 'Scene narration',
        },
      ],
      updatedAt: nowIso(),
    }
    const { [sceneId]: _doneAudio, ...restAudioStatus } = get().sceneAudioStatus
    set({ project: updated, sceneAudioStatus: restAudioStatus })
    await persistProject(updated)
    return true
  },

  previewVoice: async (model: TtsModel, voice: string) => {
    const apiKey = useSettingsStore.getState().apiKey
    if (apiKey === null) {
      return { ok: false, error: 'Set up your NanoGPT key first.' }
    }
    const repo = await getRepository()
    const path = voicePreviewPath(model.id, voice)
    const cached = await repo.blobs.get(path)
    if (cached !== null) {
      // OPFS strips the MIME type on read; re-sniff so playback works.
      // (Also heals pre-15.9.1 cache entries stored unnormalized.)
      const healed = await normalizeAudioBlob(cached)
      if (healed !== null && (await isPlayableAudio(healed))) {
        return { ok: true, blob: healed }
      }
      // Junk cached before a decoder fix — evict, then regenerate below
      // (the user pressed ▶, and the menu states the price).
      await repo.blobs.deletePrefix(path)
    }

    // Not cached — narrate the preview sentence for real (NanoGPT exposes
    // no free sample files). Tiny and synchronous, so no generation job:
    // at worst a fraction of a cent goes unreconciled if the tab dies.
    const priceUsd = ttsCostUsd(model, VOICE_PREVIEW_TEXT)
    const logSpend = async (actualUsd: number | null, note: string) => {
      const { project } = get()
      if (project === null) return
      const updated: Project = {
        ...project,
        costLog: [
          ...project.costLog,
          {
            id: crypto.randomUUID(),
            at: nowIso(),
            kind: 'audio',
            model: model.id,
            estimatedUsd: priceUsd,
            actualUsd,
            note,
          },
        ],
        updatedAt: nowIso(),
      }
      set({ project: updated })
      await persistProject(updated)
    }

    // Queue models charge AT SUBMISSION — remember it so a failed run
    // still lands in the books (15.9.3, Angel's VibeVoice report).
    const queued = { charged: false, costUsd: null as number | null }
    let raw: Blob
    try {
      raw = await getClient(apiKey).generateSpeech({
        model: model.id,
        input: VOICE_PREVIEW_TEXT,
        voice,
        onQueued: (info) => {
          queued.charged = info.charged
          queued.costUsd = info.costUsd
        },
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'The preview request failed.'
      if (queued.charged) {
        // Billed at submission, then the run failed — honest books.
        await logSpend(
          queued.costUsd ?? priceUsd,
          `Voice preview — ${voiceLabel(voice)} (run failed after being charged at submission)`,
        )
        return {
          ok: false,
          error: `${message} (NanoGPT charged this run at submission — it is in the spend log.)`,
        }
      }
      return { ok: false, error: message }
    }

    // The provider HAS billed this call — log the spend no matter what
    // the bytes turn out to hold (honest books beat pretty books).
    await logSpend(
      queued.costUsd ?? priceUsd,
      `Voice preview — ${voiceLabel(voice)}`,
    )

    const blob = await normalizeAudioBlob(raw)
    if (blob === null || !(await isPlayableAudio(blob))) {
      // Billed but unplayable — don't cache junk, and say what happened.
      return {
        ok: false,
        error: `${model.name} sent back data that is not playable audio. The spend was logged; try another voice or model.`,
      }
    }
    await repo.blobs.put(path, blob)
    return { ok: true, blob }
  },

  generateAllAudio: async (model: TtsModel, voice: string) => {
    const { project, generateSceneAudio } = get()
    if (project === null) return
    const pending = [...project.scenes]
      .sort((a, b) => a.order - b.order)
      .filter((s) => s.audioVersions.length === 0)
      .filter((s) => s.textExcerpt.trim().length > 0)
    if (pending.length === 0) return
    set({ allAudioProgress: { done: 0, total: pending.length } })
    let done = 0
    for (const scene of pending) {
      await generateSceneAudio(scene.id, model, voice)
      done += 1
      set({ allAudioProgress: { done, total: pending.length } })
    }
    set({ allAudioProgress: null })
  },

  setActiveVideoVersion: async (sceneId: string, versionId: string) => {
    const { project } = get()
    if (project === null) return
    const updated: Project = {
      ...project,
      scenes: project.scenes.map((s) =>
        s.id === sceneId && s.videoVersions.some((v) => v.id === versionId)
          ? { ...s, activeVideoVersionId: versionId }
          : s,
      ),
      updatedAt: nowIso(),
    }
    set({ project: updated })
    await persistProject(updated)
  },

  generateSceneVideo: async (
    sceneId: string,
    model: VideoModel,
    duration: string,
    resolution: string | null,
    promptOverride?: string,
  ) => {
    const { project } = get()
    const apiKey = useSettingsStore.getState().apiKey
    if (project === null || apiKey === null) return false
    const scene = project.scenes.find((s) => s.id === sceneId)
    const imageVersion = scene?.imageVersions.find(
      (v) => v.id === scene.activeImageVersionId,
    )
    if (scene === undefined || imageVersion === undefined) return false
    if (promptOverride !== undefined && promptOverride.trim().length === 0) {
      return false
    }

    setSceneVideoStatus(set, get, sceneId, { generating: true, error: null })

    const repo = await getRepository()
    const imageBlob = await repo.blobs.get(imageVersion.blobPath)
    if (imageBlob === null) {
      setSceneVideoStatus(set, get, sceneId, {
        generating: false,
        error: 'The source image could not be read from storage.',
      })
      return false
    }
    // An override (Slice 11.1) is sent verbatim — no re-derivation.
    const prompt =
      promptOverride ??
      buildVideoPrompt(scene.visualDescription, scene.cameraNotes)

    let job: GenerationJob = {
      id: crypto.randomUUID(),
      projectId: project.id,
      sceneId,
      kind: 'video',
      model: model.id,
      state: 'queued',
      remoteJobId: null,
      error: null,
      estimatedUsd: null,
      prompt,
      submittedCostUsd: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    await repo.putJob(job)

    try {
      const imageDataUrl = await blobToDataUrl(imageBlob)
      const submission = await getClient(apiKey).generateVideo({
        model: model.id,
        prompt,
        duration,
        aspectRatio: '9:16',
        ...(resolution !== null ? { resolution } : {}),
        imageDataUrl,
      })
      job = applyJobEvent(
        job,
        { type: 'submit', remoteJobId: submission.runId },
        nowIso,
      )
      job = { ...job, submittedCostUsd: submission.costUsd }
      await repo.putJob(job)
      job = applyJobEvent(job, { type: 'poll' }, nowIso)
      await repo.putJob(job)

      // The money leaves the account at submission — log it now.
      const current = get().project
      if (current !== null && current.id === job.projectId) {
        const updated: Project = {
          ...current,
          costLog: [
            ...current.costLog,
            {
              id: crypto.randomUUID(),
              at: nowIso(),
              kind: 'video',
              model: model.id,
              estimatedUsd: submission.costUsd,
              actualUsd: submission.costUsd,
              note: 'Scene animation',
            },
          ],
          updatedAt: nowIso(),
        }
        set({ project: updated })
        await persistProject(updated)
      }

      scheduleVideoPoll(job, get, set, VIDEO_POLL_INITIAL_MS)
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
      setSceneVideoStatus(set, get, sceneId, {
        generating: false,
        error:
          error instanceof Error ? error.message : 'Video submission failed.',
      })
      return false
    }
  },

  importSceneClip: async (sceneId: string, file: Blob) => {
    const { project } = get()
    if (project === null) return false
    const scene = project.scenes.find((s) => s.id === sceneId)
    if (scene === undefined) return false
    if (!file.type.startsWith('video/')) {
      set({
        sceneVideoStatus: {
          ...get().sceneVideoStatus,
          [sceneId]: {
            generating: false,
            error: 'Only video files can be imported as clips.',
          },
        },
      })
      return false
    }
    const repo = await getRepository()
    const versionId = crypto.randomUUID()
    const blobPath = `${project.id}/${versionId}`
    await repo.blobs.put(blobPath, file)
    const version: AssetVersion = {
      id: versionId,
      kind: 'video',
      model: 'imported',
      prompt: '',
      costUsd: null,
      blobPath,
      mimeType: file.type,
      createdAt: nowIso(),
    }
    const current = get().project
    if (current === null) return false
    const updated: Project = {
      ...current,
      scenes: current.scenes.map((s) =>
        s.id === sceneId
          ? {
              ...s,
              videoVersions: [...s.videoVersions, version],
              activeVideoVersionId: version.id,
            }
          : s,
      ),
      updatedAt: nowIso(),
    }
    const { [sceneId]: _cleared, ...restStatus } = get().sceneVideoStatus
    set({ project: updated, sceneVideoStatus: restStatus })
    await persistProject(updated)
    return true
  },

  generateAllVideos: async (
    model: VideoModel,
    duration: string,
    resolution: string | null,
  ) => {
    const { project, generateSceneVideo } = get()
    if (project === null) return
    const pending = [...project.scenes]
      .sort((a, b) => a.order - b.order)
      .filter(
        (s) => s.activeImageVersionId !== null && s.videoVersions.length === 0,
      )
    for (const scene of pending) {
      await generateSceneVideo(scene.id, model, duration, resolution)
    }
  },

  resumeVideoJobs: async () => {
    const { project } = get()
    if (project === null) return
    const repo = await getRepository()
    const jobs = await repo.getJobsByProject(project.id)
    for (const job of jobs) {
      if (job.kind !== 'video' || !isActiveJobState(job.state)) continue
      if (videoPollers.has(job.id)) continue
      if (job.remoteJobId === null) {
        // Interrupted before NanoGPT accepted it — nothing to resume.
        const failed = applyJobEvent(
          job,
          { type: 'fail', error: 'Interrupted before submission.' },
          nowIso,
        )
        await repo.putJob(failed)
        continue
      }
      let active = job
      if (active.state === 'submitted') {
        active = applyJobEvent(active, { type: 'poll' }, nowIso)
        await repo.putJob(active)
      }
      if (active.sceneId !== null) {
        setSceneVideoStatus(set, get, active.sceneId, {
          generating: true,
          error: null,
        })
      }
      scheduleVideoPoll(active, get, set, VIDEO_POLL_INITIAL_MS)
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

// -- Video polling machinery ------------------------------------------------

let VIDEO_POLL_MS = 10_000
let VIDEO_POLL_INITIAL_MS = 1_000
/** Consecutive poll errors tolerated before the job is marked failed. */
const VIDEO_POLL_MAX_ERRORS = 10

/** Test-only: speed up polling. */
export function __setVideoPollIntervalForTests(ms: number): void {
  VIDEO_POLL_MS = ms
  VIDEO_POLL_INITIAL_MS = ms
}

const videoPollers = new Map<string, ReturnType<typeof setTimeout>>()
const videoPollErrors = new Map<string, number>()

function stopAllVideoPollers(): void {
  for (const timer of videoPollers.values()) clearTimeout(timer)
  videoPollers.clear()
  videoPollErrors.clear()
}

type SetState = (partial: Partial<ProjectState>) => void
type GetState = () => ProjectState

function setSceneVideoStatus(
  set: SetState,
  get: GetState,
  sceneId: string,
  status: { generating: boolean; error: string | null },
): void {
  set({ sceneVideoStatus: { ...get().sceneVideoStatus, [sceneId]: status } })
}

function clearSceneVideoStatus(
  set: SetState,
  get: GetState,
  sceneId: string,
): void {
  const { [sceneId]: _gone, ...rest } = get().sceneVideoStatus
  set({ sceneVideoStatus: rest })
}

function scheduleVideoPoll(
  job: GenerationJob,
  get: GetState,
  set: SetState,
  delayMs: number,
): void {
  const timer = setTimeout(() => {
    void pollVideoJobTick(job, get, set)
  }, delayMs)
  videoPollers.set(job.id, timer)
}

async function pollVideoJobTick(
  job: GenerationJob,
  get: GetState,
  set: SetState,
): Promise<void> {
  const apiKey = useSettingsStore.getState().apiKey
  const state = get()
  // Project closed or switched: stop quietly; resumeVideoJobs picks it up
  // again next time the project is opened.
  if (
    apiKey === null ||
    state.project === null ||
    state.project.id !== job.projectId ||
    job.remoteJobId === null
  ) {
    videoPollers.delete(job.id)
    videoPollErrors.delete(job.id)
    return
  }
  const repo = await getRepository()

  try {
    const status = await getClient(apiKey).getVideoStatus(job.remoteJobId)

    if (status.status === 'COMPLETED') {
      if (status.videoUrl === null) {
        throw new Error('The job completed but no video URL was returned.')
      }
      // Through the client: NanoGPT-origin URLs need the API key; CDN
      // URLs never receive it. A TypeError here is the browser refusing a
      // cross-origin read (CORS) — the clip EXISTS, it just cannot be
      // fetched by a web page; say so instead of a generic failure.
      let blob: Blob
      try {
        blob = await getClient(apiKey).downloadVideo(status.videoUrl)
      } catch (error) {
        if (error instanceof TypeError) {
          throw new Error(
            'The clip is ready on NanoGPT, but its storage blocks browser downloads for this model. Download the file from your NanoGPT gallery, then use "Import clip" on this scene — no need to regenerate.',
          )
        }
        throw error
      }
      // A paid job must land as an actual video — never store an error page
      // or a JSON envelope as a "clip" that silently refuses to play.
      if (
        blob.size === 0 ||
        /^(text\/|application\/(json|xml))/.test(blob.type)
      ) {
        throw new Error(
          'The video URL returned something that is not a video file. Retry the generation — and if it keeps happening with this model, it likely needs a fix in Kairo.',
        )
      }
      const versionId = crypto.randomUUID()
      const blobPath = `${job.projectId}/${versionId}`
      await repo.blobs.put(blobPath, blob)

      const done = applyJobEvent(job, { type: 'succeed' }, nowIso)
      await repo.putJob(done)

      const current = get().project
      if (
        current !== null &&
        current.id === job.projectId &&
        job.sceneId !== null
      ) {
        const version: AssetVersion = {
          id: versionId,
          kind: 'video',
          model: job.model,
          prompt: job.prompt ?? '',
          costUsd: job.submittedCostUsd ?? status.costUsd,
          blobPath,
          // Keep the CDN's real video type (some models don't ship plain
          // mp4); anything non-video (e.g. octet-stream) is called mp4.
          mimeType: blob.type.startsWith('video/') ? blob.type : 'video/mp4',
          createdAt: nowIso(),
        }
        const sceneId = job.sceneId
        const updated: Project = {
          ...current,
          scenes: current.scenes.map((s) =>
            s.id === sceneId
              ? {
                  ...s,
                  videoVersions: [...s.videoVersions, version],
                  activeVideoVersionId: version.id,
                }
              : s,
          ),
          updatedAt: nowIso(),
        }
        set({ project: updated })
        clearSceneVideoStatus(set, get, sceneId)
        await persistProject(updated)
      }
      videoPollers.delete(job.id)
      videoPollErrors.delete(job.id)
      return
    }

    if (status.status === 'FAILED' || status.status === 'CANCELED') {
      const message =
        status.error ??
        (status.status === 'CANCELED'
          ? 'The video job was canceled.'
          : 'The video job failed on the provider side.')
      const failed = applyJobEvent(
        job,
        { type: 'fail', error: message },
        nowIso,
      )
      await repo.putJob(failed)
      if (job.sceneId !== null) {
        setSceneVideoStatus(set, get, job.sceneId, {
          generating: false,
          error: message,
        })
      }
      videoPollers.delete(job.id)
      videoPollErrors.delete(job.id)
      return
    }

    // Still IN_QUEUE / IN_PROGRESS: bump the job and poll again.
    videoPollErrors.delete(job.id)
    const bumped = applyJobEvent(job, { type: 'poll' }, nowIso)
    await repo.putJob(bumped)
    scheduleVideoPoll(bumped, get, set, VIDEO_POLL_MS)
  } catch (error) {
    const errors = (videoPollErrors.get(job.id) ?? 0) + 1
    videoPollErrors.set(job.id, errors)
    if (errors >= VIDEO_POLL_MAX_ERRORS) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not reach NanoGPT to check the video status.'
      const failed = applyJobEvent(
        job,
        { type: 'fail', error: message },
        nowIso,
      )
      await repo.putJob(failed)
      if (job.sceneId !== null) {
        setSceneVideoStatus(set, get, job.sceneId, {
          generating: false,
          error: message,
        })
      }
      videoPollers.delete(job.id)
      videoPollErrors.delete(job.id)
      return
    }
    // Transient (network hiccup): try again.
    scheduleVideoPoll(job, get, set, VIDEO_POLL_MS)
  }
}

/** Turn a normalized image API result (b64 or URL) into a stored Blob. */
async function imageResultToBlob(image: {
  b64Json: string | null
  url: string | null
}): Promise<Blob> {
  if (image.b64Json !== null) {
    const binary = atob(image.b64Json)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return new Blob([bytes.buffer], { type: 'image/png' })
  }
  if (image.url !== null) {
    const response = await fetch(image.url)
    if (!response.ok) {
      throw new Error('The generated image could not be downloaded.')
    }
    return response.blob()
  }
  throw new Error('The response contained no image data.')
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  const mime = blob.type.length > 0 ? blob.type : 'image/png'
  return `data:${mime};base64,${btoa(binary)}`
}
