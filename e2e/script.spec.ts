import { expect, test } from '@playwright/test'

const API = 'https://nano-gpt.com/api'

test.beforeEach(async ({ page }) => {
  // Every NanoGPT endpoint is mocked — e2e never spends real money.
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
            description: 'test model',
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
              content: 'Generated narration about space.',
            },
          },
        ],
        usage: { prompt_tokens: 117, completion_tokens: 192 },
      },
    }),
  )

  // Set up a key and a project.
  await page.goto('/')
  await page.getByRole('button', { name: 'Set up your key' }).click()
  await page.getByLabel('NanoGPT API key').fill('e2e-key-0001')
  await page.getByRole('button', { name: 'Validate & save' }).click()
  await page.getByRole('button', { name: 'Back to projects' }).click()
  await page.getByLabel('New project title').fill('Script test')
  await page.getByRole('button', { name: 'Create project' }).click()
  await page.getByRole('button', { name: /Script test/ }).click()
  await expect(
    page.getByRole('navigation', { name: 'Pipeline stages' }),
  ).toBeVisible()
})

test('script edits autosave and survive a reload', async ({ page }) => {
  await page.getByLabel('Script text').fill('My handwritten script.')
  // Blur flushes the autosave immediately.
  await page.getByLabel('Script text').blur()
  await page.reload()
  await page.getByRole('button', { name: /Script test/ }).click()
  await expect(page.getByLabel('Script text')).toHaveValue(
    'My handwritten script.',
  )
})

test('generation shows an upfront estimate, fills the editor, and locks', async ({
  page,
}) => {
  await page
    .getByLabel('Generation instructions')
    .fill('The James Webb telescope')
  await page.getByLabel('Filter models').fill('Mock')
  await page.getByLabel('Text model').selectOption('mock/writer-1')
  await expect(page.getByLabel('Estimated cost')).toContainText(
    'Estimated cost: up to ~$',
  )

  await page.getByRole('button', { name: 'Generate script' }).click()
  await expect(page.getByLabel('Script text')).toHaveValue(
    'Generated narration about space.',
  )

  // Regenerating over existing text requires confirmation.
  await page.getByRole('button', { name: 'Generate script' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Replace and generate' }).click()
  await expect(page.getByLabel('Script text')).toHaveValue(
    'Generated narration about space.',
  )

  // Lock: editor disabled, generation panel hidden, unlock requires confirm.
  await page.getByRole('button', { name: 'Lock script' }).click()
  await expect(page.getByLabel('Script text')).toBeDisabled()
  await expect(page.getByText('Generate with AI')).not.toBeVisible()
  await page.getByRole('button', { name: 'Unlock script' }).click()
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(page.getByLabel('Script text')).toBeEnabled()
})
