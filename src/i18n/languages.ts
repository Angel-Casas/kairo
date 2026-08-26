/**
 * The ten most-spoken languages in the world (Slice 22.21, Angel's call),
 * by total speakers (Ethnologue): English, Mandarin Chinese, Hindi,
 * Spanish, French, Modern Standard Arabic, Bengali, Portuguese, Russian,
 * and Urdu. English is the source language — every string in the app IS
 * its own English key — so it needs no dictionary. Arabic and Urdu read
 * right to left; the store mirrors that into `document.dir`.
 */

export type LanguageId =
  'en' | 'zh' | 'hi' | 'es' | 'fr' | 'ar' | 'bn' | 'pt' | 'ru' | 'ur'

export interface Language {
  id: LanguageId
  /** The language's own name for itself — shown in the menu. */
  native: string
  /** The English name, as a quiet second line for recognition. */
  english: string
  dir: 'ltr' | 'rtl'
}

export const LANGUAGES: Language[] = [
  { id: 'en', native: 'English', english: 'English', dir: 'ltr' },
  { id: 'zh', native: '中文', english: 'Chinese', dir: 'ltr' },
  { id: 'hi', native: 'हिन्दी', english: 'Hindi', dir: 'ltr' },
  { id: 'es', native: 'Español', english: 'Spanish', dir: 'ltr' },
  { id: 'fr', native: 'Français', english: 'French', dir: 'ltr' },
  { id: 'ar', native: 'العربية', english: 'Arabic', dir: 'rtl' },
  { id: 'bn', native: 'বাংলা', english: 'Bengali', dir: 'ltr' },
  { id: 'pt', native: 'Português', english: 'Portuguese', dir: 'ltr' },
  { id: 'ru', native: 'Русский', english: 'Russian', dir: 'ltr' },
  { id: 'ur', native: 'اردو', english: 'Urdu', dir: 'rtl' },
]

export function getLanguage(id: string): Language | null {
  return LANGUAGES.find((l) => l.id === id) ?? null
}
