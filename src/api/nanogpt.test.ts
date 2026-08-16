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
    })
    expect(models[1]?.name).toBe('bare/model')
    expect(models[1]?.promptPricePerMTok).toBeNull()
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

  it('parses video models with capabilities', async () => {
    server.use(
      http.get(`${BASE}/v1/video-models`, () =>
        HttpResponse.json({
          object: 'list',
          data: [
            {
              id: 'vid-model',
              capabilities: { text_to_video: true, image_to_video: true },
            },
          ],
        }),
      ),
    )
    const models = await client().listVideoModels()
    expect(models[0]?.supportsImageToVideo).toBe(true)
  })
})

describe('chatComplete', () => {
  it('sends OpenAI-shaped body and extracts the first choice', async () => {
    let body: unknown
    server.use(
      http.post(`${BASE}/v1/chat/completions`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({
          model: 'some/model',
          choices: [{ message: { role: 'assistant', content: 'Hello!' } }],
        })
      }),
    )
    const result = await client().chatComplete('some/model', [
      { role: 'user', content: 'Hi' },
    ])
    expect(result.content).toBe('Hello!')
    expect(body).toMatchObject({ model: 'some/model', stream: false })
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
