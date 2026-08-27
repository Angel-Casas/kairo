import { expect, test } from '@playwright/test'

test('app shell loads', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Kairo' })).toBeVisible()
})

test('has a web app manifest (PWA)', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    'href',
    /manifest/,
  )
})

test('the app shell loads offline via the service worker', async ({
  page,
  context,
}) => {
  await page.goto('/')
  // Wait for the service worker to take control (precache complete).
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Kairo' })).toBeVisible()
  // Separate "did offline propagate" from "did the banner render": on a
  // slower CI runner the app shell can paint before the browser's own
  // connectivity flag has settled, which isn't the banner's fault.
  await page.waitForFunction(() => !navigator.onLine)
  await expect(page.getByRole('status')).toContainText('Offline', {
    timeout: 10_000,
  })
  await context.setOffline(false)
})
