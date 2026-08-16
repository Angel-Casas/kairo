import { NANOGPT_BASE_URL } from '../config'

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
}

export interface ImageModel {
  id: string
  name: string
  description: string
  /** Map of resolution (e.g. "1024x1024") to USD per image, when provided. */
  perImageUsd: Record<string, number>
  resolutions: string[]
  supportsImageToImage: boolean
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

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
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

export interface ImageGenerationParams {
  model: string
  prompt: string
  resolution?: string
  aspectRatio?: string
  n?: number
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
      }[]
    }
    return data.data.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      description: m.description ?? '',
      promptPricePerMTok: m.pricing?.prompt ?? null,
      completionPricePerMTok: m.pricing?.completion ?? null,
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
      }[]
    }
    return data.data.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      description: m.description ?? '',
      perImageUsd: m.pricing?.per_image ?? {},
      resolutions: m.supported_parameters?.resolutions ?? [],
      supportsImageToImage: m.capabilities?.image_to_image ?? false,
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
        capabilities?: { text_to_video?: boolean; image_to_video?: boolean }
        supported_parameters?: { resolutions?: string[] }
      }[]
    }
    return data.data.map((m) => ({
      id: m.id,
      name: m.name ?? m.id,
      description: m.description ?? '',
      supportsTextToVideo: m.capabilities?.text_to_video ?? false,
      supportsImageToVideo: m.capabilities?.image_to_video ?? false,
      priceRangeUsd: extractPriceRange(m.pricing),
      resolutions: m.supported_parameters?.resolutions ?? [],
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

  /** POST /generate-video — async; returns a runId to poll. */
  async generateVideo(
    params: VideoGenerationParams,
  ): Promise<VideoJobSubmission> {
    const data = (await this.request('POST', '/generate-video', {
      model: params.model,
      ...(params.prompt !== undefined ? { prompt: params.prompt } : {}),
      ...(params.duration !== undefined ? { duration: params.duration } : {}),
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
        output?: { video?: { url?: string } }
        cost?: number
        error?: string | null
      }
    }
    const status = (data.data?.status ?? 'IN_QUEUE') as VideoJobStatus
    return {
      status,
      videoUrl: data.data?.output?.video?.url ?? null,
      costUsd: data.data?.cost ?? null,
      error: data.data?.error ?? null,
    }
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
