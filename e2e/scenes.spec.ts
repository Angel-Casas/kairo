import { expect, test } from '@playwright/test'

const API = 'https://nano-gpt.com/api'

const BREAKDOWN = [
  {
    textExcerpt: 'The James Webb telescope sees the universe in infrared.',
    visualDescription: 'A golden hexagonal telescope floating in dark space',
  },
  {
    textExcerpt: 'It catches light older than Earth itself.',
    visualDescription: 'Ancient starlight streaking toward a mirror array',
  },
  {
    textExcerpt: 'And it rewrites what we know.',
    visualDescription: 'A scientist gazing at a wall of galaxy images',
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
  await page.route(`${API}/v1/chat/completions`, (route) =>
    route.fulfill({
      json: {
        model: 'mock/writer-1',
        choices: [
          {
            message: {
              role: 'assistant',
              content: '```json\n' + JSON.stringify(BREAKDOWN) + '\n```',
            },
          },
        ],
        usage: { prompt_tokens: 210, completion_tokens: 160 },
      },
    }),
  )

  // Key + project + locked script.
  await page.goto('/')
  await page.getByRole('button', { name: 'Set up your key' }).click()
  await page.getByLabel('NanoGPT API key').fill('e2e-key-0002')
  await page.getByRole('button', { name: 'Validate & save' }).click()
  await page.getByRole('button', { name: 'Back to projects' }).click()
  await page.getByLabel('New project title').fill('Scenes test')
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByRole('button', { name: /Scenes test/ }).click()
  await page
    .getByLabel('Script text')
    .fill('The James Webb telescope sees the universe in infrared.')
  await page.getByLabel('Script text').blur()
})

test('scenes stage is gated on a locked script', async ({ page }) => {
  await expect(page.getByRole('button', { name: '2. Scenes' })).toBeDisabled()
  await page.getByRole('button', { name: 'Lock script' }).click()
  await expect(page.getByRole('button', { name: '2. Scenes' })).toBeEnabled()
})

test('AI breakdown → edit → reorder → survives reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock script' }).click()
  await page.getByRole('button', { name: '2. Scenes' }).click()

  // Generate with upfront estimate.
  await page.getByLabel('Text model').selectOption('mock/writer-1')
  await expect(page.getByLabel('Estimated cost')).toContainText('up to ~$')
  await page.getByRole('button', { name: 'Generate scenes' }).click()
  await expect(page.getByRole('listitem', { name: 'Scene 1' })).toBeVisible()
  await expect(page.getByRole('listitem', { name: 'Scene 3' })).toBeVisible()
  await expect(page.getByLabel('Scene 1 visual description')).toHaveValue(
    'A golden hexagonal telescope floating in dark space',
  )

  // Edit a visual description.
  await page
    .getByLabel('Scene 1 visual description')
    .fill('A silver telescope drifting past Jupiter')
  await page.getByLabel('Scene 1 visual description').blur()

  // Style notes.
  await page.getByLabel('Visual style notes').fill('watercolor, warm tones')
  await page.getByLabel('Visual style notes').blur()

  // Reorder: move scene 2 up.
  await page.getByLabel('Move scene 2 up').click()
  await expect(page.getByLabel('Scene 1 script excerpt')).toHaveValue(
    'It catches light older than Earth itself.',
  )

  // Spend summary counts the breakdown generation.
  await expect(page.getByLabel('Project spend')).toContainText('1 generation')

  // Everything survives a reload.
  await page.reload()
  await page.getByRole('button', { name: /Scenes test/ }).click()
  await page.getByRole('button', { name: '2. Scenes' }).click()
  await expect(page.getByLabel('Scene 1 script excerpt')).toHaveValue(
    'It catches light older than Earth itself.',
  )
  await expect(page.getByLabel('Scene 2 visual description')).toHaveValue(
    'A silver telescope drifting past Jupiter',
  )
  await expect(page.getByLabel('Visual style notes')).toHaveValue(
    'watercolor, warm tones',
  )

  // Delete a scene.
  await page.getByLabel('Delete scene 3').click()
  await expect(
    page.getByRole('listitem', { name: 'Scene 3' }),
  ).not.toBeVisible()

  // Regenerating over existing scenes requires confirmation.
  await page.getByLabel('Text model').selectOption('mock/writer-1')
  await page.getByRole('button', { name: 'Generate scenes' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Replace and generate' }).click()
  await expect(page.getByLabel('Scene 1 script excerpt')).toHaveValue(
    'The James Webb telescope sees the universe in infrared.',
  )
})
