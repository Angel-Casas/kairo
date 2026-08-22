import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import {
  InvalidApiKeyError,
  maskApiKey,
  NanoGptClient,
  NanoGptError,
} from './nanogpt'

const BASE = 'https://nano-gpt.com/api'
const KEY = 'test-key-4f2a'

const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
})
afterAll(() => {
  server.close()
})

const client = () => new NanoGptClient(KEY)

describe('NanoGptClient auth', () => {
  it('sends the key as x-api-key header', async () => {
    let seenKey: string | null = null
    server.use(
      http.post(`${BASE}/check-balance`, ({ request }) => {
        seenKey = request.headers.get('x-api-key')
        return HttpResponse.json({ usd_balance: '10.5' })
      }),
    )
    await client().checkBalance()
    expect(seenKey).toBe(KEY)
  })

  it('maps 401 to InvalidApiKeyError without leaking the key', async () => {
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ message: 'bad key' }, { status: 401 }),
      ),
    )
    const error = await client()
      .checkBalance()
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(InvalidApiKeyError)
    expect(JSON.stringify(error)).not.toContain(KEY)
    expect((error as Error).message).not.toContain(KEY)
  })

  it('maps other HTTP errors to NanoGptError with the server message', async () => {
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ message: 'insufficient funds' }, { status: 402 }),
      ),
    )
    await expect(client().checkBalance()).rejects.toThrow('insufficient funds')
    await expect(client().checkBalance()).rejects.toBeInstanceOf(NanoGptError)
  })
})

describe('checkBalance', () => {
  it('parses the string balance into a number', async () => {
    server.use(
      http.post(`${BASE}/check-balance`, () =>
        HttpResponse.json({ usd_balance: '129.46956147' }),
      ),
    )
    expect((await client().checkBalance()).usdBalance).toBeCloseTo(129.4696, 3)
  })
})

