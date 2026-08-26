import { expect, test } from '@playwright/test'
import {
  createAndOpenProject,
  expectSpendBreakdown,
  mockBalance,
  mockChatCompletion,
  mockImageGeneration,
  mockImageModels,
  mockTextModels,
  pickModel,
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
  await pickModel(page, 'Text model', 'mock/writer-1')
  await page.getByRole('button', { name: 'Generate scenes' }).click()
  await expect(page.getByRole('listitem', { name: 'Scene 2' })).toBeVisible()
  await page.getByRole('button', { name: 'Images', exact: true }).click()
})

test('save a scene image as a new reference and toggle references in place', async ({
  page,
}) => {
  // Generate scene 1's image, then save it as a new reference.
  await pickModel(page, 'Image model', 'mock/painter-1')
  const scene1 = page.getByLabel('Scene 1 workbench')
  await scene1.getByRole('button', { name: 'Generate image' }).click()
  await expect(page.getByAltText('Scene 1 active image')).toBeVisible()

  await page
    .getByLabel('New reference name for scene 1')
    .fill('Keeper in exile')
  await page.getByLabel('Save scene 1 image as reference').click()

  // The new reference arrives ticked on this scene, as a toggle chip.
  const chip = page.getByRole('button', {
    name: 'Scene 1 uses Keeper in exile',
  })
  await expect(chip).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Saved and ticked for this scene')).toBeVisible()

  // "Describe it now" jumps to the Scenes stage with the new card
  // spotlighted (22.14) — one click from save to description.
  await page.getByRole('button', { name: 'Describe the new reference' }).click()
  await expect(page.getByLabel('Reference Keeper in exile name')).toHaveValue(
    'Keeper in exile',
  )
  await expect(
    page.getByAltText('Reference image for Keeper in exile'),
  ).toBeVisible()
  await expect(page.getByLabel('Scene 1 uses Keeper in exile')).toBeChecked()

  // Back on Images, unticking happens IN PLACE — no trip to Scenes needed.
  await page.getByRole('button', { name: 'Images', exact: true }).click()
  await page
    .getByRole('button', { name: 'Scene 1 uses Keeper in exile' })
    .click()
  await expect(
    page.getByRole('button', { name: 'Scene 1 uses Keeper in exile' }),
  ).toHaveAttribute('aria-pressed', 'false')

  // The untick persisted.
  await expect
    .poll(async () => {
      const [stored] = (await readStoredProjects(page)) as {
        references: { name: string }[]
        scenes: { referenceIds: string[] }[]
      }[]
      return (
        stored?.references.length === 1 &&
        stored.scenes[0]?.referenceIds.length === 0
      )
    })
    .toBe(true)
})

test('the model choice survives leaving and returning to the stage', async ({
  page,
}) => {
  // Pick the image model, wander off to Audio, come back (22.12 — model
  // selections used to die with the stage's unmount).
  await pickModel(page, 'Image model', 'mock/painter-1')
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await page.getByRole('button', { name: 'Images', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Image model', exact: true }),
  ).toContainText('Mock Painter')

  // It survives a full reload too (localStorage-backed).
  await page.reload()
  await page.getByRole('button', { name: /Images test/ }).click()
  await page.getByRole('button', { name: 'Images', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Image model', exact: true }),
  ).toContainText('Mock Painter')

  // The Scenes stage's text model pick is remembered independently.
  await page.getByRole('button', { name: 'Scenes', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'Text model', exact: true }),
  ).toContainText('Mock Writer')
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
  await pickModel(page, 'Image model', 'mock/painter-1')

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
  await expectSpendBreakdown(page, '4 generations')

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

test('the scene prompt edits in place and every stage sees it', async ({
  page,
}) => {
  // Edit on the Images stage — the editor is always live (22.1)…
  const workbench = page.getByLabel('Scene 1 workbench')
  await workbench
    .getByLabel('Scene 1 prompt editor')
    .fill('A silver telescope drifting past Jupiter')

  // …and Scenes sees the same text (single source of truth).
  await page.getByRole('button', { name: 'Scenes', exact: true }).click()
  await expect(page.getByLabel('Scene 1 visual description')).toHaveValue(
    'A silver telescope drifting past Jupiter',
  )

  // Back on Images, the editor still holds the shared text.
  await page.getByRole('button', { name: 'Images', exact: true }).click()
  await expect(workbench.getByLabel('Scene 1 prompt editor')).toHaveValue(
    'A silver telescope drifting past Jupiter',
  )
})

test('a frame expands into a lightbox and closes on an outside click', async ({
  page,
}) => {
  await pickModel(page, 'Image model', 'mock/painter-1')
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
