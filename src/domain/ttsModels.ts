/**
 * Curated TTS catalog (Slice 15). NanoGPT's speech endpoint has no listing
 * API (docs-verified 2026-08-22), so the models and their per-character
 * prices live here. TTS is billed purely by INPUT CHARACTERS, which means —
 * unlike every other generation kind — the price shown is exact, not an
 * estimate.
 */

export interface TtsVoice {
  id: string
  label: string
}

export interface TtsModel {
  id: string
  name: string
  /** USD per 1,000 input characters (from the NanoGPT docs). */
  pricePerKChars: number
  /** The endpoint rejects longer inputs. */
  maxInputChars: number
  voices: TtsVoice[]
}

export const TTS_MODELS: TtsModel[] = [
  {
    id: 'Kokoro-82m',
    name: 'Kokoro (cheap, natural)',
    pricePerKChars: 0.001,
    maxInputChars: 10_000,
    voices: [
      { id: 'af_bella', label: 'Bella — American female' },
      { id: 'af_nicole', label: 'Nicole — American female' },
      { id: 'af_sarah', label: 'Sarah — American female' },
      { id: 'am_adam', label: 'Adam — American male' },
      { id: 'am_michael', label: 'Michael — American male' },
      { id: 'bf_emma', label: 'Emma — British female' },
      { id: 'bm_george', label: 'George — British male' },
    ],
  },
  {
    id: 'gpt-4o-mini-tts',
    name: 'OpenAI Mini (cheapest)',
    pricePerKChars: 0.0006,
    maxInputChars: 4_096,
    voices: [
      { id: 'alloy', label: 'Alloy' },
      { id: 'ash', label: 'Ash' },
      { id: 'coral', label: 'Coral' },
      { id: 'echo', label: 'Echo' },
      { id: 'fable', label: 'Fable' },
      { id: 'nova', label: 'Nova' },
      { id: 'onyx', label: 'Onyx' },
      { id: 'sage', label: 'Sage' },
      { id: 'shimmer', label: 'Shimmer' },
    ],
  },
  {
    id: 'tts-1',
    name: 'OpenAI Standard',
    pricePerKChars: 0.015,
    maxInputChars: 4_096,
    voices: [
      { id: 'alloy', label: 'Alloy' },
      { id: 'echo', label: 'Echo' },
      { id: 'fable', label: 'Fable' },
      { id: 'nova', label: 'Nova' },
      { id: 'onyx', label: 'Onyx' },
      { id: 'shimmer', label: 'Shimmer' },
    ],
  },
  {
    id: 'tts-1-hd',
    name: 'OpenAI HD',
    pricePerKChars: 0.03,
    maxInputChars: 4_096,
    voices: [
      { id: 'alloy', label: 'Alloy' },
      { id: 'echo', label: 'Echo' },
      { id: 'fable', label: 'Fable' },
      { id: 'nova', label: 'Nova' },
      { id: 'onyx', label: 'Onyx' },
      { id: 'shimmer', label: 'Shimmer' },
    ],
  },
  {
    id: 'Elevenlabs-Turbo-V2.5',
    name: 'ElevenLabs Turbo (premium)',
    pricePerKChars: 0.06,
    maxInputChars: 10_000,
    voices: [
      { id: 'Rachel', label: 'Rachel' },
      { id: 'Adam', label: 'Adam' },
      { id: 'Alice', label: 'Alice' },
      { id: 'Daniel', label: 'Daniel' },
      { id: 'Matthew', label: 'Matthew' },
      { id: 'Sarah', label: 'Sarah' },
    ],
  },
]

export function getTtsModel(id: string): TtsModel | null {
  return TTS_MODELS.find((m) => m.id === id) ?? null
}

/** Exact narration price for a text — chars-based, no estimation involved. */
export function ttsCostUsd(model: TtsModel, text: string): number {
  return (text.length / 1000) * model.pricePerKChars
}
