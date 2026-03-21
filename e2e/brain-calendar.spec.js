/**
 * E2E: Brain Input → Action Creation
 *
 * Tests the core flow: type natural language → Brain parses → record created
 */
import { test, expect } from '@playwright/test'
import { setupAndLogin } from './helpers.js'

test.describe('Brain → Actions', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndLogin(page)
    // Wait for NLP model to initialize
    await page.waitForTimeout(3000)
  })

  test('creates calendar event via natural language', async ({ page }) => {
    const textarea = page.locator('textarea[maxlength="500"]')
    await expect(textarea).toBeVisible()
    await textarea.fill('Domani Viola ha danza alle 17')
    await page.getByRole('button', { name: /Invia/ }).click()

    // Wait for Brain confirmation sheet
    await expect(page.getByText('Anteprima')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /Conferma/ }).click()

    // Wait for sheet to close
    await page.waitForTimeout(1000)

    // Navigate to calendar
    await page.locator('nav').getByRole('button', { name: 'Calendario' }).click()
    await expect(page).toHaveURL(/calendar/)

    // Should show the event
    await expect(page.getByText('Danza Viola')).toBeVisible({ timeout: 5000 })
  })

  test('creates expense via natural language', async ({ page }) => {
    const textarea = page.locator('textarea[maxlength="500"]')
    await textarea.fill('Ho speso 45 euro al supermercato')
    await page.getByRole('button', { name: /Invia/ }).click()

    await expect(page.getByText('Anteprima')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /Conferma/ }).click()
    await page.waitForTimeout(1000)

    await page.locator('nav').getByRole('button', { name: 'Spese' }).click()
    await expect(page).toHaveURL(/expenses/)
    await expect(page.getByText('45,00 €').first()).toBeVisible({ timeout: 5000 })
  })

  test('creates task via natural language', async ({ page }) => {
    const textarea = page.locator('textarea[maxlength="500"]')
    await textarea.fill('Viola pulisci la tua camera')
    await page.getByRole('button', { name: /Invia/ }).click()

    await expect(page.getByText('Anteprima')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /Conferma/ }).click()
    await page.waitForTimeout(1000)

    await page.locator('nav').getByRole('button', { name: 'Task' }).click()
    await expect(page).toHaveURL(/tasks/)
    await expect(page.getByText('Pulisci la tua camera', { exact: true })).toBeVisible({ timeout: 5000 })
  })
})
