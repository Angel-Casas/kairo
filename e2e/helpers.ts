import type { Page } from '@playwright/test'

/**
 * Shared e2e fixtures. Every NanoGPT endpoint is mocked here — e2e tests
 * never spend real money (CLAUDE.md testing rules).
 */

export const API = 'https://nano-gpt.com/api'

/** 1x1 red pixel PNG. */
export const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

export async function mockBalance(page: Page, usd = '25.00'): Promise<void> {
  await page.route(`${API}/check-balance`, (route) =>
    route.fulfill({ json: { usd_balance: usd } }),
  )
}

export async function mockTextModels(page: Page): Promise<void> {
  await page.route(`${API}/v1/models?detailed=true`, (route) =>
    route.fulfill({
      json: {
        object: 'list',
        data: [
          {
            id: 'mock/writer-1',
            name: 'Mock Writer',
            description: 'test model',
            pricing: { prompt: 2, completion: 10 },
          },
          {
            id: 'mock/seer-1',
            name: 'Mock Seer',
            description: 'vision test model',
            pricing: { prompt: 3, completion: 12 },
            capabilities: { vision: true },
          },
        ],
      },
    }),
  )
}

export async function mockImageModels(page: Page): Promise<void> {
  await page.route(`${API}/v1/image-models?detailed=true`, (route) =>
    route.fulfill({
      json: {
        object: 'list',
        data: [
          {
            id: 'mock/painter-1',
            name: 'Mock Painter',
            pricing: { per_image: { '768*1344': 0.012 }, currency: 'USD' },
            capabilities: { image_to_image: false },
            supported_parameters: { resolutions: ['768x1344'] },
          },
          {
            id: 'mock/painter-i2i',
            name: 'Mock Painter I2I',
            pricing: { per_image: { '768*1344': 0.02 }, currency: 'USD' },
            capabilities: { image_to_image: true },
            supported_parameters: { resolutions: ['768x1344'] },
          },
        ],
        meta: { count: 2, generated_at: '2026-08-16T00:00:00Z' },
      },
    }),
  )
}

export async function mockChatCompletion(
  page: Page,
  content: string,
): Promise<void> {
  await page.route(`${API}/v1/chat/completions`, (route) =>
    route.fulfill({
      json: {
        model: 'mock/writer-1',
        choices: [{ message: { role: 'assistant', content } }],
        usage: { prompt_tokens: 117, completion_tokens: 192 },
      },
    }),
  )
}

export async function mockImageGeneration(page: Page): Promise<void> {
  await page.route(`${API}/v1/images`, (route) =>
    route.fulfill({ json: { data: [{ b64_json: TINY_PNG_B64 }] } }),
  )
}

/**
 * Read the projects persisted in IndexedDB. UI state updates BEFORE the
 * async persist commits, so a test that asserts UI and then reloads can race
 * the write on slow machines — poll this until the expected data is stored
 * before any reload that must observe it.
 */
export async function readStoredProjects(page: Page): Promise<unknown[]> {
  return page.evaluate(async () => {
    const open = indexedDB.open('kairo')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      open.onsuccess = () => {
        resolve(open.result)
      }
      open.onerror = () => {
        reject(new Error('Could not open the database.'))
      }
    })
    try {
      const tx = db.transaction('projects')
      const all = tx.objectStore('projects').getAll()
      return await new Promise<unknown[]>((resolve) => {
        all.onsuccess = () => {
          resolve(all.result as unknown[])
        }
      })
    } finally {
      db.close()
    }
  })
}

/** Onboard with a mocked key (mockBalance must be routed first). */
export async function setUpApiKey(page: Page, key = 'e2e-key'): Promise<void> {
  await page.getByRole('button', { name: 'Set up your key' }).click()
  await page.getByLabel('NanoGPT API key').fill(key)
  await page.getByRole('button', { name: 'Validate & save' }).click()
  await page.getByRole('button', { name: 'Close settings' }).click()
}

export async function createAndOpenProject(
  page: Page,
  title: string,
): Promise<void> {
  await page.getByLabel('New project title').fill(title)
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByRole('button', { name: new RegExp(title) }).click()
}

/** Mock the TTS endpoint with tiny fake audio bytes (never spends money). */
export async function mockTts(page: Page): Promise<void> {
  await page.route(`${API}/v1/audio/speech`, (route) =>
    route.fulfill({
      contentType: 'audio/mpeg',
      body: Buffer.from('fake-mp3-bytes'),
    }),
  )
}
