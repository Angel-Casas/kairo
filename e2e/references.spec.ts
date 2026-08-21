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
  TINY_PNG_B64,
} from './helpers'

const API = 'https://nano-gpt.com/api'

const BREAKDOWN = [
  {
    textExcerpt: 'Mara climbs the lighthouse stairs.',
    visualDescription: 'A woman climbing spiral lighthouse stairs',
  },
  {
    textExcerpt: 'Waves crash below.',
    visualDescription: 'Huge waves crashing on dark rocks',
  },
]

const DESCRIPTOR =
  'a tall woman with cropped silver hair and a navy captain coat'

test.beforeEach(async ({ page }) => {
  await mockBalance(page)
  await mockTextModels(page)
  await mockImageModels(page)
  await mockChatCompletion(page, JSON.stringify(BREAKDOWN))
  await mockImageGeneration(page)

  await page.goto('/')
  await setUpApiKey(page)
  await createAndOpenProject(page, 'References test')
  await page
    .getByLabel('Script text')
    .fill('Mara climbs the lighthouse stairs. Waves crash below.')
  await page.getByRole('button', { name: 'Lock script' }).click()
  await page.getByRole('button', { name: '2. Scenes' }).click()
  await page
    .getByLabel('Text model', { exact: true })
    .selectOption('mock/writer-1')
  await page.getByRole('button', { name: 'Generate scenes' }).click()
  await expect(page.getByRole('listitem', { name: 'Scene 2' })).toBeVisible()
})

async function addCharacterMara(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: 'Add character' }).click()
  await page.getByLabel('Reference Unnamed character name').fill('Mara')
  await page.getByLabel('Reference Mara description').fill(DESCRIPTOR)
  // Flush the debounced autosave.
  await page.getByLabel('Reference Mara description').blur()
}

test('create a reference, tick a scene, generate its image, survive reload', async ({
  page,
}) => {
  await addCharacterMara(page)

  // Tick the reference on scene 1 only.
  await page.getByLabel('Scene 1 uses Mara').check()

  // Generate the reference image from the descriptor (mocked, $0.01).
  await page.getByText('Image model for generating reference images').click()
  await page
    .getByLabel('Image model', { exact: true })
    .selectOption('mock/painter-i2i')
  await expect(page.getByText('Cost: $0.02; importing is free.')).toBeVisible()
  await page.getByRole('button', { name: 'Generate from description' }).click()
  await expect(page.getByAltText('Reference image for Mara')).toBeVisible()

  // Wait for the persisted state (UI updates before the write commits).
  await expect
    .poll(async () => {
      const [stored] = (await readStoredProjects(page)) as {
        references: { name: string; imageVersions: unknown[] }[]
        scenes: { referenceIds: string[] }[]
      }[]
      return (
        stored?.references[0]?.name === 'Mara' &&
        stored.references[0].imageVersions.length === 1 &&
        stored.scenes[0]?.referenceIds.length === 1
      )
    })
    .toBe(true)

  // Everything survives a reload.
  await page.reload()
  await page.getByRole('button', { name: /References test/ }).click()
  await page.getByRole('button', { name: '2. Scenes' }).click()
  await expect(page.getByLabel('Reference Mara name')).toHaveValue('Mara')
  await expect(page.getByLabel('Scene 1 uses Mara')).toBeChecked()
  await expect(page.getByLabel('Scene 2 uses Mara')).not.toBeChecked()
  await expect(page.getByAltText('Reference image for Mara')).toBeVisible()
})

test('scene generation attaches the reference image for i2i models and says so', async ({
  page,
}) => {
  await addCharacterMara(page)
  await page.getByLabel('Scene 1 uses Mara').check()

  // Import a reference image (free, no generation call).
  await page.getByLabel('Import an image for Mara').setInputFiles({
    name: 'mara.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_B64, 'base64'),
  })
  await expect(page.getByAltText('Reference image for Mara')).toBeVisible()

  await page.getByRole('button', { name: '3. Images' }).click()

  // A model without image-to-image is honest about skipping the image.
  await page
    .getByLabel('Image model', { exact: true })
    .selectOption('mock/painter-1')
  const scene1 = page.getByRole('listitem', { name: 'Scene 1 images' })
  await expect(
    scene1.getByText(
      'This model cannot use reference images — descriptions still apply, but the images will be skipped.',
    ),
  ).toBeVisible()

  // The i2i filter narrows the picker, and the capable model announces the attachment.
  await page
    .getByLabel('Only show models that can use reference images')
    .check()
  await page
    .getByLabel('Image model', { exact: true })
    .selectOption('mock/painter-i2i')
  await expect(
    scene1.getByText(
      'One reference image will be attached to this generation.',
    ),
  ).toBeVisible()
  const scene2 = page.getByRole('listitem', { name: 'Scene 2 images' })
  await expect(scene2.getByText('reference image')).toHaveCount(0)

  // Capture the actual request: it must carry input_references + the
  // descriptor verbatim in the prompt.
  let requestBody: Record<string, unknown> = {}
  await page.route(`${API}/v1/images`, (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({ json: { data: [{ b64_json: TINY_PNG_B64 }] } })
  })
  await scene1.getByRole('button', { name: 'Generate image' }).click()
  await expect(scene1.getByAltText('Scene 1 active image')).toBeVisible()

  expect(requestBody.prompt).toContain(DESCRIPTOR)
  const references = requestBody.input_references as string[]
  expect(references).toHaveLength(1)
  expect(references[0]).toMatch(/^data:image\/png;base64,/)
})
