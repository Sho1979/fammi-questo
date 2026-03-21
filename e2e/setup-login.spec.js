/**
 * E2E: Setup Wizard → Login → Dashboard
 */
import { test, expect } from '@playwright/test'
import { clearAppData, quickSetup, login } from './helpers.js'

test.describe('Setup Wizard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await clearAppData(page)
    await page.reload()
    await page.waitForURL('**/setup')
  })

  test('completes wizard and reaches login', async ({ page }) => {
    // Step 1: Welcome
    await expect(page.getByText('Fammi Questo')).toBeVisible()
    await page.getByRole('button', { name: /Inizia/ }).click()

    // Step 2: Role + Name
    await expect(page.getByText('Di chi è questo telefono?')).toBeVisible()
    await page.getByText('Genitore / Adulto').click()
    await page.locator('input[placeholder="es. Marco"]').fill('Cristian')
    await page.getByRole('button', { name: /Avanti/ }).click()

    // Step 3: Family — no grandparents, 1 child
    await expect(page.getByText('La tua famiglia')).toBeVisible()
    await page.locator('text=Nonni').locator('..').locator('..').locator('button:has-text("No")').click()
    await page.locator('text=Figli').locator('..').locator('..').locator('button:has-text("Sì")').click()
    await page.locator('input[placeholder="Nome"]').fill('Viola')
    await page.locator('input[placeholder="Età"]').fill('12')
    await page.getByRole('button', { name: /Avanti/ }).click()

    // Step 4: PIN
    await expect(page.getByText('Crea i PIN')).toBeVisible()
    const pinInputs = page.locator('input[type="password"]')
    await pinInputs.nth(0).fill('1234')
    await pinInputs.nth(1).fill('1234')
    await pinInputs.nth(2).fill('5678')
    await pinInputs.nth(3).fill('5678')
    await page.getByRole('button', { name: /Completa Setup/ }).click()

    // Step 5: Permissions
    await page.getByRole('button', { name: /Avanti/ }).click()

    // Step 6: Sync
    await page.getByText('Solo locale').click()
    await page.getByRole('button', { name: /Avanti/ }).click()

    // Step 7: Confirm
    await expect(page.getByText('Tutto pronto!')).toBeVisible()
    await expect(page.getByText('Cristian')).toBeVisible()
    await expect(page.getByText('Viola')).toBeVisible()
    await page.getByRole('button', { name: /Crea famiglia/ }).click()

    await page.waitForURL('**/login', { timeout: 15000 })
    await expect(page.getByText('Chi sei?')).toBeVisible()
  })
})

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await quickSetup(page)
  })

  test('enters correct PIN and reaches dashboard', async ({ page }) => {
    await login(page, 'Cristian', '1234')
    await expect(page).toHaveURL(/dashboard/)
  })

  test('shows error on wrong PIN', async ({ page }) => {
    await page.goto('/login')
    await page.getByText('Cristian').click()
    await page.getByTestId('pin-dots').waitFor({ state: 'visible' })

    for (const d of '9999') {
      await page.getByRole('button', { name: d, exact: true }).click()
    }
    await page.getByRole('button', { name: /Entra/ }).click()

    await expect(page.getByText(/PIN errato/)).toBeVisible({ timeout: 5000 })
  })
})