describe('model listings', () => {
  it('parses text models with per-MTok pricing', async () => {
    server.use(
      http.get(`${BASE}/v1/models`, () =>
        HttpResponse.json({
          object: 'list',
          data: [
            {
              id: 'some/model',
              name: 'Some Model',
              description: 'desc',
              pricing: { prompt: 1.25, completion: 5 },
              created: 1747008000, // 2025-05-12
            },
            { id: 'bare/model' },
          ],
        }),
      ),
    )
    const models = await client().listTextModels()
    expect(models).toHaveLength(2)
    expect(models[0]).toEqual({
      id: 'some/model',
      name: 'Some Model',
      description: 'desc',
      promptPricePerMTok: 1.25,
      completionPricePerMTok: 5,
      supportsVision: false,
      releasedAt: new Date(1747008000 * 1000).toISOString(),
    })
    expect(models[1]?.releasedAt).toBeNull()
    expect(models[1]?.name).toBe('bare/model')
    expect(models[1]?.promptPricePerMTok).toBeNull()
    expect(models[1]?.supportsVision).toBe(false)
  })

  it('parses capabilities.vision on text models', async () => {
    server.use(
      http.get(`${BASE}/v1/models`, () =>
        HttpResponse.json({
          object: 'list',
          data: [
            { id: 'seer/model', capabilities: { vision: true } },
            { id: 'blind/model', capabilities: {} },
          ],
        }),
      ),
    )
    const models = await client().listTextModels()
    expect(models[0]?.supportsVision).toBe(true)
    expect(models[1]?.supportsVision).toBe(false)
  })

  it('parses image models with per-image pricing and resolutions', async () => {
    server.use(
      http.get(`${BASE}/v1/image-models`, () =>
        HttpResponse.json({
          object: 'list',
          data: [
            {
              id: 'img-model',
              name: 'Img',
              pricing: { per_image: { '1024x1024': 0.01 }, currency: 'USD' },
              capabilities: { image_to_image: true },
              supported_parameters: { resolutions: ['1024x1024'] },
            },
          ],
        }),
      ),
    )
    const models = await client().listImageModels()
    expect(models[0]?.perImageUsd['1024x1024']).toBe(0.01)
    expect(models[0]?.supportsImageToImage).toBe(true)
    expect(models[0]?.resolutions).toEqual(['1024x1024'])
  })

  it('parses video models with capabilities, price range, and resolutions', async () => {
    server.use(
      http.get(`${BASE}/v1/video-models`, () =>
        HttpResponse.json({
          object: 'list',
          data: [
            {
              id: 'vid-model',
              capabilities: { text_to_video: true, image_to_video: true },
              pricing: {
                currency: 'USD',
                per_video: { '480p': 0.72, '1080p': 1.8 },
              },
              supported_parameters: {
                resolutions: ['480p', '1080p'],
                durations: [5, '10'],
              },
            },
            { id: 'bare-vid' },
          ],
        }),
      ),
    )
    const models = await client().listVideoModels()
    expect(models[0]?.supportsImageToVideo).toBe(true)
    expect(models[0]?.priceRangeUsd).toEqual({ min: 0.72, max: 1.8 })
    expect(models[0]?.resolutions).toEqual(['480p', '1080p'])
    expect(models[0]?.durations).toEqual(['5', '10'])
    expect(models[1]?.priceRangeUsd).toBeNull()
    expect(models[1]?.resolutions).toEqual([])
    expect(models[1]?.durations).toEqual([])
  })

  it('extractPriceRange walks nested pricing shapes and skips metadata', async () => {
    const { extractPriceRange } = await import('./nanogpt')
    expect(
      extractPriceRange({
        currency: 'USD',
        tiers: [{ price: 0.5 }, { price: 2 }],
        per_second: 0.1,
      }),
    ).toEqual({ min: 0.1, max: 2 })
    expect(extractPriceRange({ currency: 'USD' })).toBeNull()
    expect(extractPriceRange(undefined)).toBeNull()
  })

  it('reads durations/resolutions from the structured parameters schema (15.14)', async () => {
    server.use(
      http.get(`${BASE}/v1/video-models`, () =>
        HttpResponse.json({
          object: 'list',
          data: [
            {
              // wan-25-fast shape observed live: no flat arrays, options
              // under parameters.<name>.options[{value,label}].
              id: 'wan-25-fast',
              capabilities: { text_to_video: true, image_to_video: true },
              pricing: {
                currency: 'USD',
                per_second_by_resolution: { '720p': 0.068, '1080p': 0.102 },
              },
              supported_parameters: {
                parameters: {
                  resolution: {
                    type: 'select',
                    options: [{ value: '720p' }, { value: '1080p' }],
                    default: '720p',
                  },
                  duration: {
                    type: 'select',
                    options: [
                      { value: '5', label: '5 seconds' },
                      { value: '10', label: '10 seconds' },
                    ],
                    default: '5',
                  },
                },
                defaults: { resolution: '720p', duration: '5' },
              },
            },
          ],
        }),
      ),
    )
    const models = await client().listVideoModels()
    expect(models[0]?.durations).toEqual(['5', '10'])
    expect(models[0]?.resolutions).toEqual(['720p', '1080p'])
  })

  it('detects frame-based models and offers achievable second-targets (15.14)', async () => {
    server.use(
      http.get(`${BASE}/v1/video-models`, () =>
        HttpResponse.json({
          object: 'list',
          data: [
            {
              // The REAL Wan 2.1 shape: frames range only via options,
              // fps range only in the description text.
              id: 'wan-video-image-to-video',
              name: 'Wan 2.1',
              capabilities: { image_to_video: true },
              pricing: {
                currency: 'USD',
                per_resolution: { '480p': 0.2, '720p': 0.4 },
                frame_multiplier: 1.25,
                frame_threshold: 81,
              },
              supported_parameters: {
                parameters: {
                  resolution: {
                    type: 'select',
                    options: [{ value: '480p' }, { value: '720p' }],
                    default: '720p',
                  },
                  num_frames: {
                    type: 'number',
                    default: 81,
                    options: [
                      { value: '81', label: '81 frames' },
                      { value: '100', label: '100 frames (+25% cost)' },
                    ],
                    description: 'Number of frames to generate (81-100)',
                  },
                  frames_per_second: {
                    type: 'number',
                    default: 16,
                    description: 'Frames per second (5-24)',
                  },
                },
                defaults: { num_frames: 81, frames_per_second: 16 },
              },
            },
          ],
        }),
      ),
    )
    const models = await client().listVideoModels()
    expect(models[0]?.frameControl).toEqual({
      minFrames: 81,
      maxFrames: 100,
      defaultFrames: 81,
      minFps: 5,
      maxFps: 24,
      defaultFps: 16,
    })
    // Durations become the ACHIEVABLE second-targets (81/24≈3.4s min,
    // 100/5=20s max), so seconds-based UI works unchanged.
    expect(models[0]?.durations).toEqual([
      '4',
      '5',
      '6',
      '8',
      '10',
      '12',
      '15',
      '20',
    ])
    expect(models[0]?.resolutions).toEqual(['480p', '720p'])
  })

  it('extractNumberRange reads min/max fields directly (Wan 2.2 5b shape)', async () => {
    const { extractNumberRange } = await import('./nanogpt')
    expect(
      extractNumberRange({
        type: 'number',
        default: 24,
        min: 4,
        max: 60,
        options: [{ value: '4' }, { value: '60' }],
      }),
    ).toEqual({ min: 4, max: 60, default: 24 })
    expect(extractNumberRange({ type: 'select', default: '129' })).toBeNull()
    expect(extractNumberRange(undefined)).toBeNull()
  })

  it('detects lip-sync models, excluding URL-audio and non-i2v ones (15.16)', async () => {
    const { extractLipSync } = await import('./nanogpt')
    // wan-wavespeed-s2v: i2v + audio_input, per-second-by-resolution.
    expect(
      extractLipSync(
        { image_to_video: true, audio_input: true },
        { prompt: {}, resolution: {} },
        {
          currency: 'USD',
          per_second_by_resolution: { '480p': 0.04, '720p': 0.08 },
        },
      ),
    ).toEqual({ perSecondUsd: { '480p': 0.04, '720p': 0.08 } })
    // bytedance omni-human: flat per-second.
    expect(
      extractLipSync(
        { image_to_video: true, audio_input: true },
        {},
        { currency: 'USD', per_second: 0.25 },
      ),
    ).toEqual({ perSecondUsd: { '': 0.25 } })
    // longcat multi wants PUBLIC audio URLs — excluded.
    expect(
      extractLipSync(
        { image_to_video: true, audio_input: true },
        { left_audio: {}, right_audio: {} },
        { per_second_by_resolution: { '480p': 0.03 } },
      ),
    ).toBeNull()
    // kling-lipsync-a2v resyncs a VIDEO, not an image — excluded.
    expect(
      extractLipSync(
        { image_to_video: false, audio_input: true },
        {},
        { per_second: 0.09 },
      ),
    ).toBeNull()
    // Ordinary i2v without audio input — excluded.
    expect(
      extractLipSync(
        { image_to_video: true, audio_input: false },
        {},
        { per_second: 0.1 },
      ),
    ).toBeNull()
  })

  it('listTtsModels keeps only real TTS models and parses every pricing shape', async () => {
    server.use(
      http.get(`${BASE}/v1/audio-models`, () =>
        HttpResponse.json({
          object: 'list',
          data: [
            {
              id: 'Kokoro-82m',
              name: 'Kokoro 82M',
              created: 1787425313,
              category: 'audio_tts',
              pricing: { per_thousand_chars: 0.0017, currency: 'USD' },
              capabilities: { text_to_speech: true },
              supported_parameters: {
                max_chars: 10000,
                voices: ['af_bella', 'am_adam'],
              },
            },
            {
              // Block pricing (ByteDance Seed Audio shape).
              id: 'bytedance/seed-audio-1.0',
              name: 'ByteDance Seed Audio 1.0',
              pricing: {
                per_prompt_char_block: 0.09,
                prompt_char_block_size: 300,
                minimum: 0.09,
                currency: 'USD',
              },
              supported_parameters: { max_chars: 5000, voices: ['skye'] },
            },
            {
              // Flat per-generation NEXT TO a zero per-1k rate.
              id: 'fake/flat-tts',
              name: 'Flat TTS',
              pricing: {
                per_generation: 0.15,
                per_thousand_chars: 0,
                currency: 'USD',
              },
              supported_parameters: { voices: ['emma'] },
            },
            {
              // Known-broken on NanoGPT (charges, then terminal error) —
              // hidden from the catalog since 15.9.4.
              id: 'microsoft/vibevoice',
              name: 'VibeVoice',
              pricing: {
                per_generation: 0.15,
                per_thousand_chars: 0,
                currency: 'USD',
              },
              supported_parameters: { voices: ['emma'] },
            },
            {
              // Music model leaked by type=tts — must be dropped.
              id: 'Minimax-Music-02',
              name: 'MiniMax Music 02',
              category: 'audio_music',
              pricing: { per_second: 0, minimum: 0.05, currency: 'USD' },
              capabilities: { text_to_music: true },
              supported_parameters: { min_duration: 10, max_duration: 300 },
            },
          ],
        }),
      ),
    )
    const models = await client().listTtsModels()
    expect(models.map((m) => m.id)).toEqual([
      'Kokoro-82m',
      'bytedance/seed-audio-1.0',
      'fake/flat-tts',
    ])
    expect(models[0]?.pricing).toEqual({
      kind: 'perKChars',
      usdPerKChars: 0.0017,
    })
    expect(models[0]?.voices).toEqual(['af_bella', 'am_adam'])
    expect(models[0]?.maxInputChars).toBe(10000)
    expect(models[0]?.releasedAt).toBe(
      new Date(1787425313 * 1000).toISOString(),
    )
    expect(models[1]?.pricing).toEqual({
      kind: 'perCharBlock',
      usdPerBlock: 0.09,
      blockChars: 300,
      minimumUsd: 0.09,
    })
    expect(models[2]?.pricing).toEqual({ kind: 'perGeneration', usd: 0.15 })
    expect(models[2]?.maxInputChars).toBeNull()
  })
})

