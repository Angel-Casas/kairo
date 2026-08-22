import { expect, test } from '@playwright/test'
import {
  createAndOpenProject,
  expectSpendBreakdown,
  mockBalance,
  mockChatCompletion,
  mockTextModels,
  mockTts,
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
  await mockChatCompletion(page, JSON.stringify(BREAKDOWN))
  await mockTts(page)

  await page.goto('/')
  await setUpApiKey(page)
  await createAndOpenProject(page, 'Audio test')
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
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
})

test('narrate a scene: exact price, player appears, takes, cost logged, reload', async ({
  page,
}) => {
  // The narrated text and its EXACT price (chars-based, no "~").
  await expect(
    page.getByText('“A lighthouse stands on the cliff.”'),
  ).toBeVisible()
  await expect(page.getByText(/^Exact cost: \$/)).toBeVisible()

  // The request carries the excerpt verbatim plus model and voice.
  let body: Record<string, unknown> = {}
  await page.route('https://nano-gpt.com/api/v1/audio/speech', (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({
      contentType: 'audio/mpeg',
      body: Buffer.from('fake-mp3-bytes'),
    })
  })
  await page.getByRole('button', { name: 'Narrate scene' }).click()
  await expect(
    page.getByLabel('Scene 1 narration', { exact: true }),
  ).toBeVisible()
  expect(body.input).toBe('A lighthouse stands on the cliff.')
  expect(body.model).toBe('Kokoro-82m')
  expect(typeof body.voice).toBe('string')

  // Re-narrating appends a take instead of replacing (append-only versions).
  await page.getByRole('button', { name: 'Re-narrate' }).click()
  await expect(
    page.getByRole('button', { name: 'Scene 1 take 2' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Scene 1 take 1' }).click()
  await expect(
    page.getByRole('button', { name: 'Scene 1 take 1' }),
  ).toHaveAttribute('aria-pressed', 'true')

  // Narrate-all covers the remaining scene; the frame reports it.
  await page.getByRole('button', { name: 'Narrate 1 remaining scene' }).click()
  await expect(page.getByText('2 · ♪ narrated (1)')).toBeVisible()

  // The spend log holds exact actuals: breakdown + 3 narrations.
  await expectSpendBreakdown(page, '4 generations')

  // Persisted (poll the stored value before reloading — LESSONS rule).
  await expect
    .poll(async () => {
      const [stored] = (await readStoredProjects(page)) as {
        scenes: { audioVersions: unknown[] }[]
      }[]
      return stored?.scenes.reduce((n, s) => n + s.audioVersions.length, 0)
    })
    .toBe(3)
  await page.reload()
  await page.getByRole('button', { name: /Audio test/ }).click()
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await expect(
    page.getByLabel('Scene 1 narration', { exact: true }),
  ).toBeVisible()
})

test('narration rides into the Animation stage', async ({ page }) => {
  await page.getByRole('button', { name: 'Narrate scene' }).click()
  await expect(
    page.getByLabel('Scene 1 narration', { exact: true }),
  ).toBeVisible()
  // Animation needs an image; it stays locked here — but the audio stage
  // being skippable means Images unlocks straight from Scenes.
  await expect(
    page.getByRole('button', { name: 'Images', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'Animation', exact: true }),
  ).toBeDisabled()
})
