import { create } from 'zustand'
import type { ImageModel, TextModel, VideoModel } from '../api/nanogpt'
import { getClient } from './settings'
import { useSettingsStore } from './settings'

/**
 * Cached model catalogs. Loaded once per session on demand; a manual reload
 * is available from the UI if NanoGPT's catalog changes mid-session.
 */

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ModelsState {
  textModels: TextModel[]
  textModelsStatus: CatalogStatus
  loadTextModels: (force?: boolean) => Promise<void>
  imageModels: ImageModel[]
  imageModelsStatus: CatalogStatus
  loadImageModels: (force?: boolean) => Promise<void>
  videoModels: VideoModel[]
  videoModelsStatus: CatalogStatus
  loadVideoModels: (force?: boolean) => Promise<void>
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  textModels: [],
  textModelsStatus: 'idle',
  imageModels: [],
  imageModelsStatus: 'idle',
  videoModels: [],
  videoModelsStatus: 'idle',

  loadTextModels: async (force = false) => {
    const { textModelsStatus } = get()
    if (
      !force &&
      (textModelsStatus === 'ready' || textModelsStatus === 'loading')
    ) {
      return
    }
    const apiKey = useSettingsStore.getState().apiKey
    if (apiKey === null) return
    set({ textModelsStatus: 'loading' })
    try {
      const models = await getClient(apiKey).listTextModels()
      set({ textModels: models, textModelsStatus: 'ready' })
    } catch {
      set({ textModelsStatus: 'error' })
    }
  },

  loadImageModels: async (force = false) => {
    const { imageModelsStatus } = get()
    if (
      !force &&
      (imageModelsStatus === 'ready' || imageModelsStatus === 'loading')
    ) {
      return
    }
    const apiKey = useSettingsStore.getState().apiKey
    if (apiKey === null) return
    set({ imageModelsStatus: 'loading' })
    try {
      const models = await getClient(apiKey).listImageModels()
      set({ imageModels: models, imageModelsStatus: 'ready' })
    } catch {
      set({ imageModelsStatus: 'error' })
    }
  },

  loadVideoModels: async (force = false) => {
    const { videoModelsStatus } = get()
    if (
      !force &&
      (videoModelsStatus === 'ready' || videoModelsStatus === 'loading')
    ) {
      return
    }
    const apiKey = useSettingsStore.getState().apiKey
    if (apiKey === null) return
    set({ videoModelsStatus: 'loading' })
    try {
      const models = await getClient(apiKey).listVideoModels()
      set({ videoModels: models, videoModelsStatus: 'ready' })
    } catch {
      set({ videoModelsStatus: 'error' })
    }
  },
}))
