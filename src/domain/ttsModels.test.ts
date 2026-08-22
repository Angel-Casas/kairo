import { describe, expect, it } from 'vitest'
import type { TtsModel } from '../api/nanogpt'
import {
  ttsCostUsd,
  ttsPriceNote,
  ttsSpeedRange,
  VOICE_PREVIEW_TEXT,
  voiceLabel,
  voicePreviewPath,
} from './ttsModels'

function model(pricing: TtsModel['pricing']): TtsModel {
  return {
    id: 'tts/test',
    name: 'Test TTS',
    description: '',
    pricing,
    voices: ['af_bella'],
    maxInputChars: 10_000,
    releasedAt: null,
  }
}

describe('ttsCostUsd (Slice 15.9 — exact math for every pricing shape)', () => {
  it('per-1k-chars is exact character math', () => {
    const m = model({ kind: 'perKChars', usdPerKChars: 0.0017 })
    expect(ttsCostUsd(m, 'x'.repeat(1000))).toBeCloseTo(0.0017, 10)
    expect(ttsCostUsd(m, 'x'.repeat(500))).toBeCloseTo(0.00085, 10)
    expect(ttsCostUsd(m, '')).toBe(0)
  })

  it('char-block pricing rounds up to whole blocks and floors at the minimum', () => {
    const m = model({
      kind: 'perCharBlock',
      usdPerBlock: 0.09,
      blockChars: 300,
      minimumUsd: 0.09,
    })
    expect(ttsCostUsd(m, 'x'.repeat(300))).toBeCloseTo(0.09, 10)
    expect(ttsCostUsd(m, 'x'.repeat(301))).toBeCloseTo(0.18, 10) // 2 blocks
    expect(ttsCostUsd(m, 'x')).toBeCloseTo(0.09, 10) // minimum
  })

  it('per-generation is flat regardless of length', () => {
    const m = model({ kind: 'perGeneration', usd: 0.15 })
    expect(ttsCostUsd(m, 'x')).toBe(0.15)
    expect(ttsCostUsd(m, 'x'.repeat(9000))).toBe(0.15)
  })

  it('null pricing yields null — charged at submission', () => {
    expect(ttsCostUsd(model(null), 'hello')).toBeNull()
  })
})

describe('ttsPriceNote', () => {
  it('describes each billing shape honestly', () => {
    expect(ttsPriceNote({ kind: 'perKChars', usdPerKChars: 0.01 })).toContain(
      'billed by character',
    )
    expect(
      ttsPriceNote({
        kind: 'perCharBlock',
        usdPerBlock: 0.09,
        blockChars: 300,
        minimumUsd: 0.09,
      }),
    ).toContain('blocks of 300 characters')
    expect(ttsPriceNote({ kind: 'perGeneration', usd: 0.15 })).toContain(
      'flat price',
    )
    expect(ttsPriceNote(null)).toContain('charges at submission')
  })
})

describe('voiceLabel', () => {
  it('decodes Kokoro-style language/gender prefixes', () => {
    expect(voiceLabel('af_bella')).toBe('Bella — American female')
    expect(voiceLabel('bm_george')).toBe('George — British male')
    expect(voiceLabel('ff_siwis')).toBe('Siwis — French female')
    expect(voiceLabel('hm_omega')).toBe('Omega — Hindi male')
  })

  it('capitalizes anything else and keeps separators readable', () => {
    expect(voiceLabel('Eve')).toBe('Eve')
    expect(voiceLabel('alloy')).toBe('Alloy')
    expect(voiceLabel('deep_narrator-2')).toBe('Deep narrator 2')
  })
})

describe('ttsSpeedRange', () => {
  it('knows the speed-capable models and their provider ranges', () => {
    expect(ttsSpeedRange('Kokoro-82m')).toEqual({
      min: 0.5,
      max: 2,
      step: 0.05,
    })
    expect(ttsSpeedRange('tts-1')?.max).toBe(4)
    expect(ttsSpeedRange('Elevenlabs-Turbo-V2.5')?.max).toBe(1.2)
  })

  it('treats everything else as fixed-pace', () => {
    expect(ttsSpeedRange('gpt-4o-mini-tts')).toBeNull() // ignores speed
    expect(ttsSpeedRange('xai-tts')).toBeNull()
    expect(ttsSpeedRange('Minimax-Speech-2.8-HD')).toBeNull()
  })
})

describe('voice previews', () => {
  it('the preview sentence is short — a fraction of a cent on any model', () => {
    expect(VOICE_PREVIEW_TEXT.length).toBeLessThan(80)
  })

  it('cache paths encode slashes in model ids', () => {
    expect(voicePreviewPath('inworld/realtime-tts-2', 'Eve')).toBe(
      'voice-previews/inworld%2Frealtime-tts-2/Eve',
    )
  })
})
