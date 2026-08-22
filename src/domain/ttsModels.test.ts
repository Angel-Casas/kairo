import { describe, expect, it } from 'vitest'
import { getTtsModel, TTS_MODELS, ttsCostUsd } from './ttsModels'

describe('TTS catalog (Slice 15)', () => {
  it('every model has a price, a char limit, and at least one voice', () => {
    expect(TTS_MODELS.length).toBeGreaterThan(0)
    for (const model of TTS_MODELS) {
      expect(model.pricePerKChars).toBeGreaterThan(0)
      expect(model.maxInputChars).toBeGreaterThan(0)
      expect(model.voices.length).toBeGreaterThan(0)
    }
    expect(new Set(TTS_MODELS.map((m) => m.id)).size).toBe(TTS_MODELS.length)
  })

  it('getTtsModel finds by id and returns null for unknown ids', () => {
    expect(getTtsModel('Kokoro-82m')?.name).toContain('Kokoro')
    expect(getTtsModel('nope')).toBeNull()
  })

  it('ttsCostUsd is exact character math — no estimation', () => {
    const kokoro = getTtsModel('Kokoro-82m')
    expect(kokoro).not.toBeNull()
    if (kokoro === null) return
    // 1,000 characters at $0.001/1k = exactly $0.001.
    expect(ttsCostUsd(kokoro, 'x'.repeat(1000))).toBeCloseTo(0.001, 10)
    expect(ttsCostUsd(kokoro, 'x'.repeat(500))).toBeCloseTo(0.0005, 10)
    expect(ttsCostUsd(kokoro, '')).toBe(0)
  })
})
