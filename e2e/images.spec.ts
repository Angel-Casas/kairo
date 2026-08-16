import { expect, test } from '@playwright/test'

const API = 'https://nano-gpt.com/api'

// 1x1 red pixel PNG.
const TINY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const BREAKDOWN = [
  {
    textExcerpt: 'A lighthouse stands on the cliff.',
    visualDescription: 'A lighthouse on a rocky cliff at sunset',
  },
  {
    textExcerpt: 'Waves crash below.',
    visualDescription: 'Huge waves crashing on dark rocks',
  },
]

test.beforeEach(async ({ page }) => {
  // All NanoGPT calls mocked — no real spend.
  await page.route(`${API}/check-balance`, (route) =>
    route.fulfill({ json: { usd_balance: '25.00' } }),
  )
  await page.route(`${API}/v1/models?detailed=true`, (route) =>
    route.fulfill({
      json: {
        object: 'list',
        data: [
          {
            id: 'mock/writer-1',
            name: 'Mock Writer',
            pricing: { prompt: 2, completion: 10 },
          },
        ],
      },
    }),
  )
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
        ],
        meta: { count: 1, generated_at: '2026-08-16T00:00:00Z' },
      },
    }),
  )
  await page.route(`${API}/v1/chat/completions`, (route) =>
    route.fulfill({
      json: {
        model: 'mock/writer-1',
        choices: [
          {
            message: {
              role: 'assistant',
              content: JSON.stringify(BREAKDOWN),
            },
          },
        ],
        usage: { prompt_tokens: 100, completion_tokens: 100 },
      },
    }),
  )
  await page.route(`${API}/v1/images`, (route) =>
    route.fulfill({ json: { data: [{ b64_json: TINY_PNG_B64 }] } }),
  )

  // Key + project + locked script + scenes.
  await page.goto('/')
  await page.getByRole('button', { name: 'Set up your key' }).click()
  await page.getByLabel('NanoGPT API key').fill('e2e-key-0003')
  await page.getByRole('button', { name: 'Validate & save' }).click()
  await page.getByRole('button', { name: 'Back to projects' }).click()
  await page.getByLabel('New project title').fill('Images test')
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByRole('button', { name: /Images test/ }).click()
  await page
    .getByLabel('Script text')
    .fill('A lighthouse stands on the cliff. Waves crash below.')
  await page.getByRole('button', { name: 'Lock script' }).click()
  await page.getByRole('button', { name: '2. Scenes' }).click()
  await page
    .getByLabel('Text model', { exact: true })
    .selectOption('mock/writer-1')
  await page.getByRole('button', { name: 'Generate scenes' }).click()
  await expect(page.getByRole('listitem', { name: 'Scene 2' })).toBeVisible()
  await page.getByRole('button', { name: '3. Images' }).click()
})

test('style gallery selects and persists a preset', async ({ page }) => {
  await page.getByRole('radio', { name: 'Style: Watercolor' }).click()
  await expect(
    page.getByRole('radio', { name: 'Style: Watercolor' }),
  ).toHaveAttribute('aria-checked', 'true')
  await page.reload()
  await page.getByRole('button', { name: /Images test/ }).click()
  await page.getByRole('button', { name: '3. Images' }).click()
  await expect(
    page.getByRole('radio', { name: 'Style: Watercolor' }),
  ).toHaveAttribute('aria-checked', 'true')
})

test('generate → version appears → regenerate → switch active → reload', async ({
  page,
}) => {
  await page.getByRole('radio', { name: 'Style: Watercolor' }).click()
  await page
    .getByLabel('Image model', { exact: true })
    .selectOption('mock/painter-1')

  // Exact per-image cost shown.
  await expect(page.getByText('Total cost: $0.02').first()).toBeVisible()

  // Generate for scene 1 only.
  const scene1 = page.getByRole('listitem', { name: 'Scene 1 images' })
  await scene1.getByRole('button', { name: 'Generate image' }).click()
  await expect(scene1.getByAltText('Scene 1 active image')).toBeVisible()

  // Regenerate → two versions.
  await scene1.getByRole('button', { name: 'Regenerate' }).click()
  await expect(
    scene1.getByRole('button', { name: 'Scene 1 version 2' }),
  ).toBeVisible()

  // Switch active back to version 1.
  await scene1.getByRole('button', { name: 'Scene 1 version 1' }).click()
  await expect(
    scene1.getByRole('button', { name: 'Scene 1 version 1' }),
  ).toHaveAttribute('aria-pressed', 'true')

  // Generate-all fills only the remaining scene.
  await page.getByRole('button', { name: 'Generate 1 missing image' }).click()
  const scene2 = page.getByRole('listitem', { name: 'Scene 2 images' })
  await expect(scene2.getByAltText('Scene 2 active image')).toBeVisible()

  // Cost log recorded all three image generations + the breakdown.
  await expect(page.getByLabel('Project spend')).toContainText('4 generations')

  // Everything survives a reload (images restored from OPFS).
  await page.reload()
  await page.getByRole('button', { name: /Images test/ }).click()
  await page.getByRole('button', { name: '3. Images' }).click()
  await expect(
    page
      .getByRole('listitem', { name: 'Scene 1 images' })
      .getByAltText('Scene 1 active image'),
  ).toBeVisible()
  await expect(
    page
      .getByRole('listitem', { name: 'Scene 1 images' })
      .getByRole('button', { name: 'Scene 1 version 1' }),
  ).toHaveAttribute('aria-pressed', 'true')
})
