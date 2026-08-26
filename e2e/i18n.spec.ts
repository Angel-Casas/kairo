import { expect, test } from '@playwright/test'

/**
 * The language menu (Slice 22.21): ten of the world's most-spoken
 * languages behind the navbar globe. English is the source and default —
 * every other suite keeps passing untouched — and the choice persists in
 * localStorage like the theme does. Arabic/Urdu flip document.dir.
 */

test('defaults to English and lists all ten languages', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(
    page.getByRole('heading', { name: 'Your productions' }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Language' }).click()
  const menu = page.getByRole('menu', { name: 'Languages' })
  await expect(menu).toBeVisible()
  for (const native of [
    'English',
    '中文',
    'हिन्दी',
    'Español',
    'Français',
    'العربية',
    'বাংলা',
    'Português',
    'Русский',
    'اردو',
  ]) {
    await expect(menu.getByRole('button', { name: native })).toBeVisible()
  }
  // Escape closes the menu without changing the language.
  await page.keyboard.press('Escape')
  await expect(menu).not.toBeVisible()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})

test('switching to Spanish translates the UI and survives a reload', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('button', { name: 'Español' }).click()

  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(
    page.getByRole('heading', { name: 'Tus producciones' }),
  ).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Crear proyecto' }),
  ).toBeVisible()

  // Stored like the theme: the choice survives a reload.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('lang', 'es')
  await expect(
    page.getByRole('heading', { name: 'Tus producciones' }),
  ).toBeVisible()

  // The stage labels translate too, inside a project.
  await page.getByLabel('New project title').fill('Prueba')
  await page.getByRole('button', { name: 'Crear proyecto' }).click()
  await page.getByRole('button', { name: 'Prueba' }).click()
  await expect(
    page.getByRole('heading', { name: 'Guion', exact: true }),
  ).toBeVisible()

  // Back to English from inside the project — everything returns.
  await page.getByRole('button', { name: 'Idioma' }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
  await expect(
    page.getByRole('heading', { name: 'Script', exact: true }),
  ).toBeVisible()
})

test('Arabic flips the document to right-to-left and back', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Language' }).click()
  await page.getByRole('button', { name: 'العربية' }).click()
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'إنتاجاتك' })).toBeVisible()

  // RTL survives a reload, and English restores LTR.
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await page.getByRole('button', { name: 'اللغة' }).click()
  await page.getByRole('button', { name: 'English' }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr')
  await expect(page.locator('html')).toHaveAttribute('lang', 'en')
})
