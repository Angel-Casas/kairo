import { NANOGPT_BASE_URL } from '../config'
import {
  achievableFrameDurations,
  type FrameControl,
} from '../lib/clipDuration'

/**
 * Typed client for the NanoGPT API (https://docs.nano-gpt.com).
 *
 * Endpoint shapes verified against the docs on 2026-08-16. If a call fails
 * unexpectedly, re-check the docs before changing this file — do not guess.
 *
 * SECURITY: the API key is sent only as the `x-api-key` header to the
 * configured base URL. It must never be logged, thrown, or embedded in
 * error messages (CLAUDE.md: "the key is sacred").
 */

// -- Response types --------------------------------------------------------

export interface Balance {
  usdBalance: number
}

export interface TextModel {
  id: string
  name: string
  description: string
  /** USD per million input tokens, when provided. */
  promptPricePerMTok: number | null
  /** USD per million output tokens, when provided. */
  completionPricePerMTok: number | null
  /** Whether the model accepts image inputs (capabilities.vision). */
  supportsVision: boolean
  /**
   * Release date (ISO) from the listing's `created` timestamp, when the
   * API provides one; null otherwise. Powers newest/oldest sorting and the
   * date chip in the model menu.
   */
  releasedAt: string | null
}

/**
 * How a TTS model bills (Slice 15.9, shapes observed live in the
 * /v1/audio-models listing): almost all bill per 1k input characters; a
 * couple bill per fixed-size character block (ByteDance Seed Audio) or a
 * flat price per generation (VibeVoice). All three are EXACT prices —
 * knowable before submitting, unlike image/video estimates.
 */
export type TtsPricing =
  | { kind: 'perKChars'; usdPerKChars: number }
  | {
      kind: 'perCharBlock'
      usdPerBlock: number
      blockChars: number
      minimumUsd: number
    }
  | { kind: 'perGeneration'; usd: number }

export interface TtsModel {
  id: string
  name: string
  description: string
  /** null when the listing carries no recognizable price. */
  pricing: TtsPricing | null
  /** Voice preset ids as the API expects them (e.g. "af_bella", "Eve"). */
  voices: string[]
  /** The endpoint rejects longer inputs; null when the listing has no cap. */
  maxInputChars: number | null
  /**
   * Release date (ISO) from the listing's `created` timestamp, when the
   * API provides one; null otherwise. Powers newest/oldest sorting and the
   * date chip in the model menu.
   */
  releasedAt: string | null
}

export interface ImageModel {
  id: string
  name: string
  description: string
  /** Map of resolution (e.g. "1024x1024") to USD per image, when provided. */
  perImageUsd: Record<string, number>
  resolutions: string[]
  supportsImageToImage: boolean
  /**
   * Release date (ISO) from the listing's `created` timestamp, when the
   * API provides one; null otherwise. Powers newest/oldest sorting and the
   * date chip in the model menu.
   */
  releasedAt: string | null
}

export interface VideoModel {
  id: string
  name: string
  description: string
  supportsTextToVideo: boolean
  supportsImageToVideo: boolean
  /**
   * Price range extracted from the model's pricing object. Video pricing
   * shapes vary by model (per-video, per-second, per-resolution tiers), so
   * we surface min–max of every numeric price found; null when none exist.
   * The authoritative amount is still what the API charges at submission.
   */
  priceRangeUsd: { min: number; max: number } | null
  /** Resolutions the model advertises (e.g. "480p", "720p", "1080p"). */
  resolutions: string[]
  /**
   * Clip durations the model advertises, in seconds (e.g. "5", "10").
   * Most models do not list them — an empty array means "unknown", and a
   * model may silently produce the nearest length it supports. For
   * frame-based models (frameControl set) these are the ACHIEVABLE
   * second-targets, so all seconds-based UI works unchanged.
   */
  durations: string[]
  /**
   * Set when the model takes num_frames + frames_per_second instead of a
   * duration (Wan 2.1, Wan 2.2 5b — observed live 2026-08-22). Kairo
   * translates seconds into a frame plan at submission.
   */
  frameControl: FrameControl | null
  /**
   * Set when the model can lip/body-sync a provided audio track to an
   * image (Slice 15.16: image_to_video + audio_input, excluding models
   * that want PUBLIC audio URLs — a client-side app has none to give).
   * perSecondUsd is keyed by resolution; '' holds a flat per-second rate.
   */
  lipSync: { perSecondUsd: Record<string, number> } | null
  /**
   * Release date (ISO) from the listing's `created` timestamp, when the
   * API provides one; null otherwise. Powers newest/oldest sorting and the
   * date chip in the model menu.
   */
  releasedAt: string | null
}

