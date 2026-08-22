import type { TtsModel, TtsPricing } from '../api/nanogpt'

/**
 * TTS helpers (Slice 15.9). The catalog itself now comes live from
 * NanoGPT's /v1/audio-models listing (it was a hand-curated table before —
 * five models; the live listing carries the full set). What stays local:
 * exact cost math, human-readable voice labels, and the fixed preview
 * sentence every voice preview narrates.
 */

/**
 * Exact narration price for a text under a model's pricing — TTS is the
 * one generation kind with no estimates anywhere. Null when the listing
 * carried no recognizable price (the API then charges at submission).
 */
export function ttsCostUsd(model: TtsModel, text: string): number | null {
  const pricing = model.pricing
  if (pricing === null) return null
  switch (pricing.kind) {
    case 'perKChars':
      return (text.length / 1000) * pricing.usdPerKChars
    case 'perCharBlock':
      return Math.max(
        pricing.minimumUsd,
        Math.ceil(text.length / pricing.blockChars) * pricing.usdPerBlock,
      )
    case 'perGeneration':
      return pricing.usd
  }
}

/** One-line billing explanation for the workbench copy. */
export function ttsPriceNote(pricing: TtsPricing | null): string {
  if (pricing === null) {
    return 'This model lists no price — NanoGPT charges at submission.'
  }
  switch (pricing.kind) {
    case 'perKChars':
      return 'TTS is billed by character, so the price shown is exact — not an estimate.'
    case 'perCharBlock':
      return `Billed in blocks of ${String(pricing.blockChars)} characters — the price shown is exact.`
    case 'perGeneration':
      return 'Billed at a flat price per narration — exact, regardless of length.'
  }
}

/**
 * Kokoro-style voice ids encode language and gender in a two-letter
 * prefix ("af_bella" — American female). Decode the known prefixes;
 * anything else just gets capitalized with separators turned to spaces.
 */
const VOICE_LANGS: Record<string, string> = {
  a: 'American',
  b: 'British',
  e: 'Spanish',
  f: 'French',
  h: 'Hindi',
  i: 'Italian',
  j: 'Japanese',
  p: 'Portuguese',
  z: 'Mandarin',
}

export function voiceLabel(voiceId: string): string {
  const match = /^([abefhijpz])([fm])_(.+)$/.exec(voiceId)
  if (match !== null) {
    const [, lang = '', gender = '', name = ''] = match
    const language = VOICE_LANGS[lang]
    if (language !== undefined) {
      return `${capitalize(name)} — ${language} ${gender === 'f' ? 'female' : 'male'}`
    }
  }
  return capitalize(voiceId.replace(/[_-]+/g, ' '))
}

function capitalize(s: string): string {
  return (s[0] ?? '').toUpperCase() + s.slice(1)
}

/**
 * The sentence every voice preview narrates (Slice 15.9). Deliberately
 * short: previews go through the real TTS endpoint (NanoGPT exposes no
 * free sample files), so each first listen costs a fraction of a cent —
 * shown exactly in the voice menu — and is then cached in OPFS forever.
 */
export const VOICE_PREVIEW_TEXT =
  'Hello! This is how your narration will sound.'

/** OPFS cache path for a voice preview (model ids may contain slashes). */
export function voicePreviewPath(modelId: string, voiceId: string): string {
  return `voice-previews/${encodeURIComponent(modelId)}/${encodeURIComponent(voiceId)}`
}

/**
 * Speaking-rate support (Slice 15.10). The /v1/audio-models listing carries
 * NO speed field, so — like NanoGPT's own UI (slider for some models,
 * "Speed fixed by model" for the rest) — this is a curated table, with
 * ranges from each provider's spec (docs-verified 2026-08-22: Kokoro,
 * ElevenLabs Turbo and tts-1/hd accept `speed`; gpt-4o-mini-tts ignores
 * it; unsupported models ignore the parameter server-side).
 */
export interface TtsSpeedRange {
  min: number
  max: number
  step: number
}

const SPEED_CAPABLE: Record<string, TtsSpeedRange> = {
  'Kokoro-82m': { min: 0.5, max: 2, step: 0.05 },
  'tts-1': { min: 0.25, max: 4, step: 0.05 },
  'tts-1-hd': { min: 0.25, max: 4, step: 0.05 },
  'Elevenlabs-Turbo-V2.5': { min: 0.7, max: 1.2, step: 0.05 },
}

/** The model's speed range, or null when its pace is fixed. */
export function ttsSpeedRange(modelId: string): TtsSpeedRange | null {
  return SPEED_CAPABLE[modelId] ?? null
}
