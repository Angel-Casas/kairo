import { expect, test } from '@playwright/test'
import {
  createAndOpenProject,
  mockBalance,
  mockChatCompletion,
  mockImageGeneration,
  mockImageModels,
  mockTextModels,
  setUpApiKey,
} from './helpers'

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
  await mockBalance(page)
  await mockTextModels(page)
  await mockImageModels(page)
  await mockChatCompletion(page, JSON.stringify(BREAKDOWN))
  await mockImageGeneration(page)

  // Key + project + locked script + scenes.
  await page.goto('/')
  await setUpApiKey(page)
  await createAndOpenProject(page, 'Images test')
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
