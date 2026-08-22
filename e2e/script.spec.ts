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
  // The menu opens, the search narrows, the pick lands.
  await page.getByRole('button', { name: 'Text model', exact: true }).click()
  await page.getByLabel('Filter text models').fill('Mock')
  await page.getByRole('option', { name: 'mock/writer-1' }).click()
  await expect(page.getByLabel('Estimated cost')).toContainText(
    'Estimated cost: up to ~$',
  )

  await page.getByRole('button', { name: 'Generate script' }).click()
  await expect(page.getByLabel('Script text')).toHaveValue(
    'Generated narration about space.',
  )

  // The breakdown behind the navbar readout shows the actual cost from
  // usage: 117/1M*$2 + 192/1M*$10 = $0.002154
  await page.getByLabel('Spent in the open project').click()
  const spendDialog = page.getByRole('dialog', { name: 'Project spend' })
  await expect(spendDialog).toContainText('Spent $0.0022')
  await expect(spendDialog).toContainText('1 generation')
  await expect(spendDialog.getByText(/actual \$0\.0022/)).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(spendDialog).not.toBeVisible()

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
