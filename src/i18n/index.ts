import { useCallback } from 'react'
import { create } from 'zustand'
import { DICTIONARIES } from './dictionaries'
import { getLanguage, type LanguageId } from './languages'

/**
 * Kairo speaks ten languages (Slice 22.21, Angel's call). The design is
 * deliberately tiny: English source text is its own key, so `t('Create
 * project')` looks the sentence up in the active language's dictionary
 * and falls back to the English it was handed when no entry exists.
 * Untranslated strings therefore cost nothing — they simply stay
 * English — and the app never crashes over a missing key.
 *
 * Model-facing prompts (src/domain/prompts.ts) are NOT translated on
 * purpose: they are instructions to the generation models, not UI.
 *
 * The choice persists like the theme does (localStorage), and RTL
 * languages (Arabic, Urdu) flip `document.dir`.
 */

const STORAGE_KEY = 'kairo.lang'

export function loadStoredLanguage(): LanguageId {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw !== null && getLanguage(raw) !== null) return raw as LanguageId
  } catch {
    // Storage unavailable — English, like every first visit.
  }
  return 'en'
}

interface I18nState {
  lang: LanguageId
  setLang: (lang: LanguageId) => void
}

export const useI18nStore = create<I18nState>((set) => ({
  lang: loadStoredLanguage(),
  setLang: (lang) => {
    set({ lang })
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Private mode etc. — the choice still holds for this session.
    }
  },
}))

export type TranslateParams = Record<string, string | number>

/** The shape `useT()` returns — for helpers that take `t` as an argument. */
export type Translator = (text: string, params?: TranslateParams) => string

/** Fill `{name}` slots AFTER lookup, so dictionaries keep the slots. */
function interpolate(text: string, params?: TranslateParams): string {
  if (params === undefined) return text
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const value = params[key]
    return value === undefined ? whole : String(value)
  })
}

/** Pure lookup — English text in, translated text out (or the input). */
export function translate(
  lang: LanguageId,
  text: string,
  params?: TranslateParams,
): string {
  const entry = lang === 'en' ? undefined : DICTIONARIES[lang]?.[text]
  return interpolate(entry ?? text, params)
}

/**
 * The component-side translator. Subscribes to the store, so switching
 * language re-renders every caller. Drop-in around any English literal:
 * `t('Your productions')`, `t('Delete "{title}"?', { title })`.
 */
export function useT() {
  const lang = useI18nStore((s) => s.lang)
  return useCallback(
    (text: string, params?: TranslateParams) => translate(lang, text, params),
    [lang],
  )
}

/**
 * The active language's reading direction — for the few components that
 * position things physically (absolute offsets, hardcoded gradients) and
 * must mirror themselves by hand when the page flips to RTL (22.21.1).
 */
export function useLanguageDir(): 'ltr' | 'rtl' {
  const lang = useI18nStore((s) => s.lang)
  return getLanguage(lang)?.dir ?? 'ltr'
}

/** Mirror the choice onto the document: lang for a11y, dir for RTL. */
export function applyDocumentLanguage(lang: LanguageId): void {
  const language = getLanguage(lang)
  if (language === null) return
  document.documentElement.lang = language.id
  document.documentElement.dir = language.dir
}
