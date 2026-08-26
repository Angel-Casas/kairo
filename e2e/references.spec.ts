import { expect, test } from '@playwright/test'
import {
  createAndOpenProject,
  mockBalance,
  mockChatCompletion,
  mockImageGeneration,
  mockImageModels,
  mockTextModels,
  pickModel,
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
  await page.getByRole('button', { name: 'Scenes', exact: true }).click()
  await pickModel(page, 'Text model', 'mock/writer-1')
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

  // Generate the reference image from the descriptor (mocked, $0.02).
  // The toggle defaults to image-from-description; one dropdown (22.7).
  await pickModel(page, 'Model for Mara', 'mock/painter-i2i')
  await expect(page.getByText('Cost: $0.02; importing is free.')).toBeVisible()
  await page.getByRole('button', { name: 'Generate for Mara' }).click()
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
  await page.getByRole('button', { name: 'Scenes', exact: true }).click()
  await expect(page.getByLabel('Reference Mara name')).toHaveValue('Mara')
  await expect(page.getByLabel('Scene 1 uses Mara')).toBeChecked()
  await expect(page.getByLabel('Scene 2 uses Mara')).not.toBeChecked()
  await expect(page.getByAltText('Reference image for Mara')).toBeVisible()
})

test('an imported image can be removed with the X (free versions only)', async ({
  page,
}) => {
  await addCharacterMara(page)

  await page.getByLabel('Import an image for Mara').setInputFiles({
    name: 'mara.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_B64, 'base64'),
  })
  await expect(page.getByAltText('Reference image for Mara')).toBeVisible()

  // The enlarge control opens the fullscreen lightbox (22.10).
  await page.getByLabel('View Mara image large').click()
  await expect(
    page.getByRole('dialog', { name: 'Reference Mara image — enlarged' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('dialog', { name: 'Reference Mara image — enlarged' }),
  ).toHaveCount(0)

  // Double-clicking the thumbnail enlarges too (22.10.1, like the reels).
  await page.getByAltText('Reference image for Mara').dblclick()
  await expect(
    page.getByRole('dialog', { name: 'Reference Mara image — enlarged' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')

  // X on the thumbnail → confirm → back to "No image".
  await page.getByLabel('Remove imported image for Mara').click()
  await expect(page.getByText('Remove this imported image?')).toBeVisible()
  await page.getByRole('button', { name: 'Remove image' }).click()
  await expect(page.getByAltText('Reference image for Mara')).toHaveCount(0)
  await expect(page.getByLabel('Reference Mara has no image yet')).toBeVisible()

  // Paid generations never show the X.
  await pickModel(page, 'Model for Mara', 'mock/painter-i2i')
  await page.getByRole('button', { name: 'Generate for Mara' }).click()
  await expect(page.getByAltText('Reference image for Mara')).toBeVisible()
  await expect(page.getByLabel('Remove imported image for Mara')).toHaveCount(0)

  // The removal is persisted: only the generated version remains.
  await expect
    .poll(async () => {
      const [stored] = (await readStoredProjects(page)) as {
        references: { imageVersions: { model: string }[] }[]
      }[]
      return stored?.references[0]?.imageVersions.map((v) => v.model)
    })
    .toEqual(['mock/painter-i2i'])
})

test('a vision model writes the description from the imported image', async ({
  page,
}) => {
  // A reference with a name but NO description — the case the button solves.
  await page.getByRole('button', { name: 'Add character' }).click()
  await page.getByLabel('Reference Unnamed character name').fill('Mara')
  await page.getByLabel('Reference Mara name').blur()

  await page.getByLabel('Import an image for Mara').setInputFiles({
    name: 'mara.png',
    mimeType: 'image/png',
    buffer: Buffer.from(TINY_PNG_B64, 'base64'),
  })
  await expect(page.getByAltText('Reference image for Mara')).toBeVisible()

  // Pick the vision model; the description comes back from the mock.
  const VISION_DESCRIPTOR =
    'a tall woman in her 40s, cropped silver hair, navy captain coat with brass buttons'
  await page.route(`${API}/v1/chat/completions`, (route) =>
    route.fulfill({
      json: {
        model: 'mock/seer-1',
        choices: [
          { message: { role: 'assistant', content: VISION_DESCRIPTOR } },
        ],
        usage: { prompt_tokens: 300, completion_tokens: 60 },
      },
    }),
  )
  // Flip the toggle (22.7): the single dropdown now lists TEXT models
  // that accept image input, and Generate writes the description.
  await page
    .getByRole('button', {
      name: 'Generate description from image for Mara',
    })
    .click()
  await pickModel(page, 'Model for Mara', 'mock/seer-1')
  await page.getByRole('button', { name: 'Generate for Mara' }).click()
  await expect(page.getByLabel('Reference Mara description')).toHaveValue(
    VISION_DESCRIPTOR,
  )

  // Describing again over an existing description asks first.
  await page.getByRole('button', { name: 'Generate for Mara' }).click()
  await expect(page.getByText('Replace the description?')).toBeVisible()
  await page.getByRole('button', { name: 'Replace description' }).click()
  await expect(page.getByLabel('Reference Mara description')).toHaveValue(
    VISION_DESCRIPTOR,
  )

  // The descriptor is persisted, not just shown.
  await expect
    .poll(async () => {
      const [stored] = (await readStoredProjects(page)) as {
        references: { descriptor: string }[]
      }[]
      return stored?.references[0]?.descriptor
    })
    .toBe(VISION_DESCRIPTOR)
})

test('scene generation attaches the reference image for i2i models and says so', async ({
  page,
}) => {
  await addCharacterMara(page)
  await page.getByLabel('Scene 1 uses Mara').check()

  // Import a reference image (free, no generation call) — as a JPEG:
  // OPFS strips MIME types on read-back, and the attachment must restore
  // the STORED type, not stamp everything image/png (22.11).
  await page.getByLabel('Import an image for Mara').setInputFiles({
    name: 'mara.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(TINY_PNG_B64, 'base64'),
  })
  await expect(page.getByAltText('Reference image for Mara')).toBeVisible()

  await page.getByRole('button', { name: 'Images', exact: true }).click()

  // A model without image-to-image is honest about skipping the image.
  await pickModel(page, 'Image model', 'mock/painter-1')
  const scene1 = page.getByLabel('Scene 1 workbench')
  await expect(
    scene1.getByText(
      'This model cannot use reference images — descriptions still apply, but the images will be skipped.',
    ),
  ).toBeVisible()

  // The i2i filter narrows the picker, and the capable model announces the attachment.
  await page
    .getByLabel('Only show models that can use reference images')
    .check()
  await pickModel(page, 'Image model', 'mock/painter-i2i')
  await expect(
    scene1.getByText(
      'One reference image will be attached to this generation.',
    ),
  ).toBeVisible()
  // Scene 2 has no ticked reference — no attachment note in its workbench
  // (the model-filter checkbox may still mention reference images).
  await page.getByRole('button', { name: 'Scene 2 frame' }).click()
  await expect(
    page.getByLabel('Scene 2 workbench').getByText('will be attached'),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'Scene 1 frame' }).click()

  // Capture the actual request: it must carry input_references + the
  // descriptor verbatim in the prompt.
  let requestBody: Record<string, unknown> = {}
  await page.route(`${API}/v1/images`, (route) => {
    requestBody = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({ json: { data: [{ b64_json: TINY_PNG_B64 }] } })
  })
  await scene1.getByRole('button', { name: 'Generate image' }).click()
  await expect(page.getByAltText('Scene 1 active image')).toBeVisible()

  expect(requestBody.prompt).toContain(DESCRIPTOR)
  const references = requestBody.input_references as string[]
  expect(references).toHaveLength(1)
  // The JPEG import must reach the API as a JPEG data URL — the stored
  // mime type restored after OPFS stripped it (22.11).
  expect(references[0]).toMatch(/^data:image\/jpeg;base64,/)
})
