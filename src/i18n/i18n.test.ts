import { beforeEach, describe, expect, it } from 'vitest'
import { DICTIONARIES } from './dictionaries'
import {
  applyDocumentLanguage,
  loadStoredLanguage,
  translate,
  useI18nStore,
} from './index'
import { LANGUAGES, getLanguage } from './languages'

describe('languages', () => {
  it('offers exactly ten languages with English first', () => {
    expect(LANGUAGES).toHaveLength(10)
    expect(LANGUAGES[0]?.id).toBe('en')
  })

  it('marks Arabic and Urdu as right-to-left', () => {
    expect(getLanguage('ar')?.dir).toBe('rtl')
    expect(getLanguage('ur')?.dir).toBe('rtl')
    expect(getLanguage('es')?.dir).toBe('ltr')
  })

  it('has a dictionary for every non-English language', () => {
    for (const lang of LANGUAGES) {
      if (lang.id === 'en') continue
      expect(DICTIONARIES[lang.id], lang.id).toBeDefined()
    }
  })
})

describe('translate', () => {
  it('returns the English key itself for English', () => {
    expect(translate('en', 'Create project')).toBe('Create project')
  })

  it('translates a known key', () => {
    expect(translate('es', 'Create project')).toBe('Crear proyecto')
  })

  it('falls back to the English key when no entry exists', () => {
    expect(translate('es', 'Some brand-new untranslated string')).toBe(
      'Some brand-new untranslated string',
    )
  })

  it('interpolates {slots} after lookup', () => {
    expect(translate('en', 'Scene {n} of {total}', { n: 2, total: 5 })).toBe(
      'Scene 2 of 5',
    )
    expect(translate('es', 'Scene {n}', { n: 3 })).toBe('Escena 3')
  })

  it('leaves unknown slots untouched instead of crashing', () => {
    expect(translate('en', 'Scene {n}', {})).toBe('Scene {n}')
  })

  it('never invents placeholders the English key does not have', () => {
    // A translation may deliberately drop a slot when its language
    // restructures the sentence (Chinese has no has/have {verb} split),
    // but a slot that does not exist in the key would render literally
    // as "{foo}" — that is always a bug.
    const slotsOf = (text: string) =>
      new Set([...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]))
    for (const [langId, dict] of Object.entries(DICTIONARIES)) {
      for (const [key, value] of Object.entries(dict)) {
        const allowed = slotsOf(key)
        for (const slot of slotsOf(value)) {
          expect(allowed.has(slot), `${langId}: ${key} → {${slot}}`).toBe(true)
        }
      }
    }
  })
})

describe('persistence', () => {
  beforeEach(() => {
    localStorage.clear()
    useI18nStore.setState({ lang: 'en' })
  })

  it('defaults to English with nothing stored', () => {
    expect(loadStoredLanguage()).toBe('en')
  })

  it('persists the chosen language to localStorage', () => {
    useI18nStore.getState().setLang('fr')
    expect(localStorage.getItem('kairo.lang')).toBe('fr')
    expect(loadStoredLanguage()).toBe('fr')
  })

  it('ignores an unknown stored value', () => {
    localStorage.setItem('kairo.lang', 'klingon')
    expect(loadStoredLanguage()).toBe('en')
  })
})

describe('applyDocumentLanguage', () => {
  it('sets lang and dir on the document root', () => {
    applyDocumentLanguage('ar')
    expect(document.documentElement.lang).toBe('ar')
    expect(document.documentElement.dir).toBe('rtl')
    applyDocumentLanguage('en')
    expect(document.documentElement.lang).toBe('en')
    expect(document.documentElement.dir).toBe('ltr')
  })
})
