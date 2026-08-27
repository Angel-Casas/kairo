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

  // context.setOffline() reliably blocks the network — proven above, the
  // reload only succeeded because the service worker served it from
  // cache — but chrome-headless-shell (what `playwright test` actually
  // launches, confirmed by reproducing this locally against the exact
  // binary CI downloads) never flips `navigator.onLine` in response to
  // it, unlike full headed/headless Chromium. That's a browser-emulation
  // gap, not a claim about the app, so drive the app's own listener
  // directly instead of waiting on a signal this environment won't send.
  await page.evaluate(() => {
    window.dispatchEvent(new Event('offline'))
  })
  await expect(page.getByRole('status')).toContainText('Offline')

  await context.setOffline(false)
  await page.evaluate(() => {
    window.dispatchEvent(new Event('online'))
  })
})
