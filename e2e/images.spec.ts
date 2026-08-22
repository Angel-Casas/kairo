import { expect, test } from '@playwright/test'
import {
  createAndOpenProject,
  mockBalance,
  mockChatCompletion,
  mockImageGeneration,
  mockImageModels,
  mockTextModels,
  readStoredProjects,
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
  await page.getByRole('button', { name: 'Scenes', exact: true }).click()
  await page
    .getByLabel('Text model', { exact: true })
    .selectOption('mock/writer-1')
  await page.getByRole('button', { name: 'Generate scenes' }).click()
  await expect(page.getByRole('listitem', { name: 'Scene 2' })).toBeVisible()
  await page.getByRole('button', { name: 'Images', exact: true }).click()
})

test('style gallery selects and persists a preset', async ({ page }) => {
  // The gallery is a collapsed bar now — open it first.
  await page.getByText('Artistic style', { exact: true }).click()
  await page.getByRole('radio', { name: 'Style: Watercolor' }).click()
  await expect(
    page.getByRole('radio', { name: 'Style: Watercolor' }),
  ).toHaveAttribute('aria-checked', 'true')
  // The UI updates before the IndexedDB write commits — wait for the stored
  // value so the reload below cannot race the persist.
  await expect
    .poll(async () => {
      const [stored] = (await readStoredProjects(page)) as {
        stylePresetId: string | null
      }[]
      return stored?.stylePresetId ?? null
    })
    .toBe('watercolor')
  await page.reload()
  await page.getByRole('button', { name: /Images test/ }).click()
  await page.getByRole('button', { name: 'Images', exact: true }).click()
  // The collapsed bar itself reports the choice; open it to check the radio.
  await expect(page.getByText('— Watercolor')).toBeVisible()
  await page.getByText('Artistic style', { exact: true }).click()
  await expect(
    page.getByRole('radio', { name: 'Style: Watercolor' }),
  ).toHaveAttribute('aria-checked', 'true')
})

test('generate → version appears → regenerate → switch active → reload', async ({
  page,
}) => {
  await page.getByText('Artistic style', { exact: true }).click()
  await page.getByRole('radio', { name: 'Style: Watercolor' }).click()
  await page.getByText('Artistic style', { exact: true }).click()
  await page
    .getByLabel('Image model', { exact: true })
    .selectOption('mock/painter-1')

  // Exact per-image cost shown.
  await expect(page.getByText('Total cost: $0.02').first()).toBeVisible()

  // Generate for scene 1 only.
  const scene1 = page.getByLabel('Scene 1 workbench')
  await scene1.getByRole('button', { name: 'Generate image' }).click()
  await expect(page.getByAltText('Scene 1 active image')).toBeVisible()

  // Regenerate → two versions.
  await scene1.getByRole('button', { name: 'Regenerate', exact: true }).click()
  await expect(
    scene1.getByRole('button', { name: 'Scene 1 version 2' }),
  ).toBeVisible()

  // Switch active back to version 1.
  await scene1.getByRole('button', { name: 'Scene 1 version 1' }).click()
  await expect(
    scene1.getByRole('button', { name: 'Scene 1 version 1' }),
  ).toHaveAttribute('aria-pressed', 'true')

  // Generate-all fills only the remaining scene (visible on its frame).
  await page.getByRole('button', { name: 'Generate 1 missing image' }).click()
  await expect(page.getByAltText('Scene 2 active image')).toBeVisible()

  // Cost log recorded all three image generations + the breakdown.
  await expect(page.getByLabel('Project spend')).toContainText('4 generations')

  // Everything survives a reload (images restored from OPFS).
  await page.reload()
  await page.getByRole('button', { name: /Images test/ }).click()
  await page.getByRole('button', { name: 'Images', exact: true }).click()
  await expect(page.getByAltText('Scene 1 active image')).toBeVisible()
  await expect(
    page
      .getByLabel('Scene 1 workbench')
      .getByRole('button', { name: 'Scene 1 version 1' }),
  ).toHaveAttribute('aria-pressed', 'true')
})

test('a frame expands into a lightbox and closes on an outside click', async ({
  page,
}) => {
  await page
    .getByLabel('Image model', { exact: true })
    .selectOption('mock/painter-1')
  await page
    .getByLabel('Scene 1 workbench')
    .getByRole('button', { name: 'Generate image' })
    .click()
  await expect(page.getByAltText('Scene 1 active image')).toBeVisible()
  await page.getByRole('button', { name: 'Generate 1 missing image' }).click()
  await expect(page.getByAltText('Scene 2 active image')).toBeVisible()

  // Double-clicking the frame opens the viewer.
  await page.getByAltText('Scene 1 active image').dblclick()
  const viewer = page.getByRole('dialog', { name: 'Scene 1 image — enlarged' })
  await expect(viewer).toBeVisible()
  // The prompt and script excerpt ride on the image.
  await expect(
    viewer.getByText('A lighthouse on a rocky cliff at sunset'),
  ).toBeVisible()
  await expect(
    viewer.getByText('“A lighthouse stands on the cliff.”'),
  ).toBeVisible()

  // Side buttons and arrow keys walk between the scenes' images.
  await page.getByRole('button', { name: 'Next scene' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Scene 2 image — enlarged' }),
  ).toBeVisible()
  await page.keyboard.press('ArrowLeft')
  await expect(viewer).toBeVisible()

  // Clicking outside the image returns to the page.
  await viewer.click({ position: { x: 12, y: 12 } })
  await expect(viewer).not.toBeVisible()

  // The hover expand button opens it too; Escape also closes.
  await page.getByRole('button', { name: 'View scene 1 image large' }).click()
  await expect(viewer).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(viewer).not.toBeVisible()
})
