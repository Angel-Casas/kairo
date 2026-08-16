import { create } from 'zustand'
import { InvalidApiKeyError, NanoGptClient } from '../api/nanogpt'

/**
 * API key + balance state. The key lives in localStorage only — it never
 * leaves the device except as the auth header on NanoGPT requests.
 */

const STORAGE_KEY = 'kairo.nanogpt.apiKey'

function readStoredKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export type KeyStatus = 'none' | 'validating' | 'valid' | 'error'

interface SettingsState {
  apiKey: string | null
  keyStatus: KeyStatus
  keyError: string | null
  balanceUsd: number | null
  /** Validate a pasted key against NanoGPT; store it only if valid. */
  saveKey: (key: string) => Promise<boolean>
  removeKey: () => void
  refreshBalance: () => Promise<void>
  /** Re-validate the stored key on app start (refreshes the balance). */
  initSettings: () => Promise<void>
}

export function getClient(apiKey: string): NanoGptClient {
  return new NanoGptClient(apiKey)
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiKey: readStoredKey(),
  keyStatus: readStoredKey() !== null ? 'valid' : 'none',
  keyError: null,
  balanceUsd: null,

  saveKey: async (key: string) => {
    const trimmed = key.trim()
    if (trimmed.length === 0) return false
    set({ keyStatus: 'validating', keyError: null })
    try {
      const { usdBalance } = await getClient(trimmed).checkBalance()
      try {
        localStorage.setItem(STORAGE_KEY, trimmed)
      } catch {
        // Storage unavailable (private mode); keep the key in memory only.
      }
      set({
        apiKey: trimmed,
        keyStatus: 'valid',
        keyError: null,
        balanceUsd: usdBalance,
      })
      return true
    } catch (error) {
      set({
        keyStatus: get().apiKey !== null ? 'valid' : 'error',
        keyError:
          error instanceof InvalidApiKeyError
            ? 'NanoGPT rejected this key. Check it and try again.'
            : 'Could not validate the key. Check your connection and try again.',
      })
      return false
    }
  },

  removeKey: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // Ignore storage errors on removal.
    }
    set({ apiKey: null, keyStatus: 'none', keyError: null, balanceUsd: null })
  },

  refreshBalance: async () => {
    const { apiKey } = get()
    if (apiKey === null) return
    try {
      const { usdBalance } = await getClient(apiKey).checkBalance()
      set({ balanceUsd: usdBalance, keyStatus: 'valid', keyError: null })
    } catch (error) {
      if (error instanceof InvalidApiKeyError) {
        set({
          keyStatus: 'error',
          keyError: 'The stored key is no longer valid.',
          balanceUsd: null,
        })
      }
      // Network errors: keep the last known balance.
    }
  },

  initSettings: async () => {
    await get().refreshBalance()
  },
}))