/** `created` unix seconds → ISO date string; null when absent/invalid. */
export function releasedAtFromCreated(created: unknown): string | null {
  if (
    typeof created !== 'number' ||
    !Number.isFinite(created) ||
    created <= 0
  ) {
    return null
  }
  return new Date(created * 1000).toISOString()
}

/**
 * Recognize a TTS pricing object. Precedence mirrors what the listing
 * means: a positive per-1k-chars rate wins (VibeVoice carries
 * `per_thousand_chars: 0` NEXT TO its real `per_generation` price, so a
 * zero rate is "not this shape", not "free"); then block pricing; then a
 * flat per-generation price. Null when nothing matches.
 */
export function parseTtsPricing(
  pricing:
    | {
        per_thousand_chars?: number
        per_prompt_char_block?: number
        prompt_char_block_size?: number
        per_generation?: number
        minimum?: number
      }
    | undefined,
): TtsPricing | null {
  if (pricing === undefined) return null
  const perK = pricing.per_thousand_chars
  if (typeof perK === 'number' && perK > 0) {
    return { kind: 'perKChars', usdPerKChars: perK }
  }
  const perBlock = pricing.per_prompt_char_block
  const blockChars = pricing.prompt_char_block_size
  if (
    typeof perBlock === 'number' &&
    perBlock > 0 &&
    typeof blockChars === 'number' &&
    blockChars > 0
  ) {
    return {
      kind: 'perCharBlock',
      usdPerBlock: perBlock,
      blockChars,
      minimumUsd: pricing.minimum ?? perBlock,
    }
  }
  const perGen = pricing.per_generation
  if (typeof perGen === 'number' && perGen > 0) {
    return { kind: 'perGeneration', usd: perGen }
  }
  return null
}

/**
 * Values of a structured select parameter (Slice 15.14). Newer video models
 * (observed live: wan-wavespeed-25/26, wan-25-fast) advertise options as
 * `supported_parameters.parameters.<name>.options[{value,label}]` instead
 * of the legacy flat arrays — both shapes must feed the same UI.
 */
export function extractOptionValues(param: unknown): string[] | null {
  if (typeof param !== 'object' || param === null) return null
  const options = (param as { options?: unknown }).options
  if (!Array.isArray(options)) return null
  const values = options
    .map((o) =>
      typeof o === 'object' && o !== null
        ? (o as { value?: unknown }).value
        : undefined,
    )
    .filter((v): v is string | number => {
      return typeof v === 'string' || typeof v === 'number'
    })
    .map(String)
  return values.length > 0 ? values : null
}

/**
 * Range of a structured NUMBER parameter. Shapes observed live: clean
 * `min`/`max` fields (Wan 2.2 5b); only preset `options` (Wan 2.1
 * num_frames: 81/100); or the range living ONLY in the description text —
 * "Frames per second (5-24)" (Wan 2.1 fps). Null when it isn't a usable
 * number parameter.
 */
