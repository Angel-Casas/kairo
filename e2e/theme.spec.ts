import { expect, test } from '@playwright/test'

/**
 * The design pass (ADR-010) and its follow-up: one palette dropdown for all
 * ten palettes — picking a palette also switches its mode (no separate
 * light/dark toggle) — plus the fullscreen settings overlay.
 */

// With no stored choice the app follows prefers-color-scheme; pin it so the
// dark-first assertions are deterministic (Playwright defaults to light).
test.use({ colorScheme: 'dark' })

test('defaults to a dark palette and can switch to another dark palette', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'emberlight')

  await page.getByRole('button', { name: 'Color palette' }).click()
  await page.getByRole('option', { name: 'Lagoon' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'lagoon')

  // The choice is stored before reload (synchronous localStorage write).
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'lagoon')
})

test('picking a light palette switches the mode, and each mode keeps its palette', async ({
  page,
}) => {
  await page.goto('/')

  // One dropdown holds all ten palettes; choosing a light one IS choosing
  // light mode.
  await page.getByRole('button', { name: 'Color palette' }).click()
  const listbox = page.getByRole('listbox', { name: 'Color palettes' })
  await expect(listbox.getByRole('option')).toHaveText([
    'Emberlight',
    'Lagoon',
    'Orchid',
    'Citrus',
    'North Sea',
    'Golden Hour',
    'Sea Glass',
    'Peony',
    'Meadow',
    'Lilac Dawn',
  ])
  await page.getByRole('option', { name: 'Peony' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'peony')
  await expect(listbox).not.toBeVisible()

  // Back to a dark palette: dark mode returns with it.
  await page.getByRole('button', { name: 'Color palette' }).click()
  await page.getByRole('option', { name: 'North Sea' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'dark')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'northsea')

  // Both mode slots survive a reload; the last-picked palette wins.
  await page.getByRole('button', { name: 'Color palette' }).click()
  await page.getByRole('option', { name: 'Peony' }).click()
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'light')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'peony')
})

test('the palette dropdown closes on Escape and on clicking outside', async ({
  page,
}) => {
  await page.goto('/')
  const listbox = page.getByRole('listbox', { name: 'Color palettes' })

  await page.getByRole('button', { name: 'Color palette' }).click()
  await expect(listbox).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(listbox).not.toBeVisible()

  await page.getByRole('button', { name: 'Color palette' }).click()
  await expect(listbox).toBeVisible()
  await page.getByRole('heading', { name: 'Kairo' }).click()
  await expect(listbox).not.toBeVisible()
})

test('settings opens as an overlay over the page and the gear becomes an X', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Settings' }).click()
  const overlay = page.getByRole('dialog', { name: 'Settings' })
  await expect(overlay).toBeVisible()
  await expect(
    overlay.getByRole('heading', { name: 'NanoGPT API key' }),
  ).toBeVisible()
  // The page stays mounted behind the overlay.
  await expect(
    page.getByRole('heading', { name: 'Your productions' }),
  ).toBeAttached()

  // The gear is now an X that closes the overlay.
  await page.getByRole('button', { name: 'Close settings' }).click()
  await expect(overlay).not.toBeVisible()

  // Escape closes it too.
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(overlay).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(overlay).not.toBeVisible()
})
