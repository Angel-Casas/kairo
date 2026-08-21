import { create } from 'zustand'
import { InvalidApiKeyError, NanoGptClient } from '../api/nanogpt'
import {
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  getTheme,
  type ThemeMode,
} from '../domain/themes'

/**
 * API key + balance state, plus the UI theme choice (ADR-010). The key
 * lives in localStorage only — it never leaves the device except as the
 * auth header on NanoGPT requests.
 */

const STORAGE_KEY = 'kairo.nanogpt.apiKey'
const MODE_STORAGE_KEY = 'kairo.ui.mode'
const DARK_THEME_STORAGE_KEY = 'kairo.ui.theme.dark'
const LIGHT_THEME_STORAGE_KEY = 'kairo.ui.theme.light'

function readStoredKey(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Storage unavailable (private mode); the choice lives in memory only.
  }
}

function initialMode(): ThemeMode {
  const stored = readStored(MODE_STORAGE_KEY)
  if (stored === 'dark' || stored === 'light') return stored
  try {
    return window.matchMedia('(prefers-color-scheme: light)').matches
      ? 'light'
      : 'dark'
  } catch {
    return 'dark'
  }
}

function initialThemeId(mode: ThemeMode): string {
  const key = mode === 'dark' ? DARK_THEME_STORAGE_KEY : LIGHT_THEME_STORAGE_KEY
  const fallback =
    mode === 'dark' ? DEFAULT_DARK_THEME_ID : DEFAULT_LIGHT_THEME_ID
  const stored = readStored(key)
  return stored !== null && getTheme(stored)?.mode === mode ? stored : fallback
}

export type KeyStatus = 'none' | 'validating' | 'valid' | 'error'

interface SettingsState {
  apiKey: string | null
  keyStatus: KeyStatus
  keyError: string | null
  balanceUsd: number | null
  /** UI theme (ADR-010): light/dark mode + a palette per mode. */
  themeMode: ThemeMode
  darkThemeId: string
  lightThemeId: string
  setThemeMode: (mode: ThemeMode) => void
  /** Select a palette; it becomes the choice for that palette's mode. */
  selectTheme: (themeId: string) => void
  /**
   * Pick a palette from the all-palettes dropdown: stores it for its mode
   * AND switches to that mode — one choice, no separate light/dark toggle.
   */
  chooseTheme: (themeId: string) => void
  /** Validate a pasted key against NanoGPT; store it only if valid. */
  saveKey: (key: string) => Promise<boolean>
  removeKey: () => void
  refreshBalance: () => Promise<void>
  /** Re-validate the stored key on app start (refreshes the balance). */
  initSettings: () => Promise<void>
}

/** The currently active theme id, derived from mode + per-mode choice. */
export function activeThemeId(state: {
  themeMode: ThemeMode
  darkThemeId: string
  lightThemeId: string
}): string {
  return state.themeMode === 'dark' ? state.darkThemeId : state.lightThemeId
}

export function getClient(apiKey: string): NanoGptClient {
  return new NanoGptClient(apiKey)
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  apiKey: readStoredKey(),
  keyStatus: readStoredKey() !== null ? 'valid' : 'none',
  keyError: null,
  balanceUsd: null,
  themeMode: initialMode(),
  darkThemeId: initialThemeId('dark'),
  lightThemeId: initialThemeId('light'),

  setThemeMode: (mode: ThemeMode) => {
    writeStored(MODE_STORAGE_KEY, mode)
    set({ themeMode: mode })
  },

  selectTheme: (themeId: string) => {
    const theme = getTheme(themeId)
    if (theme === null) return
    if (theme.mode === 'dark') {
      writeStored(DARK_THEME_STORAGE_KEY, themeId)
      set({ darkThemeId: themeId })
    } else {
      writeStored(LIGHT_THEME_STORAGE_KEY, themeId)
      set({ lightThemeId: themeId })
    }
  },

  chooseTheme: (themeId: string) => {
    const theme = getTheme(themeId)
    if (theme === null) return
    get().selectTheme(themeId)
    get().setThemeMode(theme.mode)
  },

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
