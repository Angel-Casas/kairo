import { describe, expect, it } from 'vitest'
import {
  formatCompactUsd,
  formatReleaseMonth,
  providerOf,
  sortMenuModels,
} from './modelMenu'

describe('providerOf', () => {
  it('maps well-known id shapes to their providers', () => {
    expect(providerOf('openai/gpt-5')).toBe('OpenAI')
    expect(providerOf('azure-gpt-4o')).toBe('OpenAI')
    expect(providerOf('anthropic/claude-opus-5')).toBe('Anthropic')
    expect(providerOf('claude-sonnet-4-5-20250929')).toBe('Anthropic')
    expect(providerOf('gemini-2.5-pro')).toBe('Google')
    expect(providerOf('veo3-video')).toBe('Google')
    expect(providerOf('deepseek-chat')).toBe('DeepSeek')
    expect(providerOf('qwen/qwen3-coder')).toBe('Alibaba')
    expect(providerOf('mistralai/mistral-medium-3')).toBe('Mistral')
    expect(providerOf('x-ai/grok-4.5')).toBe('xAI')
    expect(providerOf('grok-imagine-video')).toBe('xAI')
    expect(providerOf('meta-llama/llama-4-maverick')).toBe('Meta')
    expect(providerOf('bytedance-waver-1.0')).toBe('ByteDance')
    expect(providerOf('moonshotai/kimi-k3')).toBe('Moonshot')
    expect(providerOf('zai-org/glm-5')).toBe('Z.ai')
  })

  it('maps the TTS catalog shapes (Slice 15.9)', () => {
    expect(providerOf('xai-tts', 'SpaceXAI TTS')).toBe('xAI')
    expect(providerOf('Elevenlabs-Turbo-V2.5')).toBe('ElevenLabs')
    expect(providerOf('inworld/realtime-tts-2')).toBe('Inworld')
    expect(providerOf('microsoft/mai-voice-2')).toBe('Microsoft')
    expect(providerOf('microsoft/vibevoice')).toBe('Microsoft')
    expect(providerOf('Kokoro-82m')).toBe('Kokoro')
    expect(providerOf('tts-1', 'OpenAI TTS')).toBe('OpenAI')
    expect(providerOf('gemini-2.5-flash-preview-tts')).toBe('Google')
    expect(providerOf('Minimax-Speech-2.8-HD')).toBe('MiniMax')
    expect(providerOf('bytedance/seed-speech-tts-2.0')).toBe('ByteDance')
    expect(providerOf('alibaba/qwen-audio-3-tts')).toBe('Alibaba')
  })

  it('groups everything unmatched under Other', () => {
    expect(providerOf('recraft-v3')).toBe('Recraft')
    expect(providerOf('some-unknown-model')).toBe('Other')
    expect(providerOf('fastgpt')).toBe('OpenAI') // contains "gpt", like NanoGPT's own grouping
  })
})

describe('formatCompactUsd', () => {
  it('keeps two decimals under a dollar and trims whole dollars', () => {
    expect(formatCompactUsd(0.14)).toBe('$0.14')
    expect(formatCompactUsd(0.5)).toBe('$0.50')
    expect(formatCompactUsd(2)).toBe('$2')
    expect(formatCompactUsd(15)).toBe('$15')
    expect(formatCompactUsd(2.5)).toBe('$2.5')
  })
})

describe('formatReleaseMonth', () => {
  it('renders "Mon YYYY"', () => {
    expect(formatReleaseMonth('2026-05-12T00:00:00.000Z')).toBe('May 2026')
    expect(formatReleaseMonth('not-a-date')).toBe('')
  })
})

describe('sortMenuModels', () => {
  const models = [
    {
      name: 'Bravo',
      provider: 'Zeta',
      priceSortUsd: 2,
      releasedAt: '2026-01-01T00:00:00Z',
    },
    { name: 'Alpha', provider: 'Acme', priceSortUsd: null, releasedAt: null },
    {
      name: 'Charlie',
      provider: 'Acme',
      priceSortUsd: 0.5,
      releasedAt: '2026-06-01T00:00:00Z',
    },
  ]

  it('provider sort groups alphabetically, names within', () => {
    expect(sortMenuModels(models, 'provider').map((m) => m.name)).toEqual([
      'Alpha',
      'Charlie',
      'Bravo',
    ])
  })

  it('cheapest puts unpriced models last', () => {
    expect(sortMenuModels(models, 'cheapest').map((m) => m.name)).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ])
  })

  it('newest puts undated models last', () => {
    expect(sortMenuModels(models, 'newest').map((m) => m.name)).toEqual([
      'Charlie',
      'Bravo',
      'Alpha',
    ])
  })
})
