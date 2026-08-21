import { expect, test } from '@playwright/test'
import {
  createAndOpenProject,
  mockBalance,
  mockChatCompletion,
  mockImageGeneration,
  mockImageModels,
  mockTextModels,
  setUpApiKey,
  TINY_PNG_B64,
} from './helpers'

const API = 'https://nano-gpt.com/api'

const BREAKDOWN = [
  {
    textExcerpt: 'A lighthouse stands on the cliff.',
    visualDescription: 'A lighthouse on a rocky cliff at sunset',
  },
]

test.beforeEach(async ({ page }) => {
  await mockBalance(page)
  await mockTextModels(page)
  await mockImageModels(page)
  await mockChatCompletion(page, JSON.stringify(BREAKDOWN))
  await mockImageGeneration(page)

  await page.goto('/')
  await setUpApiKey(page)
  await createAndOpenProject(page, 'History test')
  await page.getByLabel('Script text').fill('A lighthouse stands on the cliff.')
  await page.getByRole('button', { name: 'Lock script' }).click()
  await page.getByRole('button', { name: '2. Scenes' }).click()
  await page
    .getByLabel('Text model', { exact: true })
    .selectOption('mock/writer-1')
  await page.getByRole('button', { name: 'Generate scenes' }).click()
  await expect(page.getByRole('listitem', { name: 'Scene 1' })).toBeVisible()
  await page.getByRole('button', { name: '3. Images' }).click()
  await page
    .getByLabel('Image model', { exact: true })
    .selectOption('mock/painter-1')
})

test('history shows the exact prompt; edit & regenerate sends it verbatim', async ({
  page,
}) => {
  const scene1 = page.getByRole('listitem', { name: 'Scene 1 images' })
  await scene1.getByRole('button', { name: 'Generate image' }).click()
  await expect(scene1.getByAltText('Scene 1 active image')).toBeVisible()

  // Open the history: the stored prompt is fully visible.
  await scene1.getByLabel('Scene 1 image history').click()
  const promptText = await scene1
    .getByLabel('Scene 1 image version 1 prompt', { exact: true })
    .innerText()
  expect(promptText).toContain('A lighthouse on a rocky cliff at sunset')
  expect(promptText).toContain('vertical 9:16 composition')

  // Edit & regenerate: prefilled with the exact prompt, sent verbatim.
  await scene1
    .getByRole('button', {
      name: 'Edit and regenerate from Scene 1 image version 1',
    })
    .click()
  const editor = scene1.getByLabel('Scene 1 image version 1 edited prompt')
  await expect(editor).toHaveValue(promptText)
  await editor.fill('a hand-tuned lighthouse prompt, nothing else')

  let requestBody: Record<string, unknown> = {}
  await page.route(`${API}/v1/images`, (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({ json: { data: [{ b64_json: TINY_PNG_B64 }] } })
  })
  await scene1
    .getByRole('button', { name: 'Generate with this prompt' })
    .click()
  await expect(
    scene1.getByRole('button', { name: 'Scene 1 version 2' }),
  ).toBeVisible()
  expect(requestBody.prompt).toBe(
    'a hand-tuned lighthouse prompt, nothing else',
  )

  // The new version appears in the history, newest first, marked active.
  const rows = scene1.getByLabel(/Scene 1 image version \d details/)
  await expect(rows).toHaveCount(2)
  await expect(rows.first()).toContainText('Version 2')
  await expect(rows.first()).toContainText(
    'a hand-tuned lighthouse prompt, nothing else',
  )
  await expect(rows.first()).toContainText('active')
})

test('copy prompt puts the stored prompt on the clipboard', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  const scene1 = page.getByRole('listitem', { name: 'Scene 1 images' })
  await scene1.getByRole('button', { name: 'Generate image' }).click()
  await expect(scene1.getByAltText('Scene 1 active image')).toBeVisible()

  await scene1.getByLabel('Scene 1 image history').click()
  await scene1
    .getByRole('button', { name: 'Copy Scene 1 image version 1 prompt' })
    .click()
  await expect(
    scene1.getByRole('button', { name: 'Copy Scene 1 image version 1 prompt' }),
  ).toHaveText('Copied')
  const clipboard = await page.evaluate(() => navigator.clipboard.readText())
  expect(clipboard).toContain('A lighthouse on a rocky cliff at sunset')
})
