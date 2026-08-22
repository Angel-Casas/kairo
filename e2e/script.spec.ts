import { expect, test } from '@playwright/test'
import {
  createAndOpenProject,
  mockBalance,
  mockChatCompletion,
  mockTextModels,
  setUpApiKey,
} from './helpers'

test.beforeEach(async ({ page }) => {
  await mockBalance(page)
  await mockTextModels(page)
  await mockChatCompletion(page, 'Generated narration about space.')

  await page.goto('/')
  await setUpApiKey(page)
  await createAndOpenProject(page, 'Script test')
  await expect(
    page.getByRole('navigation', { name: 'Pipeline stages' }),
  ).toBeVisible()
})

test('script edits autosave and survive a reload', async ({ page }) => {
  await page.getByLabel('Script text').fill('My handwritten script.')
  // Blur flushes the autosave immediately.
  await page.getByLabel('Script text').blur()
  await page.reload()
  await page.getByRole('button', { name: /Script test/ }).click()
  await expect(page.getByLabel('Script text')).toHaveValue(
    'My handwritten script.',
  )
})

test('generation shows an upfront estimate, fills the editor, and locks', async ({
  page,
}) => {
  await page
    .getByLabel('Generation instructions')
    .fill('The James Webb telescope')
  await page.getByLabel('Filter text models').fill('Mock')
  await page
    .getByLabel('Text model', { exact: true })
    .selectOption('mock/writer-1')
  await expect(page.getByLabel('Estimated cost')).toContainText(
    'Estimated cost: up to ~$',
  )

  await page.getByRole('button', { name: 'Generate script' }).click()
  await expect(page.getByLabel('Script text')).toHaveValue(
    'Generated narration about space.',
  )

  // Spend summary appears with the actual cost from usage:
  // 117/1M*$2 + 192/1M*$10 = $0.002154
  await expect(page.getByLabel('Project spend')).toContainText(
    'Spent: $0.0022 (1 generation)',
  )
  await page.getByRole('button', { name: 'Details' }).click()
  await expect(page.getByText(/actual \$0\.0022/)).toBeVisible()

  // Regenerating over existing text requires confirmation.
  await page.getByRole('button', { name: 'Generate script' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Replace and generate' }).click()
  await expect(page.getByLabel('Script text')).toHaveValue(
    'Generated narration about space.',
  )

  // Lock: editor disabled, generation panel hidden, unlock requires confirm.
  await page.getByRole('button', { name: 'Lock script' }).click()
  await expect(page.getByLabel('Script text')).toBeDisabled()
  await expect(page.getByText('Generate with AI')).not.toBeVisible()
  await page.getByRole('button', { name: 'Unlock script' }).click()
  await page.getByRole('button', { name: 'Unlock', exact: true }).click()
  await expect(page.getByLabel('Script text')).toBeEnabled()
})