export function extractNumberRange(
  param: unknown,
): { min: number; max: number; default: number } | null {
  if (typeof param !== 'object' || param === null) return null
  const p = param as {
    type?: unknown
    default?: unknown
    min?: unknown
    max?: unknown
    description?: unknown
  }
  if (p.type !== 'number') return null
  const fallback = typeof p.default === 'number' ? p.default : null
  let min = typeof p.min === 'number' ? p.min : null
  let max = typeof p.max === 'number' ? p.max : null
  if (min === null || max === null) {
    const optionValues = (extractOptionValues(param) ?? [])
      .map(Number)
      .filter((n) => Number.isFinite(n))
    if (optionValues.length > 0) {
      min ??= Math.min(
        ...optionValues,
        ...(fallback === null ? [] : [fallback]),
      )
      max ??= Math.max(
        ...optionValues,
        ...(fallback === null ? [] : [fallback]),
      )
    }
  }
  if ((min === null || max === null) && typeof p.description === 'string') {
    const match = /\((\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\)/.exec(
      p.description,
    )
    if (match !== null) {
      min ??= Number(match[1])
      max ??= Number(match[2])
    }
  }
  if (min === null || max === null || fallback === null) {
    if (fallback === null) return null
    min ??= fallback
    max ??= fallback
  }
  return { min, max, default: fallback }
}

/**
 * Lip-sync capability (Slice 15.16). Usable models take an image AND an
 * audio track (wan-wavespeed-s2v, longcat-avatar, bytedance omni-human —
 * observed live 2026-08-22). Models wanting public audio URLs
 * (left_audio/right_audio params) are excluded: Kairo is client-side and
 * has no public URLs to hand out.
 */
export function extractLipSync(
  capabilities: { image_to_video?: boolean; audio_input?: boolean } | undefined,
  parameters: Record<string, unknown> | undefined,
  pricing: unknown,
): { perSecondUsd: Record<string, number> } | null {
  if (
    capabilities?.image_to_video !== true ||
    capabilities.audio_input !== true
  ) {
    return null
  }
  if (
    parameters !== undefined &&
    ('left_audio' in parameters || 'right_audio' in parameters)
  ) {
    return null
  }
  const p = (pricing ?? {}) as {
    per_second_by_resolution?: Record<string, unknown>
    per_second?: unknown
  }
  const perSecondUsd: Record<string, number> = {}
  if (
    typeof p.per_second_by_resolution === 'object' &&
    p.per_second_by_resolution !== null
  ) {
    for (const [res, rate] of Object.entries(p.per_second_by_resolution)) {
      if (typeof rate === 'number' && rate > 0) perSecondUsd[res] = rate
    }
  }
  if (typeof p.per_second === 'number' && p.per_second > 0) {
    perSecondUsd[''] = p.per_second
  }
  return { perSecondUsd }
}

/** Frame-based duration control, when the model advertises one. */
export function extractFrameControl(
  parameters: Record<string, unknown> | undefined,
): FrameControl | null {
  if (parameters === undefined) return null
  const frames = extractNumberRange(parameters['num_frames'])
  const fps = extractNumberRange(parameters['frames_per_second'])
  if (frames === null || fps === null) return null
  return {
    minFrames: frames.min,
    maxFrames: frames.max,
    defaultFrames: frames.default,
    minFps: fps.min,
    maxFps: fps.max,
    defaultFps: fps.default,
  }
}

/** Recursively collect numeric leaves of a pricing object (skips currency). */
export function extractPriceRange(
  pricing: unknown,
): { min: number; max: number } | null {
  const values: number[] = []
  const walk = (node: unknown): void => {
    if (typeof node === 'number' && Number.isFinite(node) && node > 0) {
      values.push(node)
      return
    }
    if (typeof node === 'object' && node !== null) {
      for (const [key, value] of Object.entries(node)) {
        if (key === 'currency' || key === 'unit') continue
        walk(value)
      }
    }
  }
  walk(pricing)
  if (values.length === 0) return null
  return { min: Math.min(...values), max: Math.max(...values) }
}

/**
 * Find the finished video's URL in a status response `output`. The documented
 * shape is `output.video.url`, but the unified endpoint fronts many backends
 * and close variants show up in the wild (`output.url`, `output.video_url`,
 * a bare URL string, an array of videos). A paid, completed job should never
 * be dropped over a field name — accept every common spelling.
 *
 * Some backends (grok-imagine-video) return a RELATIVE path like
 * `/api/generate-video/content?...` — accepted here and resolved against the
 * NanoGPT origin by the caller. Fetching it unresolved would hit the app's
 * own origin and store the dev server's index.html as a "clip" (LESSONS.md).
 */
export function extractVideoUrl(output: unknown): string | null {
  const isUrl = (v: unknown): v is string =>
    typeof v === 'string' && (v.startsWith('http') || v.startsWith('/'))
  if (isUrl(output)) return output
  if (typeof output !== 'object' || output === null) return null
  const o = output as {
    video?: unknown
    url?: unknown
    video_url?: unknown
    videoUrl?: unknown
    videos?: unknown
  }
  const nested =
    typeof o.video === 'object' && o.video !== null
      ? (o.video as { url?: unknown }).url
      : o.video
  const first = Array.isArray(o.videos)
    ? (o.videos[0] as { url?: unknown } | undefined)?.url
    : undefined
  for (const candidate of [nested, o.url, o.video_url, o.videoUrl, first]) {
    if (isUrl(candidate)) return candidate
  }
  return null
}

/**
 * One part of a multimodal user message (OpenAI-compatible). Image parts
 * carry an https URL or a base64 data URL; the docs recommend data URLs.
 * Accepted image mime types: png, jpeg, jpg, webp.
 */
export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  /** Plain text, or content parts for vision-capable models. */
  content: string | ChatContentPart[]
}