describe('generateSpeech (async queue)', () => {
  it('stops on terminal:true whatever the status string says', async () => {
    server.use(
      http.post(`${BASE}/v1/audio/speech`, () =>
        HttpResponse.json({
          status: 'pending',
          runId: 'run-vv',
          charged: true,
          cost: 0.15,
        }),
      ),
      http.get(`${BASE}/tts/status`, () =>
        HttpResponse.json({
          status: 'error',
          error: 'Request failed. Please check your input parameters.',
          terminal: true,
        }),
      ),
    )
    let queued: { charged: boolean; costUsd: number | null } | null = null
    const error = await client()
      .generateSpeech({
        model: 'microsoft/vibevoice',
        input: 'Hi.',
        voice: 'en-Alice_woman',
        pollIntervalMs: 1,
        onQueued: (info) => {
          queued = info
        },
      })
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(NanoGptError)
    expect((error as Error).message).toContain('check your input parameters')
    // The submission charge was reported before the failure.
    expect(queued).toEqual({ charged: true, costUsd: 0.15 })
  })
})

describe('chatComplete', () => {
  it('sends OpenAI-shaped body with max_tokens and extracts choice + usage', async () => {
    let body: unknown
    server.use(
      http.post(`${BASE}/v1/chat/completions`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          model: 'some/model',
          choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
          usage: { prompt_tokens: 117, completion_tokens: 192 },
        })
      }),
    )
    const result = await client().chatComplete(
      'some/model',
      [{ role: 'user', content: 'Hi' }],
      { maxTokens: 300 },
    )
    expect(result.content).toBe('Hello!')
    expect(result.usage).toEqual({ promptTokens: 117, completionTokens: 192 })
    expect(body).toMatchObject({
      model: 'some/model',
      stream: false,
      max_tokens: 300,
    })
  })

  it('passes multimodal content parts through unchanged (vision)', async () => {
    let body: { messages?: { content?: unknown }[] } = {}
    server.use(
      http.post(`${BASE}/v1/chat/completions`, async ({ request }) => {
        body = (await request.json()) as typeof body
        return HttpResponse.json({
          model: 'seer/model',
          choices: [{ message: { role: 'assistant', content: 'A style.' } }],
        })
      }),
    )
    await client().chatComplete('seer/model', [
      { role: 'system', content: 'Describe the style.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: 'What style is this?' },
          {
            type: 'image_url',
            image_url: { url: 'data:image/png;base64,QUJD' },
          },
        ],
      },
    ])
    expect(body.messages?.[1]?.content).toEqual([
      { type: 'text', text: 'What style is this?' },
      { type: 'image_url', image_url: { url: 'data:image/png;base64,QUJD' } },
    ])
  })

  it('returns null usage when the API omits it', async () => {
    server.use(
      http.post(`${BASE}/v1/chat/completions`, () =>
        HttpResponse.json({
          choices: [{ message: { role: 'assistant', content: 'Hi' } }],
        }),
      ),
    )
    const result = await client().chatComplete('m', [
      { role: 'user', content: 'x' },
    ])
    expect(result.usage).toBeNull()
  })

  it('throws on unexpected response shapes', async () => {
    server.use(
      http.post(`${BASE}/v1/chat/completions`, () =>
        HttpResponse.json({ choices: [] }),
      ),
    )
    await expect(
      client().chatComplete('m', [{ role: 'user', content: 'x' }]),
    ).rejects.toThrow(/Unexpected chat completion/)
  })
})

