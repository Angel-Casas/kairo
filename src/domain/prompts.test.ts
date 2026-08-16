import { describe, expect, it } from 'vitest'
import { buildImagePrompt } from './prompts'
import { getStylePreset, STYLE_PRESETS } from './stylePresets'

describe('buildImagePrompt', () => {
  it('composes preset + notes + description + framing', () => {
    const prompt = buildImagePrompt({
      stylePromptFragment: 'watercolor painting',
      styleNotes: 'warm tones',
      visualDescription: 'A castle at dawn',
    })
    expect(prompt).toBe(
      'watercolor painting. warm tones. A castle at dawn. vertical 9:16 composition',
    )
  })

  it('skips empty parts', () => {
    const prompt = buildImagePrompt({
      stylePromptFragment: null,
      styleNotes: '  ',
      visualDescription: 'A castle at dawn',
    })
    expect(prompt).toBe('A castle at dawn. vertical 9:16 composition')
  })
})

describe('style presets catalog', () => {
  it('has unique ids and complete fields', () => {
    const ids = new Set(STYLE_PRESETS.map((s) => s.id))
    expect(ids.size).toBe(STYLE_PRESETS.length)
    for (const preset of STYLE_PRESETS) {
      expect(preset.name.length).toBeGreaterThan(0)
      expect(preset.promptFragment.length).toBeGreaterThan(10)
      expect(preset.thumbnail).toBe(`/styles/${preset.id}.webp`)
    }
  })

  it('getStylePreset resolves ids and tolerates null/unknown', () => {
    expect(getStylePreset('watercolor')?.name).toBe('Watercolor')
    expect(getStylePreset(null)).toBeNull()
    expect(getStylePreset('nope')).toBeNull()
  })
})
