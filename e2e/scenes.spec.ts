import { expect, test } from '@playwright/test'
import {
  createAndOpenProject,
  mockBalance,
  mockChatCompletion,
  mockTextModels,
  readStoredProjects,
  setUpApiKey,
} from './helpers'

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
  await mockBalance(page)
  await mockTextModels(page)
  await mockChatCompletion(
    page,
    '```json\n' + JSON.stringify(BREAKDOWN) + '\n```',
  )

  // Key + project + locked script.
  await page.goto('/')
  await setUpApiKey(page)
  await createAndOpenProject(page, 'Scenes test')
  await page
    .getByLabel('Script text')
    .fill('The James Webb telescope sees the universe in infrared.')
  await page.getByLabel('Script text').blur()
})

test('scenes stage is gated on a locked script', async ({ page }) => {
  await expect(
    page.getByRole('button', { name: 'Scenes', exact: true }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Lock script' }).click()
  await expect(
    page.getByRole('button', { name: 'Scenes', exact: true }),
  ).toBeEnabled()
})

test('AI breakdown → edit → reorder → survives reload', async ({ page }) => {
  await page.getByRole('button', { name: 'Lock script' }).click()
  await page.getByRole('button', { name: 'Scenes', exact: true }).click()

  // Generate with upfront estimate.
  await page
    .getByLabel('Text model', { exact: true })
    .selectOption('mock/writer-1')
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

  // Reorder: move scene 2 up.
  await page.getByLabel('Move scene 2 up').click()
  await expect(page.getByLabel('Scene 1 script excerpt')).toHaveValue(
    'It catches light older than Earth itself.',
  )

  // Spend summary counts the breakdown generation.
  await expect(page.getByLabel('Project spend')).toContainText('1 generation')

  // The UI updates before IndexedDB commits — wait until the reorder is
  // actually stored before reloading (LESSONS.md persistence rule).
  await expect
    .poll(async () => {
      const [stored] = (await readStoredProjects(page)) as {
        scenes: { order: number; textExcerpt: string }[]
      }[]
      return stored?.scenes
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((s) => s.textExcerpt)[0]
    })
    .toBe('It catches light older than Earth itself.')

  // Everything survives a reload.
  await page.reload()
  await page.getByRole('button', { name: /Scenes test/ }).click()
  await page.getByRole('button', { name: 'Scenes', exact: true }).click()
  await expect(page.getByLabel('Scene 1 script excerpt')).toHaveValue(
    'It catches light older than Earth itself.',
  )
  await expect(page.getByLabel('Scene 2 visual description')).toHaveValue(
    'A silver telescope drifting past Jupiter',
  )

  // Delete a scene.
  await page.getByLabel('Delete scene 3').click()
  await expect(
    page.getByRole('listitem', { name: 'Scene 3' }),
  ).not.toBeVisible()

  // Regenerating over existing scenes requires confirmation.
  await page
    .getByLabel('Text model', { exact: true })
    .selectOption('mock/writer-1')
  await page.getByRole('button', { name: 'Generate scenes' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Replace and generate' }).click()
  await expect(page.getByLabel('Scene 1 script excerpt')).toHaveValue(
    'The James Webb telescope sees the universe in infrared.',
  )
})

test('the transport deck walks forward and back through unlocked stages', async ({
  page,
}) => {
  // Locked gates: next is disabled until the script is locked.
  await expect(
    page.getByRole('button', { name: 'Next stage: Scenes' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Lock script' }).click()
  await page.getByRole('button', { name: 'Next stage: Scenes' }).click()
  await expect(
    page.getByRole('heading', { name: 'Scenes', exact: true }),
  ).toBeVisible()
  // No scenes yet — Audio (the next stage) stays locked.
  await expect(
    page.getByRole('button', { name: 'Next stage: Audio' }),
  ).toBeDisabled()
  await page.getByRole('button', { name: 'Previous stage: Script' }).click()
  await expect(page.getByLabel('Script text')).toBeVisible()
})
