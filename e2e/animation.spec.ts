import { expect, test, type Page } from '@playwright/test'
import {
  API,
  createAndOpenProject,
  expectSpendBreakdown,
  mockTts,
  mockTtsModels,
  mockBalance,
  mockChatCompletion,
  mockImageGeneration,
  mockImageModels,
  mockTextModels,
  pickModel,
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
            supported_parameters: {
              resolutions: ['1080p', '480p'],
              durations: ['5', '8'],
            },
          },
          {
            id: 'mock/text-only',
            name: 'Text Only Model',
            capabilities: { text_to_video: true, image_to_video: false },
          },
          {
            id: 'mock/s2v-1',
            name: 'Mock LipSyncer',
            capabilities: { image_to_video: true, audio_input: true },
            pricing: {
              currency: 'USD',
              per_second_by_resolution: { '480p': 0.04 },
            },
            supported_parameters: {
              parameters: {
                resolution: {
                  type: 'select',
                  options: [{ value: '480p' }],
                  default: '480p',
                },
              },
            },
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
  await page.getByRole('button', { name: 'Scenes', exact: true }).click()
  await pickModel(page, 'Text model', 'mock/writer-1')
  await page.getByRole('button', { name: 'Generate scenes' }).click()
  await expect(page.getByRole('listitem', { name: 'Scene 1' })).toBeVisible()
  await page.getByRole('button', { name: 'Images', exact: true }).click()
  await pickModel(page, 'Image model', 'mock/painter-1')
  await page
    .getByLabel('Scene 1 workbench')
    .getByRole('button', { name: 'Generate image' })
    .click()
  await expect(page.getByAltText('Scene 1 active image')).toBeVisible()
  await page.getByRole('button', { name: 'Animation', exact: true }).click()
})

