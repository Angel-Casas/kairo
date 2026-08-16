import { expect, test, type Page } from '@playwright/test'
import {
  API,
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
]

// Minimal valid-enough MP4 bytes for a blob round-trip (playback not asserted).
const FAKE_MP4 = 'AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQ=='

async function mockVideoModels(page: Page): Promise<void> {
  await page.route(`${API}/v1/video-models?detailed=true`, (route) =>
    route.fulfill({
      json: {
        object: 'list',
        data: [
          {
            id: 'mock/animator-1',
            name: 'Mock Animator',
            capabilities: { text_to_video: true, image_to_video: true },
            pricing: {
              currency: 'USD',
              per_video: { '480p': 0.72, '1080p': 1.8 },
            },
            supported_parameters: { resolutions: ['1080p', '480p'] },
          },
          {
            id: 'mock/text-only',
            name: 'Text Only Model',
            capabilities: { text_to_video: true, image_to_video: false },
          },
        ],
        meta: { count: 2, generated_at: '2026-08-16T00:00:00Z' },
      },
    }),
  )
}

async function mockVideoPipeline(
  page: Page,
  opts: { inProgressPolls: number },
): Promise<{ statusCalls: () => number }> {
  let polls = 0
  await page.route(`${API}/generate-video`, (route) =>
    route.fulfill({
      json: { runId: 'vid_e2e_1', status: 'pending', cost: 0.35 },
    }),
  )
  await page.route(`${API}/video/status**`, (route) => {
    polls += 1
    const done = polls > opts.inProgressPolls
    return route.fulfill({
      json: {
        requestId: 'vid_e2e_1',
        data: {
          status: done ? 'COMPLETED' : 'IN_PROGRESS',
          output: done
            ? { video: { url: 'https://cdn.test/clip.mp4' } }
            : undefined,
          cost: 0.35,
          error: null,
        },
      },
    })
  })
  await page.route('https://cdn.test/clip.mp4', (route) =>
    route.fulfill({
      body: Buffer.from(FAKE_MP4, 'base64'),
      contentType: 'video/mp4',
    }),
  )
  return { statusCalls: () => polls }
}

test.beforeEach(async ({ page }) => {
  await mockBalance(page)
  await mockTextModels(page)
  await mockImageModels(page)
  await mockVideoModels(page)
  await mockChatCompletion(page, JSON.stringify(BREAKDOWN))
  await mockImageGeneration(page)

  // Key + project + locked script + scene + image.
  await page.goto('/')
  await setUpApiKey(page)
  await createAndOpenProject(page, 'Animation test')
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
  await page
    .getByRole('listitem', { name: 'Scene 1 images' })
    .getByRole('button', { name: 'Generate image' })
    .click()
  await expect(
    page
      .getByRole('listitem', { name: 'Scene 1 images' })
      .getByAltText('Scene 1 active image'),
  ).toBeVisible()
  await page.getByRole('button', { name: '4. Animation' }).click()
})

test('the video model picker only offers image-to-video models, with prices', async ({
  page,
}) => {
  const options = page
    .getByLabel('Video model', { exact: true })
    .locator('option')
  // Price range surfaced right in the picker (Angel's feedback).
  await expect(options).toContainText([/Mock Animator — ≈\$0\.72–\$1\.80/])
  await expect(
    page.getByLabel('Video model', { exact: true }),
  ).not.toContainText('Text Only Model')
})

test('resolution defaults to the cheapest tier and the confirm shows the price', async ({
  page,
}) => {
  await page
    .getByLabel('Video model', { exact: true })
    .selectOption('mock/animator-1')
  // Model advertises ['1080p', '480p']; Kairo must default to 480p.
  await expect(page.getByLabel('Video resolution')).toHaveValue('480p')

  const scene1 = page.getByRole('listitem', { name: 'Scene 1 animation' })
  await scene1.getByRole('button', { name: 'Animate scene' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('480p')
  await expect(dialog).toContainText('between $0.72 and $1.80')
  await page.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).not.toBeVisible()
})

test('animate a scene: submit, poll, clip appears, cost logged', async ({
  page,
}) => {
  await mockVideoPipeline(page, { inProgressPolls: 1 })
  await page
    .getByLabel('Video model', { exact: true })
    .selectOption('mock/animator-1')

  const scene1 = page.getByRole('listitem', { name: 'Scene 1 animation' })
  await scene1.getByRole('button', { name: 'Animate scene' }).click()
  await page.getByRole('button', { name: 'Submit and charge' }).click()
  await expect(scene1.getByRole('button', { name: /Generating/ })).toBeVisible()

  // Poll interval is 10s in prod; the first check happens after ~1s, the next
  // at ~11s — wait generously for the clip to land.
  await expect(scene1.getByLabel('Scene 1 video')).toBeVisible({
    timeout: 30_000,
  })
  await expect(page.getByLabel('Project spend')).toContainText('3 generations')
})

test('a job interrupted by reload resumes and collects the clip', async ({
  page,
}) => {
  await mockVideoPipeline(page, { inProgressPolls: 999 })
  await page
    .getByLabel('Video model', { exact: true })
    .selectOption('mock/animator-1')
  const scene1 = page.getByRole('listitem', { name: 'Scene 1 animation' })
  await scene1.getByRole('button', { name: 'Animate scene' }).click()
  await page.getByRole('button', { name: 'Submit and charge' }).click()
  await expect(scene1.getByRole('button', { name: /Generating/ })).toBeVisible()
  // Wait for submission to be persisted (its cost log entry appears) so the
  // reload interrupts POLLING, not the submission itself.
  await expect(page.getByLabel('Project spend')).toContainText('3 generations')

  // "Close" the tab mid-generation: reload, then let the next poll complete.
  await mockVideoPipeline(page, { inProgressPolls: 0 })
  await page.reload()
  await page.getByRole('button', { name: /Animation test/ }).click()
  await page.getByRole('button', { name: '4. Animation' }).click()

  // Resume happens inside project load; the clip may land before this stage
  // is even opened, so assert only the outcome: the collected video.
  const resumed = page.getByRole('listitem', { name: 'Scene 1 animation' })
  await expect(resumed.getByLabel('Scene 1 video')).toBeVisible({
    timeout: 30_000,
  })
})
