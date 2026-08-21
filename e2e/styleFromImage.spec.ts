import { expect, test } from '@playwright/test'
import {
  createAndOpenProject,
  mockBalance,
  mockImageModels,
  mockTextModels,
  readStoredProjects,
  setUpApiKey,
  TINY_PNG_B64,
} from './helpers'

const API = 'https://nano-gpt.com/api'

const STYLE_NOTES =
  'muted teal and amber palette, soft dawn light, watercolor on rough paper, wide low-angle composition'

test.beforeEach(async ({ page }) => {
  await mockBalance(page)
  await mockTextModels(page)
  await mockImageModels(page)

  await page.goto('/')
  await setUpApiKey(page)
  await createAndOpenProject(page, 'Style test')
  await page.getByLabel('Script text').fill('A short tale.')
  await page.getByRole('button', { name: 'Lock script' }).click()
  await page.getByRole('button', { name: '2. Scenes' }).click()
  await page.getByText('Describe a style from an image').click()
})

test('style-from-image: vision-filtered picker, multimodal request, apply to notes', async ({
  page,
}) => {
  // The picker only offers vision-capable models.
  const picker = page.getByLabel('Vision model', { exact: true })
  await expect(picker).toBeVisible()
  const optionIds = await picker
    .locator('option:not([disabled])')
    .allTextContents()
  expect(optionIds.join(' ')).toContain('Mock Seer')
  expect(optionIds.join(' ')).not.toContain('Mock Writer')

  await page.getByLabel('Style reference image file').setInputFiles({
    name: 'style-ref.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_B64, 'base64'),
  })
  await expect(page.getByText('style-ref.png')).toBeVisible()
  await picker.selectOption('mock/seer-1')
  await expect(page.getByText(/Estimated cost: up to ~/)).toBeVisible()
  await expect(page.getByText(/plus the image input/)).toBeVisible()

  let body: {
    messages?: { content?: unknown }[]
    max_tokens?: number
  } = {}
  await page.route(`${API}/v1/chat/completions`, (route) => {
    body = route.request().postDataJSON() as typeof body
    return route.fulfill({
      json: {
        model: 'mock/seer-1',
        choices: [{ message: { role: 'assistant', content: STYLE_NOTES } }],
        usage: { prompt_tokens: 900, completion_tokens: 40 },
      },
    })
  })
  await page.getByRole('button', { name: 'Describe style' }).click()

  // Proposal appears; the request carried the image as a data URL part.
  const proposal = page.getByLabel('Proposed style notes')
  await expect(proposal).toHaveValue(STYLE_NOTES)
  const parts = body.messages?.[1]?.content as {
    type: string
    image_url?: { url: string }
  }[]
  expect(parts[1]?.type).toBe('image_url')
  expect(parts[1]?.image_url?.url).toMatch(/^data:image\/png;base64,/)
  expect(body.max_tokens).toBe(150)

  // Apply — style notes field takes the proposal (empty before, no confirm).
  await page.getByRole('button', { name: 'Use as style notes' }).click()
  await expect(page.getByLabel('Visual style notes')).toHaveValue(STYLE_NOTES)

  // Persisted (poll the stored value before reloading — LESSONS rule).
  await expect
    .poll(async () => {
      const [stored] = (await readStoredProjects(page)) as {
        styleNotes: string
      }[]
      return stored?.styleNotes
    })
    .toBe(STYLE_NOTES)
  await page.reload()
  await page.getByRole('button', { name: /Style test/ }).click()
  await page.getByRole('button', { name: '2. Scenes' }).click()
  await expect(page.getByLabel('Visual style notes')).toHaveValue(STYLE_NOTES)

  // Spend log recorded the vision call.
  await expect(page.getByLabel('Project spend')).toContainText('1 generation')
})

test('replacing existing style notes asks for confirmation first', async ({
  page,
}) => {
  await page.getByLabel('Visual style notes').fill('hand-written notes')
  await page.getByLabel('Style reference image file').setInputFiles({
    name: 'style-ref.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_B64, 'base64'),
  })
  await page
    .getByLabel('Vision model', { exact: true })
    .selectOption('mock/seer-1')
  await page.route(`${API}/v1/chat/completions`, (route) =>
    route.fulfill({
      json: {
        model: 'mock/seer-1',
        choices: [{ message: { role: 'assistant', content: STYLE_NOTES } }],
      },
    }),
  )
  await page.getByRole('button', { name: 'Describe style' }).click()
  await expect(page.getByLabel('Proposed style notes')).toHaveValue(STYLE_NOTES)

  await page.getByRole('button', { name: 'Use as style notes' }).click()
  // Cancel keeps the old notes.
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(page.getByLabel('Visual style notes')).toHaveValue(
    'hand-written notes',
  )
  // Confirm replaces them.
  await page.getByRole('button', { name: 'Use as style notes' }).click()
  await page.getByRole('button', { name: 'Replace notes' }).click()
  await expect(page.getByLabel('Visual style notes')).toHaveValue(STYLE_NOTES)
})