describe('generateImage', () => {
  it('returns url or b64 payloads', async () => {
    server.use(
      http.post(`${BASE}/v1/images`, () =>
        HttpResponse.json({
          data: [{ url: 'https://cdn/img.png' }, { b64_json: 'aGVsbG8=' }],
        }),
      ),
    )
    const images = await client().generateImage({ model: 'm', prompt: 'p' })
    expect(images[0]?.url).toBe('https://cdn/img.png')
    expect(images[1]?.b64Json).toBe('aGVsbG8=')
  })

  it('throws when no images come back', async () => {
    server.use(
      http.post(`${BASE}/v1/images`, () => HttpResponse.json({ data: [] })),
    )
    await expect(
      client().generateImage({ model: 'm', prompt: 'p' }),
    ).rejects.toThrow(/no images/)
  })

  it('sends reference images as input_references, never a legacy alias', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/v1/images`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: [{ b64_json: 'aGVsbG8=' }] })
      }),
    )
    await client().generateImage({
      model: 'm',
      prompt: 'p',
      inputReferences: ['data:image/png;base64,QUJD'],
    })
    expect(body.input_references).toEqual(['data:image/png;base64,QUJD'])
    // The API rejects requests mixing input_references with legacy aliases.
    expect(body).not.toHaveProperty('imageDataUrl')
    expect(body).not.toHaveProperty('image_url')
  })

  it('omits input_references when the list is empty', async () => {
    let body: Record<string, unknown> = {}
    server.use(
      http.post(`${BASE}/v1/images`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>
        return HttpResponse.json({ data: [{ b64_json: 'aGVsbG8=' }] })
      }),
    )
    await client().generateImage({
      model: 'm',
      prompt: 'p',
      inputReferences: [],
    })
    expect(body).not.toHaveProperty('input_references')
  })
})

describe('video generation and polling', () => {
  it('submits and returns runId + actual cost', async () => {
    server.use(
      http.post(`${BASE}/generate-video`, () =>
        HttpResponse.json({
          runId: 'vid_abc',
          id: 'vid_abc',
          status: 'pending',
          cost: 0.35,
        }),
      ),
    )
    const submission = await client().generateVideo({
      model: 'vid-model',
      prompt: 'a castle',
      duration: '5',
      aspectRatio: '9:16',
    })
    expect(submission).toEqual({
      runId: 'vid_abc',
      status: 'pending',
      costUsd: 0.35,
    })
  })

  it('polls status and surfaces the finished video url', async () => {
    server.use(
      http.get(`${BASE}/video/status`, ({ request }) => {
        const url = new URL(request.url)
        expect(url.searchParams.get('requestId')).toBe('vid_abc')
        return HttpResponse.json({
          requestId: 'vid_abc',
          data: {
            status: 'COMPLETED',
            output: { video: { url: 'https://cdn/video.mp4' } },
            cost: 0.35,
            error: null,
          },
        })
      }),
    )
    const state = await client().getVideoStatus('vid_abc')
    expect(state.status).toBe('COMPLETED')
    expect(state.videoUrl).toBe('https://cdn/video.mp4')
    expect(state.costUsd).toBe(0.35)
  })

  it('surfaces failure state with error message', async () => {
    server.use(
      http.get(`${BASE}/video/status`, () =>
        HttpResponse.json({
          data: { status: 'FAILED', error: 'model exploded' },
        }),
      ),
    )
    const state = await client().getVideoStatus('vid_x')
    expect(state.status).toBe('FAILED')
    expect(state.error).toBe('model exploded')
    expect(state.videoUrl).toBeNull()
  })

  it('accepts variant output shapes and lowercase statuses from backends', async () => {
    server.use(
      http.get(`${BASE}/video/status`, () =>
        HttpResponse.json({
          data: {
            status: 'completed',
            output: { url: 'https://cdn/flat.mp4' },
          },
        }),
      ),
    )
    const state = await client().getVideoStatus('vid_y')
    expect(state.status).toBe('COMPLETED')
    expect(state.videoUrl).toBe('https://cdn/flat.mp4')
  })

  it('resolves relative video URLs against the NanoGPT origin, never the app origin', async () => {
    // grok-imagine-video returns '/api/generate-video/content?...' — the
    // bug that stored the dev server's index.html as a clip (LESSONS.md).
    server.use(
      http.get(`${BASE}/video/status`, () =>
        HttpResponse.json({
          data: {
            status: 'COMPLETED',
            output: {
              video: {
                url: '/api/generate-video/content?model=grok-imagine-video&runId=r1&variant=video',
              },
            },
          },
        }),
      ),
    )
    const state = await client().getVideoStatus('vid_rel')
    expect(state.videoUrl).toBe(
      'https://nano-gpt.com/api/generate-video/content?model=grok-imagine-video&runId=r1&variant=video',
    )
  })

  it('downloadVideo sends the key to the NanoGPT origin only', async () => {
    let nanoAuth: string | null = null
    let cdnAuth: string | null = null
    server.use(
      http.get(`${BASE}/generate-video/content`, ({ request }) => {
        nanoAuth = request.headers.get('x-api-key')
        return new HttpResponse('vid', {
          headers: { 'content-type': 'video/mp4' },
        })
      }),
      http.get('https://cdn.example/clip.mp4', ({ request }) => {
        cdnAuth = request.headers.get('x-api-key')
        return new HttpResponse('vid', {
          headers: { 'content-type': 'video/mp4' },
        })
      }),
    )
    await client().downloadVideo(
      `${BASE}/generate-video/content?model=m&runId=r1&variant=video`,
    )
    expect(nanoAuth).toBe(KEY)
    await client().downloadVideo('https://cdn.example/clip.mp4')
    expect(cdnAuth).toBeNull()
  })

  it('extractVideoUrl accepts every common spelling and rejects junk', async () => {
    const { extractVideoUrl } = await import('./nanogpt')
    expect(extractVideoUrl({ video: { url: 'https://cdn/a.mp4' } })).toBe(
      'https://cdn/a.mp4',
    )
    expect(extractVideoUrl({ url: 'https://cdn/b.mp4' })).toBe(
      'https://cdn/b.mp4',
    )
    expect(extractVideoUrl({ video_url: 'https://cdn/c.mp4' })).toBe(
      'https://cdn/c.mp4',
    )
    expect(extractVideoUrl({ videoUrl: 'https://cdn/d.mp4' })).toBe(
      'https://cdn/d.mp4',
    )
    expect(extractVideoUrl({ video: 'https://cdn/e.mp4' })).toBe(
      'https://cdn/e.mp4',
    )
    expect(extractVideoUrl({ videos: [{ url: 'https://cdn/f.mp4' }] })).toBe(
      'https://cdn/f.mp4',
    )
    expect(extractVideoUrl('https://cdn/g.mp4')).toBe('https://cdn/g.mp4')
    expect(extractVideoUrl({ video: { url: '/api/x?y=1' } })).toBe('/api/x?y=1')
    expect(extractVideoUrl({ video: { url: 42 } })).toBeNull()
    expect(extractVideoUrl('not-a-url')).toBeNull()
    expect(extractVideoUrl(undefined)).toBeNull()
    expect(extractVideoUrl(null)).toBeNull()
  })
})

describe('getUsage', () => {
  it('extracts totals', async () => {
    server.use(
      http.get(`${BASE}/v1/usage`, () =>
        HttpResponse.json({ totals: { requests: 12, netCostUsd: 3.5 } }),
      ),
    )
    expect(await client().getUsage()).toEqual({ requests: 12, netCostUsd: 3.5 })
  })
})

describe('maskApiKey', () => {
  it('shows only the last four characters', () => {
    expect(maskApiKey('abcdef1234')).toBe('••••1234')
    expect(maskApiKey('ab')).toBe('••••ab')
  })
})
