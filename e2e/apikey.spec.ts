import { expect, test } from '@playwright/test'

const BALANCE_URL = 'https://nano-gpt.com/api/check-balance'

test('API key flow: onboarding → validate → balance → survives reload → remove', async ({
  page,
}) => {
  // All NanoGPT calls are mocked — tests never spend real money.
  await page.route(BALANCE_URL, async (route) => {
    await route.fulfill({ json: { usd_balance: '12.34' } })
  })

  await page.goto('/')

  // Onboarding banner points to settings.
  await expect(page.getByText(/needs your NanoGPT API key/)).toBeVisible()
  await page.getByRole('button', { name: 'Set up your key' }).click()

  // Referral link is present for keyless users.
  const referral = page.getByRole('link', { name: /Create a NanoGPT account/ })
  await expect(referral).toHaveAttribute(
    'href',
    'https://nano-gpt.com/r/BnfJfghE',
  )

  // Paste and validate a key.
  await page.getByLabel('NanoGPT API key').fill('e2e-test-key-9876')
  await page.getByRole('button', { name: 'Validate & save' }).click()
  await expect(page.getByText('••••9876')).toBeVisible()
  await expect(page.getByLabel('NanoGPT balance')).toHaveText('Balance: $12.34')

  // Key survives a reload (localStorage) and balance refreshes.
  await page.reload()
  await expect(page.getByLabel('NanoGPT balance')).toHaveText('Balance: $12.34')
  await expect(page.getByText(/needs your NanoGPT API key/)).not.toBeVisible()

  // Account usage loads on demand.
  await page.route('https://nano-gpt.com/api/v1/usage**', (route) =>
    route.fulfill({
      json: { object: 'usage', totals: { requests: 42, netCostUsd: 3.21 } },
    }),
  )
  await page.getByRole('button', { name: 'Settings' }).click()
  await page.getByRole('button', { name: 'Load usage' }).click()
  await expect(page.getByLabel('Account usage totals')).toContainText(
    '42 requests, $3.21 net spend',
  )
  await page.getByRole('button', { name: 'Back to projects' }).click()

  // Remove the key.
  await page.getByRole('button', { name: 'Settings' }).click()
  await page
    .getByRole('button', { name: 'Remove key from this device' })
    .click()
  await expect(page.getByLabel('NanoGPT API key')).toBeVisible()
  await page.getByRole('button', { name: 'Back to projects' }).click()
  await expect(page.getByText(/needs your NanoGPT API key/)).toBeVisible()
})

test('an invalid key shows an error and is not stored', async ({ page }) => {
  await page.route(BALANCE_URL, async (route) => {
    await route.fulfill({ status: 401, json: { message: 'bad key' } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Set up your key' }).click()
  await page.getByLabel('NanoGPT API key').fill('wrong-key')
  await page.getByRole('button', { name: 'Validate & save' }).click()
  await expect(page.getByRole('alert')).toHaveText(/rejected this key/)

  await page.reload()
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByLabel('NanoGPT API key')).toBeVisible()
})
