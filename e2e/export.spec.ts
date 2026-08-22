import { expect, test } from '@playwright/test'
import {
  API,
  createAndOpenProject,
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

const FAKE_MP4 = 'AAAAHGZ0eXBpc29tAAACAGlzb21pc28ybXA0MQ=='

test.beforeEach(async ({ page }) => {
  await mockBalance(page)
  await mockTextModels(page)
  await mockImageModels(page)
  await page.route(`${API}/v1/video-models?detailed=true`, (route) =>
    route.fulfill({
      json: {
        object: 'list',
        data: [
          {
            id: 'mock/animator-1',
            name: 'Mock Animator',
            capabilities: { image_to_video: true },
            pricing: { currency: 'USD', per_video: 0.2 },
            supported_parameters: { resolutions: ['480p'] },
          },
        ],
      },
    }),
  )
  await mockChatCompletion(page, JSON.stringify(BREAKDOWN))
  await mockImageGeneration(page)
  await page.route(`${API}/generate-video`, (route) =>
    route.fulfill({
      json: { runId: 'vid_export_1', status: 'pending', cost: 0.2 },
    }),
  )
  await page.route(`${API}/video/status**`, (route) =>
    route.fulfill({
      json: {
        requestId: 'vid_export_1',
        data: {
          status: 'COMPLETED',
          output: { video: { url: 'https://cdn.test/clip.mp4' } },
          cost: 0.2,
          error: null,
        },
      },
    }),
  )
  await page.route('https://cdn.test/clip.mp4', (route) =>
    route.fulfill({
      body: Buffer.from(FAKE_MP4, 'base64'),
      contentType: 'video/mp4',
    }),
  )

  // Full mocked pipeline: key → project → script → scene → image → clip.
  await page.goto('/')
  await setUpApiKey(page)
  await createAndOpenProject(page, 'Export test')
  await page.getByLabel('Script text').fill('A lighthouse stands on the cliff.')
  await page.getByRole('button', { name: 'Lock script' }).click()
  await expect(
    page.getByRole('button', { name: 'Export', exact: true }),
  ).toBeDisabled()
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
  await pickModel(page, 'Video model', 'mock/animator-1')
  await page
    .getByLabel('Scene 1 animation workbench')
    .getByRole('button', { name: 'Animate scene' })
    .click()
  await page.getByRole('button', { name: 'Submit and charge' }).click()
  await expect(page.getByLabel('Scene 1 video')).toBeVisible({
    timeout: 30_000,
  })
  await page.getByRole('button', { name: 'Export', exact: true }).click()
})

test('clips zip downloads with numbered clips and the script', async ({
  page,
}) => {
  await expect(page.getByLabel('Export readiness')).toContainText(
    '1 of 1 scene has a finished clip',
  )
  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download clips (.zip)' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('export-test.zip')

  // Verify the zip contents on disk.
  const path = await download.path()
  const { unzipSync, strFromU8 } = await import('fflate')
  const { readFileSync } = await import('node:fs')
  const entries = unzipSync(new Uint8Array(readFileSync(path)))
  expect(Object.keys(entries).sort()).toEqual(['scene-01.mp4', 'script.txt'])
  expect(strFromU8(entries['script.txt'] ?? new Uint8Array())).toBe(
    'A lighthouse stands on the cliff.',
  )
})

test('project backup downloads and re-imports as a new project', async ({
  page,
}) => {
  const downloadPromise = page.waitForEvent('download')
  await page
    .getByRole('button', { name: 'Download project backup (.kairo)' })
    .click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toBe('export-test.kairo')
  const backupPath = await download.path()

  // Round trip: import the backup from the project list.
  await page.getByRole('button', { name: '← All projects' }).click()
  await page.getByLabel('Import project file').setInputFiles(backupPath)
  await expect(
    page.getByRole('button', { name: /Export test/ }).nth(1),
  ).toBeVisible()

  // The imported copy has the clip too (assets round-tripped).
  await page
    .getByRole('button', { name: /Export test/ })
    .nth(0)
    .click()
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(page.getByLabel('Export readiness')).toContainText(
    '1 of 1 scene has a finished clip',
  )
})
