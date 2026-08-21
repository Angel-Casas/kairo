import { describe, expect, it } from 'vitest'
import {
  applyTheme,
  DEFAULT_DARK_THEME_ID,
  DEFAULT_LIGHT_THEME_ID,
  getTheme,
  THEMES,
  themesForMode,
} from './themes'

describe('theme catalog (ADR-010)', () => {
  it('ships five dark and five light palettes with unique ids', () => {
    expect(themesForMode('dark')).toHaveLength(5)
    expect(themesForMode('light')).toHaveLength(5)
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(THEMES.length)
  })

  it('default theme ids exist and match their mode', () => {
    expect(getTheme(DEFAULT_DARK_THEME_ID)?.mode).toBe('dark')
    expect(getTheme(DEFAULT_LIGHT_THEME_ID)?.mode).toBe('light')
  })

  it('getTheme returns null for unknown ids', () => {
    expect(getTheme('nope')).toBeNull()
  })

  it('applyTheme writes the tokens and mode onto the document root', () => {
    const lagoon = getTheme('lagoon')
    expect(lagoon).not.toBeNull()
    if (lagoon === null) return
    applyTheme(lagoon)
    const root = document.documentElement
    expect(root.dataset.theme).toBe('lagoon')
    expect(root.dataset.mode).toBe('dark')
    expect(root.style.getPropertyValue('--color-bg')).toBe(lagoon.bg)
    expect(root.style.getPropertyValue('--bubble-cool')).toBe(lagoon.bubbleCool)

    const peony = getTheme('peony')
    if (peony === null) return
    applyTheme(peony)
    expect(root.dataset.mode).toBe('light')
    expect(root.style.getPropertyValue('--color-text')).toBe(peony.text)
  })
})
