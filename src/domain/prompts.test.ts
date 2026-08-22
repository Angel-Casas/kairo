import { describe, expect, it } from 'vitest'
import {
  buildImagePrompt,
  buildVideoPrompt,
  sceneBreakdownSystemPrompt,
} from './prompts'
import { getStylePreset, STYLE_PRESETS } from './stylePresets'

describe('buildImagePrompt', () => {
  it('composes preset + notes + description + framing + no-text rule', () => {
    const prompt = buildImagePrompt({
      stylePromptFragment: 'watercolor painting',
      styleNotes: 'warm tones',
      visualDescription: 'A castle at dawn',
    })
    expect(prompt).toBe(
      'watercolor painting. warm tones. A castle at dawn. vertical 9:16 composition. no readable text, signs, or lettering in the image',
    )
  })

  it('skips empty parts', () => {
    const prompt = buildImagePrompt({
      stylePromptFragment: null,
      styleNotes: '  ',
      visualDescription: 'A castle at dawn',
    })
    expect(prompt).toBe(
      'A castle at dawn. vertical 9:16 composition. no readable text, signs, or lettering in the image',
    )
  })

  it('injects reference descriptors verbatim between notes and description', () => {
    const prompt = buildImagePrompt({
      stylePromptFragment: 'watercolor painting',
      styleNotes: 'warm tones',
      referenceDescriptors: [
        'a tall woman with cropped silver hair and a navy coat',
        'a cliffside lighthouse with a red lantern room',
      ],
      visualDescription: 'She walks toward the lighthouse',
    })
    expect(prompt).toBe(
      'watercolor painting. warm tones. ' +
        'a tall woman with cropped silver hair and a navy coat. ' +
        'a cliffside lighthouse with a red lantern room. ' +
        'She walks toward the lighthouse. vertical 9:16 composition. ' +
        'no readable text, signs, or lettering in the image',
    )
  })

  it('skips empty reference descriptors', () => {
    const prompt = buildImagePrompt({
      stylePromptFragment: null,
      styleNotes: '',
      referenceDescriptors: ['', '  '],
      visualDescription: 'A castle at dawn',
    })
    expect(prompt).toBe(
      'A castle at dawn. vertical 9:16 composition. no readable text, signs, or lettering in the image',
    )
  })
})

describe('unterminated (15.13 — no more double periods)', () => {
  it('strips a single trailing period; the joiner adds its own', () => {
    expect(
      buildVideoPrompt('A vast estate looms in the distance.', 'No pan.'),
    ).toContain('in the distance. one continuous')
    expect(
      buildVideoPrompt('A vast estate looms in the distance.', 'No pan.'),
    ).toContain('Camera: No pan. no frozen figures')
  })

  it('preserves deliberate ellipses', () => {
    expect(buildVideoPrompt('The fog thickens...')).toContain(
      'The fog thickens.... one continuous',
    )
    expect(buildVideoPrompt('The fog thickens…')).toContain(
      'The fog thickens…. one continuous',
    )
  })

  it('applies to image prompt fragments too', () => {
    const prompt = buildImagePrompt({
      stylePromptFragment: 'Oil painting.',
      styleNotes: 'Warm palette.',
      visualDescription: 'A lighthouse.',
    })
    expect(prompt).not.toContain('..')
  })
})

describe('buildVideoPrompt', () => {
  it('pairs the camera with an action and forbids frozen figures and text', () => {
    const prompt = buildVideoPrompt('A castle at dawn')
    expect(prompt).toContain('A castle at dawn')
    expect(prompt).toContain('one continuous natural action')
    expect(prompt).toContain('camera drifts gently with that action')
    expect(prompt).toContain('no frozen figures')
    expect(prompt).toContain('no readable text')
    expect(prompt).toContain('keep the original style')
  })

  it("the user's camera direction replaces the gentle-drift default", () => {
    const prompt = buildVideoPrompt(
      'A castle at dawn',
      'fixed tripod, slow zoom in',
    )
    expect(prompt).toContain('Camera: fixed tripod, slow zoom in')
    expect(prompt).not.toContain('camera drifts gently')
    expect(prompt).toContain('one continuous natural action')
    expect(prompt).toContain('no frozen figures')
  })

  it('blank camera notes keep the default drift', () => {
    expect(buildVideoPrompt('A castle at dawn', '   ')).toContain(
      'camera drifts gently with that action',
    )
  })
})

describe('sceneBreakdownSystemPrompt craft rules', () => {
  it('enforces one action per scene and bans in-frame text', () => {
    const prompt = sceneBreakdownSystemPrompt()
    expect(prompt).toContain('exactly ONE action')
    expect(prompt).toContain('never a sequence')
    expect(prompt).toContain('render text badly')
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
