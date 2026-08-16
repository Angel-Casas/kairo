import { create } from 'zustand'
import type { TextModel } from '../api/nanogpt'
import { getClient } from './settings'
import { useSettingsStore } from './settings'

/**
 * Cached model catalog. Loaded once per session on demand; a manual reload
 * is available from the UI if NanoGPT's catalog changes mid-session.
 */

type CatalogStatus = 'idle' | 'loading' | 'ready' | 'error'

interface ModelsState {
  textModels: TextModel[]
  textModelsStatus: CatalogStatus
  loadTextModels: (force?: boolean) => Promise<void>
}

export const useModelsStore = create<ModelsState>((set, get) => ({
  textModels: [],
  textModelsStatus: 'idle',

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
}))