export interface ChatUsage {
  promptTokens: number
  completionTokens: number
}

export interface ChatCompletionResult {
  content: string
  model: string
  /** Real token usage reported by the API, when available. */
  usage: ChatUsage | null
}

export interface SpeechGenerationParams {
  model: string
  /** The text to narrate; billed by character count. */
  input: string
  voice: string
  /** Playback rate multiplier (0.5–2.0); defaults to 1. */
  speed?: number
  /** Queue-poll interval for async models (tests shorten it). */
  pollIntervalMs?: number
  /**
   * Fired when the request lands on a queue instead of returning audio.
   * Queue models charge AT SUBMISSION (`charged: true` in the envelope) —
   * callers use this to log the spend even if the run later fails.
   */
  onQueued?: (info: { charged: boolean; costUsd: number | null }) => void
}

export interface ImageGenerationParams {
  model: string
  prompt: string
  resolution?: string
  aspectRatio?: string
  n?: number
  /**
   * Reference images for image-to-image models (data URLs or https URLs),
   * sent as `input_references`. Never combine with the legacy image aliases
   * (`imageDataUrl` etc.) — the API rejects mixed image inputs.
   */
  inputReferences?: string[]
}

export interface GeneratedImage {
  /** Either a URL or a base64 payload, depending on the model/provider. */
  url: string | null
  b64Json: string | null
}

export interface VideoGenerationParams {
  model: string
  prompt?: string
  /** Duration in seconds, as a string per the API (e.g. "5", "8"). */
  duration?: string
  aspectRatio?: string
  /** Resolution tier, e.g. "480p" — a major cost driver on most models. */
  resolution?: string
  /** For image-to-video: a data URL of the source image. */
  imageDataUrl?: string
  /** Frame-based models (Wan): sent INSTEAD of duration. */
  numFrames?: number
  framesPerSecond?: number
  /** Lip-sync models (15.16): base64 data URL of the driving audio. */
  audioDataUrl?: string
  /** Length of that audio in seconds, when known. */
  audioDuration?: number
}

export interface VideoJobSubmission {
  runId: string
  status: string
  /** Actual cost charged for this job, in USD. */
  costUsd: number | null
}

export type VideoJobStatus =
  'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELED'

export interface VideoJobState {
  status: VideoJobStatus
  videoUrl: string | null
  costUsd: number | null
  error: string | null
}

export interface UsageTotals {
  requests: number
  netCostUsd: number
}

// -- Errors ----------------------------------------------------------------

export class NanoGptError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'NanoGptError'
    this.status = status
  }
}

export class InvalidApiKeyError extends NanoGptError {
  constructor() {
    super(401, 'The API key was rejected by NanoGPT.')
    this.name = 'InvalidApiKeyError'
  }
}

// -- Client ----------------------------------------------------------------

export class NanoGptClient {
  private readonly apiKey: string
  private readonly baseUrl: string