test('the model menu only offers image-to-video models, with prices and sorting', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Video model', exact: true }).click()
  const menu = page.getByRole('dialog', { name: 'Video model menu' })
  await expect(menu).toBeVisible()
  // Price surfaced right on the row (Angel's feedback), t2v-only excluded.
  await expect(
    menu.getByRole('option', { name: 'mock/animator-1' }),
  ).toBeVisible()
  await expect(menu).toContainText('≈$0.72–$1.80')
  await expect(menu).not.toContainText('Text Only Model')
  // The Filters & Sort rail: provider filter with counts, sort orders.
  await expect(menu.getByRole('button', { name: 'Cheapest' })).toBeVisible()
  await menu.getByRole('button', { name: 'Name', exact: true }).click()
  await expect(
    menu.getByRole('button', { name: 'Name', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  // Search narrows the list and the footer says so.
  await page.getByLabel('Filter video models').fill('nope-no-match')
  await expect(menu.getByText('No models match.')).toBeVisible()
  await page.getByLabel('Filter video models').fill('')
  await menu.getByRole('option', { name: 'mock/animator-1' }).click()
  await expect(menu).not.toBeVisible()
  // The trigger now shows the choice.
  await expect(
    page.getByRole('button', { name: 'Video model', exact: true }),
  ).toContainText('Mock Animator')
})

test('resolution defaults to the cheapest tier and the confirm shows the price', async ({
  page,
}) => {
  await pickModel(page, 'Video model', 'mock/animator-1')
  // Model advertises ['1080p', '480p']; Kairo must default to 480p.
  await expect(page.getByLabel('Video resolution')).toHaveValue('480p')

  // The duration select offers exactly what the model advertises — never a
  // length the backend would silently clamp (Angel's 8s→5s surprise).
  const durationOptions = page.getByLabel('Clip duration').locator('option')
  await expect(durationOptions).toHaveText(['5s', '8s'])

  const scene1 = page.getByLabel('Scene 1 animation workbench')
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
  let submitted: { prompt?: string } = {}
  await page.route(`${API}/generate-video`, async (route) => {
    submitted = route.request().postDataJSON() as { prompt?: string }
    return route.fulfill({
      json: { runId: 'vid_e2e_1', status: 'pending', cost: 0.35 },
    })
  })
  await pickModel(page, 'Video model', 'mock/animator-1')

  const scene1 = page.getByLabel('Scene 1 animation workbench')
  // The optional camera helper steers the motion prompt.
  await scene1
    .getByLabel('Camera direction', { exact: true }) // 'Camera direction help' is a superstring
    .fill('fixed tripod, slow zoom in')
  await scene1.getByRole('button', { name: 'Animate scene' }).click()
  await page.getByRole('button', { name: 'Submit and charge' }).click()
  await expect(scene1.getByRole('button', { name: /Generating/ })).toBeVisible()

  // Poll interval is 10s in prod; the first check happens after ~1s, the next
  // at ~11s — wait generously for the clip to land.
  await expect(scene1.getByLabel('Scene 1 video')).toBeVisible({
    timeout: 30_000,
  })
  // The camera direction rode into the submitted prompt, replacing the
  // gentle-drift default.
  expect(submitted.prompt).toContain('Camera: fixed tripod, slow zoom in')
  expect(submitted.prompt).not.toContain('camera drifts gently')
  await expectSpendBreakdown(page, '3 generations')

  // The finished clip plays enlarged in the lightbox.
  await page.getByRole('button', { name: 'View scene 1 large' }).click()
  await expect(
    page.getByRole('dialog', { name: 'Scene 1 clip — enlarged' }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('dialog', { name: 'Scene 1 clip — enlarged' }),
  ).not.toBeVisible()
})

test('clip history: edit the motion prompt, confirm the price, verbatim submit', async ({
  page,
}) => {
  await mockVideoPipeline(page, { inProgressPolls: 0 })
  await pickModel(page, 'Video model', 'mock/animator-1')

  const scene1 = page.getByLabel('Scene 1 animation workbench')
  await scene1.getByRole('button', { name: 'Animate scene' }).click()
  await page.getByRole('button', { name: 'Submit and charge' }).click()
  await expect(scene1.getByLabel('Scene 1 video')).toBeVisible({
    timeout: 30_000,
  })

  // Open the clip history: the derived motion prompt is visible.
  await scene1.getByLabel('Scene 1 clip history').click()
  const promptText = await scene1
    .getByLabel('Scene 1 clip version 1 prompt', { exact: true })
    .innerText()
  expect(promptText).toContain('A lighthouse on a rocky cliff at sunset')
  expect(promptText).toContain('one continuous natural action')

  // Edit & regenerate → confirmation dialog with the price picture first.
  await scene1
    .getByRole('button', {
      name: 'Edit and regenerate from Scene 1 clip version 1',
    })
    .click()
  const editor = scene1.getByLabel('Scene 1 clip version 1 edited prompt')
  await expect(editor).toHaveValue(promptText)
  await editor.fill('the lantern light sweeps slowly across the waves')

  let submittedPrompt: string | null = null
  await page.route(`${API}/generate-video`, (route) => {
    const body = route.request().postDataJSON() as { prompt?: string }
    submittedPrompt = body.prompt ?? null
    return route.fulfill({
      json: { runId: 'vid_e2e_2', status: 'pending', cost: 0.35 },
    })
  })
  await scene1
    .getByRole('button', { name: 'Generate with this prompt' })
    .click()

  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('edited motion prompt')
  await expect(dialog).toContainText('between $0.72 and $1.80')
  // No money moved yet.
  expect(submittedPrompt).toBeNull()

  await page.getByRole('button', { name: 'Submit and charge' }).click()
  await expect(scene1.getByRole('button', { name: /Generating/ })).toBeVisible()
  await expect
    .poll(() => submittedPrompt)
    .toBe('the lantern light sweeps slowly across the waves')
})

test('a relative video URL is collected from NanoGPT with the key — never the app origin', async ({
  page,
}) => {
  // grok-imagine-video returns '/api/generate-video/content?...'; before
  // the fix this resolved against the app origin and stored index.html as
  // the clip (LESSONS.md 2026-08-22).
  let contentAuth: string | null = null
  await page.route(`${API}/generate-video`, (route) =>
    route.fulfill({
      json: { runId: 'vid_rel_1', status: 'pending', cost: 0.35 },
    }),
  )
  await page.route(`${API}/video/status**`, (route) =>
    route.fulfill({
      json: {
        requestId: 'vid_rel_1',
        data: {
          status: 'COMPLETED',
          output: {
            video: {
              url: '/api/generate-video/content?model=mock&runId=r1&variant=video',
            },
          },
          cost: 0.35,
          error: null,
        },
      },
    }),
  )
  await page.route(`${API}/generate-video/content**`, (route) => {
    contentAuth = route.request().headers()['x-api-key'] ?? null
    return route.fulfill({
      body: Buffer.from(FAKE_MP4, 'base64'),
      contentType: 'video/mp4',
    })
  })

  await pickModel(page, 'Video model', 'mock/animator-1')
  const scene1 = page.getByLabel('Scene 1 animation workbench')
  await scene1.getByRole('button', { name: 'Animate scene' }).click()
  await page.getByRole('button', { name: 'Submit and charge' }).click()
  await expect(page.getByLabel('Scene 1 video')).toBeVisible({
    timeout: 15000,
  })
  expect(contentAuth).toBe('e2e-key')
})

test('lip-sync works without a main Animate model chosen (15.16.2)', async ({
  page,
}) => {
  await mockTtsModels(page)
  await mockTts(page)
  await mockVideoPipeline(page, { inProgressPolls: 0 })

  // Narrate scene 1, then return to Animation.
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await pickModel(page, 'Narration model', 'mock/tts-1')
  await page.getByRole('button', { name: 'Narrate scene' }).click()
  await expect(
    page.getByLabel('Scene 1 narration', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Animation', exact: true }).click()

  // Deliberately pick NO main Video model — only the lip-sync model
  // (the bug: the confirm dialog was gated on the main model existing).
  let body: Record<string, unknown> = {}
  await page.route('https://nano-gpt.com/api/generate-video', async (route) => {
    body = route.request().postDataJSON() as Record<string, unknown>
    return route.fulfill({
      json: { runId: 'vid_lipsync_e2e', status: 'pending', cost: 0.26 },
    })
  })
  await pickModel(page, 'Lip-sync model', 'mock/s2v-1')
  await page.getByRole('button', { name: 'Lip-sync scene 1 narration' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('lip-sync job')
  await page.getByRole('button', { name: 'Submit and charge' }).click()

  await expect(page.getByLabel('Scene 1 video')).toBeVisible({
    timeout: 15000,
  })
  // The narration rode along as audio; no duration was fabricated.
  expect(String(body.audioDataUrl)).toMatch(/^data:audio/)
  expect(body).not.toHaveProperty('duration')

  // The clip carries its own voice — the side player yields to a note
  // and no separate narration audio is offered (15.16.3).
  await expect(page.getByText('embedded in this lip-sync clip')).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Mute narration' }),
  ).toBeHidden()
})

test('narration rides the clip player with a mute toggle', async ({ page }) => {
  await mockTtsModels(page)
  await mockTts(page)
  await mockVideoPipeline(page, { inProgressPolls: 0 })

  // Narrate scene 1 on the Audio stage, then come back.
  await page.getByRole('button', { name: 'Audio', exact: true }).click()
  await pickModel(page, 'Narration model', 'mock/tts-1')
  await page.getByRole('button', { name: 'Narrate scene' }).click()
  await expect(
    page.getByLabel('Scene 1 narration', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Animation', exact: true }).click()

  // Generate the clip so the workbench holds both players.
  await pickModel(page, 'Video model', 'mock/animator-1')
  const scene1 = page.getByLabel('Scene 1 animation workbench')
  await scene1.getByRole('button', { name: 'Animate scene' }).click()
  await page.getByRole('button', { name: 'Submit and charge' }).click()
  await expect(page.getByLabel('Scene 1 video')).toBeVisible({
    timeout: 15000,
  })

  // Narration sits beside the clip with a working mute toggle.
  await expect(scene1.getByText('plays along with the clip')).toBeVisible()
  await expect(
    scene1.getByLabel('Scene 1 narration', { exact: true }),
  ).toBeVisible()
  const mute = scene1.getByRole('button', { name: 'Mute narration' })
  await expect(mute).toHaveAttribute('aria-pressed', 'false')
  await mute.click()
  await expect(mute).toHaveAttribute('aria-pressed', 'true')
  await expect(mute).toHaveText('Unmute')

  // The fullscreen viewer carries the narration too, with its own toggle.
  await page.getByLabel('View scene 1 large').click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const viewerMute = dialog.getByRole('button', { name: 'Mute narration' })
  await expect(viewerMute).toHaveAttribute('aria-pressed', 'false')
  await viewerMute.click()
  await expect(viewerMute).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
})

test('a clip file imports as a free take', async ({ page }) => {
  await page.getByLabel('Import a clip file for scene 1').setInputFiles({
    name: 'external-clip.mp4',
    mimeType: 'video/mp4',
    buffer: Buffer.from(FAKE_MP4, 'base64'),
  })
  await expect(page.getByLabel('Scene 1 video')).toBeVisible()
  // Free: the spend summary still shows only the breakdown + image.
  await expectSpendBreakdown(page, '2 generations')
})

test('a job interrupted by reload resumes and collects the clip', async ({
  page,
}) => {
  await mockVideoPipeline(page, { inProgressPolls: 999 })
  await pickModel(page, 'Video model', 'mock/animator-1')
  const scene1 = page.getByLabel('Scene 1 animation workbench')
  await scene1.getByRole('button', { name: 'Animate scene' }).click()
  await page.getByRole('button', { name: 'Submit and charge' }).click()
  await expect(scene1.getByRole('button', { name: /Generating/ })).toBeVisible()
  // Wait for submission to be persisted (its cost log entry appears) so the
  // reload interrupts POLLING, not the submission itself.
  await expectSpendBreakdown(page, '3 generations')

  // "Close" the tab mid-generation: reload, then let the next poll complete.
  await mockVideoPipeline(page, { inProgressPolls: 0 })
  await page.reload()
  await page.getByRole('button', { name: /Animation test/ }).click()
  await page.getByRole('button', { name: 'Animation', exact: true }).click()

  // Resume happens inside project load; the clip may land before this stage
  // is even opened, so assert only the outcome: the collected video.
  const resumed = page.getByLabel('Scene 1 animation workbench')
  await expect(resumed.getByLabel('Scene 1 video')).toBeVisible({
    timeout: 30_000,
  })
})
