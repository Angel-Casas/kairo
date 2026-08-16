import { expect, test } from '@playwright/test'

test('project lifecycle: create → rename → survives reload → delete', async ({
  page,
}) => {
  await page.goto('/')

  // Create
  await page.getByLabel('New project title').fill('Lifecycle test')
  await page.getByRole('button', { name: 'Create project' }).click()
  await expect(page.getByText('Lifecycle test')).toBeVisible()

  // Rename
  await page.getByRole('button', { name: 'Rename' }).first().click()
  await page.getByLabel('Project title', { exact: true }).fill('Renamed test')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Renamed test')).toBeVisible()

  // Open the project (placeholder view), then back
  await page.getByRole('button', { name: /Renamed test/ }).click()
  await expect(page.getByText(/pipeline/)).toBeVisible()
  await page.getByRole('button', { name: '← All projects' }).click()

  // Survives a full reload (IndexedDB persistence)
  await page.reload()
  await expect(page.getByText('Renamed test')).toBeVisible()

  // Delete, with confirmation dialog
  await page.getByRole('button', { name: 'Delete' }).first().click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Delete project' }).click()
  await expect(page.getByText('Renamed test')).not.toBeVisible()
  await expect(
    page.getByText('No projects yet. Create one to get started.'),
  ).toBeVisible()
})