  constructor(apiKey: string, baseUrl: string = NANOGPT_BASE_URL) {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  private async request(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'x-api-key': this.apiKey,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new InvalidApiKeyError()
      }
      let message = `NanoGPT request failed (HTTP ${String(response.status)}).`
      try {
        const data = (await response.json()) as { message?: string }
        if (typeof data.message === 'string') message = data.message
      } catch {
        // Non-JSON error body; keep the generic message.
      }
      throw new NanoGptError(response.status, message)
    }
    return response.json()
  }

  /** POST /check-balance — also used to validate a pasted API key. */
  async checkBalance(): Promise<Balance> {
    const data = (await this.request('POST', '/check-balance')) as {
      usd_balance: string | number
    }
    const usdBalance = Number(data.usd_balance)
    if (!Number.isFinite(usdBalance)) {
      throw new NanoGptError(200, 'Unexpected balance response shape.')
    }
    return { usdBalance }
  }

  /** GET /v1/models?detailed=true — text models with per-MTok pricing. */
  async listTextModels(): Promise<TextModel[]> {
    const data = (await this.request('GET', '/v1/models?detailed=true')) as {
      data: {
        id: string
        name?: string
        description?: string
        pricing?: { prompt?: number; completion?: number }
        capabilities?: { vision?: boolean }
        created?: number
      }[]
    }
    return data.data.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      description: m.description ?? '',
      promptPricePerMTok: m.pricing?.prompt ?? null,
      completionPricePerMTok: m.pricing?.completion ?? null,
      supportsVision: m.capabilities?.vision ?? false,
      releasedAt: releasedAtFromCreated(m.created),
    }))
  }

  /** GET /v1/image-models — image models with per-image pricing. */
  async listImageModels(): Promise<ImageModel[]> {
    const data = (await this.request(
      'GET',
      '/v1/image-models?detailed=true',
    )) as {
      data: {
        id: string
        name?: string
        description?: string
        pricing?: { per_image?: Record<string, number> }
        capabilities?: { image_to_image?: boolean }
        supported_parameters?: { resolutions?: string[] }
        created?: number
      }[]
    }
    return data.data.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      description: m.description ?? '',
      perImageUsd: m.pricing?.per_image ?? {},
      resolutions: m.supported_parameters?.resolutions ?? [],
      supportsImageToImage: m.capabilities?.image_to_image ?? false,
      releasedAt: releasedAtFromCreated(m.created),
    }))
  }

  /** GET /v1/video-models — video models, capabilities, and pricing hints. */
  async listVideoModels(): Promise<VideoModel[]> {
    const data = (await this.request(
      'GET',
      '/v1/video-models?detailed=true',
    )) as {
      data: {
        id: string
        name?: string
        description?: string
        pricing?: unknown
        capabilities?: {
          text_to_video?: boolean
          image_to_video?: boolean
          audio_input?: boolean
        }
        supported_parameters?: {
          resolutions?: string[]
          durations?: (string | number)[]
          parameters?: Record<string, unknown>
        }
        created?: number
      }[]
    }
    return data.data.map((m) => {
      const sp = m.supported_parameters
      const frameControl = extractFrameControl(sp?.parameters)
      return {
        id: m.id,
        name: m.name ?? m.id,
        description: m.description ?? '',
        supportsTextToVideo: m.capabilities?.text_to_video ?? false,
        supportsImageToVideo: m.capabilities?.image_to_video ?? false,
        priceRangeUsd: extractPriceRange(m.pricing),
        // Legacy flat arrays, or the structured select schema — either way
        // the model's REAL options, never our generic fallbacks.
        resolutions:
          sp?.resolutions ??
          extractOptionValues(sp?.parameters?.['resolution']) ??
          [],
        durations:
          frameControl !== null
            ? achievableFrameDurations(frameControl)
            : (
                sp?.durations ??
                extractOptionValues(sp?.parameters?.['duration']) ??
                []
              ).map(String),
        frameControl,
        lipSync: extractLipSync(m.capabilities, sp?.parameters, m.pricing),
        releasedAt: releasedAtFromCreated(m.created),
      }
    })
  }

  /**
   * GET /v1/audio-models?type=tts — the TTS catalog (Slice 15.9).
   * The `type=tts` filter still leaks music/SFX/utility models (observed
   * live: Mureka song tools, ACE-Step, stem separation…), so we keep only
   * entries that are actually text-to-speech: the `text_to_speech`
   * capability, the `audio_tts` category, or a non-empty voice list.
   */
  /**
   * Models hidden from the catalog because NanoGPT reliably breaks on
   * them. vibevoice: accepts the job, charges $0.15 flat, then the run
   * dies instantly ({"status":"error","terminal":true} on the first
   * poll) — verified live 2026-08-22. Re-test before un-hiding.
   */
  static readonly BROKEN_TTS_MODEL_IDS = new Set(['microsoft/vibevoice'])

  async listTtsModels(): Promise<TtsModel[]> {
    const data = (await this.request(
      'GET',
      '/v1/audio-models?detailed=true&type=tts',
    )) as {
      data: {
        id: string
        name?: string
        description?: string
        category?: string
        pricing?: {
          per_thousand_chars?: number
          per_prompt_char_block?: number
          prompt_char_block_size?: number
          per_generation?: number
          minimum?: number
        }
        capabilities?: { text_to_speech?: boolean }
        supported_parameters?: { max_chars?: number; voices?: string[] }
        created?: number
      }[]
    }
    return data.data
      .filter(
        (m) =>
          m.capabilities?.text_to_speech === true ||
          m.category === 'audio_tts' ||
          (m.supported_parameters?.voices ?? []).length > 0,
      )
      .filter((m) => !NanoGptClient.BROKEN_TTS_MODEL_IDS.has(m.id))
      .map((m) => ({
        id: m.id,
        name: m.name ?? m.id,
        description: m.description ?? '',
        pricing: parseTtsPricing(m.pricing),
        voices: m.supported_parameters?.voices ?? [],
        maxInputChars: m.supported_parameters?.max_chars ?? null,
        releasedAt: releasedAtFromCreated(m.created),
      }))
  }

  /** POST /v1/chat/completions — OpenAI-compatible, non-streaming. */
  async chatComplete(
    model: string,
    messages: ChatMessage[],
    options?: { maxTokens?: number },
  ): Promise<ChatCompletionResult> {
    const data = (await this.request('POST', '/v1/chat/completions', {
      model,
      messages,
      stream: false,
      ...(options?.maxTokens !== undefined
        ? { max_tokens: options.maxTokens }
        : {}),
    })) as {
      model?: string
      choices?: { message?: { content?: string } }[]
      usage?: { prompt_tokens?: number; completion_tokens?: number }
    }
    const content = data.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      throw new NanoGptError(200, 'Unexpected chat completion response shape.')
    }
    const usage =
      typeof data.usage?.prompt_tokens === 'number' &&
      typeof data.usage.completion_tokens === 'number'
        ? {
            promptTokens: data.usage.prompt_tokens,
            completionTokens: data.usage.completion_tokens,
          }
        : null
    return { content, model: data.model ?? model, usage }
  }

  /** POST /v1/images — normalized image generation. */
  async generateImage(
    params: ImageGenerationParams,
  ): Promise<GeneratedImage[]> {
    const data = (await this.request('POST', '/v1/images', {
      model: params.model,
      prompt: params.prompt,
      ...(params.resolution !== undefined
        ? { resolution: params.resolution }
        : {}),
      ...(params.aspectRatio !== undefined
        ? { aspect_ratio: params.aspectRatio }
        : {}),
      ...(params.n !== undefined ? { n: params.n } : {}),
      ...(params.inputReferences !== undefined &&
      params.inputReferences.length > 0
        ? { input_references: params.inputReferences }
        : {}),
    })) as {
      data?: { url?: string; b64_json?: string }[]
    }
    const images = data.data ?? []
    if (images.length === 0) {
      throw new NanoGptError(200, 'Image generation returned no images.')
    }
    return images.map((img) => ({
      url: img.url ?? null,
      b64Json: img.b64_json ?? null,
    }))
  }

  /**
   * POST /v1/audio/speech — synchronous TTS (docs-verified 2026-08-22).
   * Returns the finished audio file as raw bytes; billed by input
   * characters, so the caller knows the exact price up front.
   */
  async generateSpeech(params: SpeechGenerationParams): Promise<Blob> {
    const response = await fetch(`${this.baseUrl}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: params.model,
        input: params.input,
        // A rare model may list no voice presets; let the API default then.
        ...(params.voice.length > 0 ? { voice: params.voice } : {}),
        response_format: 'mp3',
        ...(params.speed !== undefined ? { speed: params.speed } : {}),
      }),
    })
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new InvalidApiKeyError()
      }
      let message = `NanoGPT request failed (HTTP ${String(response.status)}).`
      try {
        const data = (await response.json()) as { message?: string }
        if (typeof data.message === 'string') message = data.message
      } catch {
        // Non-JSON error body; keep the generic message.
      }
      throw new NanoGptError(response.status, message)
    }

    // Some models are SYNCHRONOUS (audio bytes right here); others are
    // queue-based and answer 200/202 with {"status":"pending","runId"}
    // (observed live 2026-08-22: ElevenLabs, VibeVoice, Omnivoice, Qwen,
    // ByteDance Seed Audio). Detect the envelope and poll /tts/status.
    const contentType = response.headers.get('content-type') ?? ''
    if (!/json/i.test(contentType)) return response.blob()
    const envelope = (await response.json()) as {
      status?: string
      runId?: string
      charged?: boolean
      cost?: number
      paymentSource?: string
    }
    if (envelope.status !== 'pending' || typeof envelope.runId !== 'string') {
      // JSON but not the async envelope — hand the payload back as a blob;
      // the caller's normalizer knows how to unwrap base64 envelopes.
      return new Blob([JSON.stringify(envelope)], {
        type: 'application/json',
      })
    }
    params.onQueued?.({
      charged: envelope.charged === true,
      costUsd: typeof envelope.cost === 'number' ? envelope.cost : null,
    })
    return this.pollTtsRun(envelope, params)
  }

  /** Poll GET /tts/status until a queued TTS run finishes, then download. */
  private async pollTtsRun(
    envelope: { runId?: string; cost?: number; paymentSource?: string },
    params: SpeechGenerationParams,
  ): Promise<Blob> {
    const intervalMs = params.pollIntervalMs ?? 2000
    const deadline = Date.now() + 5 * 60 * 1000
    const query = new URLSearchParams({
      runId: envelope.runId ?? '',
      model: params.model,
      ...(envelope.cost !== undefined ? { cost: String(envelope.cost) } : {}),
      ...(envelope.paymentSource !== undefined
        ? { paymentSource: envelope.paymentSource }
        : {}),
      isApiRequest: 'true',
    })
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs))
      const status = (await this.request(
        'GET',
        `/tts/status?${query.toString()}`,
      )) as {
        status?: string
        audioUrl?: string
        error?: string
        message?: string
        terminal?: boolean
      }
      const state = (status.status ?? '').toLowerCase()
      if (state === 'completed' || typeof status.audioUrl === 'string') {
        const raw = status.audioUrl
        if (typeof raw !== 'string' || raw.length === 0) {
          throw new NanoGptError(
            200,
            'The narration finished but no audio URL came back.',
          )
        }
        // Grok lesson: URLs may be relative — resolve against OUR origin.
        const url = /^https?:\/\//.test(raw)
          ? raw
          : new URL(raw, new URL(this.baseUrl).origin).toString()
        return this.downloadAudio(url)
      }
      // `terminal: true` marks any state that will never progress (seen
      // live on microsoft/vibevoice: {"status":"error","terminal":true}) —
      // stop polling immediately, whatever the status string says.
      if (
        state === 'failed' ||
        state === 'error' ||
        (status.terminal === true && state !== 'completed')
      ) {
        throw new NanoGptError(
          200,
          status.error ??
            status.message ??
            'NanoGPT reported the narration failed.',
        )
      }
      if (Date.now() > deadline) {
        throw new NanoGptError(
          200,
          'The narration is still queued after 5 minutes — try again later.',
        )
      }
    }
  }

  /**
   * Download finished audio. The key is sacred: it rides along ONLY when
   * the URL is on the NanoGPT origin — third-party CDNs never see it.
   */
  async downloadAudio(url: string): Promise<Blob> {
    const sameOrigin = new URL(url).origin === new URL(this.baseUrl).origin
    let response: Response
    try {
      response = await fetch(
        url,
        sameOrigin ? { headers: { 'x-api-key': this.apiKey } } : undefined,
      )
    } catch (error) {
      // fetch TypeError = the browser was FORBIDDEN from reading the bytes
      // (no CORS on the file's host — the R2 wall from the video pipeline).
      if (error instanceof TypeError) {
        throw new NanoGptError(
          0,
          'The narration finished, but its storage host blocks browser downloads (no CORS).',
        )
      }
      throw error
    }
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new InvalidApiKeyError()
      }
      throw new NanoGptError(
        response.status,
        `The finished narration could not be downloaded (HTTP ${String(response.status)}).`,
      )
    }
    return response.blob()
  }

  /** POST /generate-video — async; returns a runId to poll. */
  async generateVideo(
    params: VideoGenerationParams,
  ): Promise<VideoJobSubmission> {
    const data = (await this.request('POST', '/generate-video', {
      model: params.model,
      ...(params.prompt !== undefined ? { prompt: params.prompt } : {}),
      ...(params.duration !== undefined ? { duration: params.duration } : {}),
      ...(params.numFrames !== undefined
        ? { num_frames: params.numFrames }
        : {}),
      ...(params.framesPerSecond !== undefined
        ? { frames_per_second: params.framesPerSecond }
        : {}),
      ...(params.audioDataUrl !== undefined
        ? { audioDataUrl: params.audioDataUrl }
        : {}),
      ...(params.audioDuration !== undefined
        ? { audioDuration: params.audioDuration }
        : {}),
      ...(params.aspectRatio !== undefined
        ? { aspect_ratio: params.aspectRatio }
        : {}),
      ...(params.resolution !== undefined
        ? { resolution: params.resolution }
        : {}),
      ...(params.imageDataUrl !== undefined
        ? { imageDataUrl: params.imageDataUrl }
        : {}),
    })) as { runId?: string; id?: string; status?: string; cost?: number }
    const runId = data.runId ?? data.id
    if (runId === undefined) {
      throw new NanoGptError(200, 'Video generation returned no run id.')
    }
    return {
      runId,
      status: data.status ?? 'pending',
      costUsd: data.cost ?? null,
    }
  }

  /** GET /video/status?requestId=... — unified polling endpoint. */
  async getVideoStatus(runId: string): Promise<VideoJobState> {
    const data = (await this.request(
      'GET',
      `/video/status?requestId=${encodeURIComponent(runId)}`,
    )) as {
      data?: {
        status?: string
        output?: unknown
        cost?: number
        error?: string | null
      }
    }
    // Backends have been seen returning lowercase statuses — normalize.
    const status = String(
      data.data?.status ?? 'IN_QUEUE',
    ).toUpperCase() as VideoJobStatus
    const rawUrl = extractVideoUrl(data.data?.output)
    return {
      status,
      // Relative paths resolve against the NanoGPT origin — NEVER against
      // the app's own origin (that stores index.html as a clip).
      videoUrl:
        rawUrl === null
          ? null
          : new URL(rawUrl, new URL(this.baseUrl).origin).toString(),
      costUsd: data.data?.cost ?? null,
      error: data.data?.error ?? null,
    }
  }

  /**
   * Download a finished clip. URLs on the NanoGPT origin (e.g. the relative
   * `/api/generate-video/content` paths some models return) are
   * authenticated with the API key; third-party CDN URLs must NEVER
   * receive it.
   */
  async downloadVideo(url: string): Promise<Blob> {
    const sameOrigin = new URL(url).origin === new URL(this.baseUrl).origin
    const response = await fetch(
      url,
      sameOrigin ? { headers: { 'x-api-key': this.apiKey } } : undefined,
    )
    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new InvalidApiKeyError()
      }
      throw new NanoGptError(
        response.status,
        `The finished video could not be downloaded (HTTP ${String(response.status)}).`,
      )
    }
    return response.blob()
  }

  /** GET /v1/usage — aggregate spend for the current key. */
  async getUsage(): Promise<UsageTotals> {
    const data = (await this.request('GET', '/v1/usage')) as {
      totals?: { requests?: number; netCostUsd?: number }
    }
    return {
      requests: data.totals?.requests ?? 0,
      netCostUsd: data.totals?.netCostUsd ?? 0,
    }
  }
}

/** Masked form for display, e.g. "••••4f2a". Never show the full key. */
export function maskApiKey(key: string): string {
  const tail = key.length > 4 ? key.slice(-4) : key
  return `••••${tail}`
}
