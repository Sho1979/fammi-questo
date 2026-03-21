/**
 * E2E: Navigation and route protection
 */
import { test, expect } from '@playwright/test'
import { clearAppData, quickSetup, setupAndLogin } from './helpers.js'

test.describe('Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await setupAndLogin(page)
  })

  test('navigates through all main tabs', async ({ page }) => {
    await expect(page).toHaveURL(/dashboard/)

    const nav = page.locator('nav')
    await nav.getByRole('button', { name: 'Calendario' }).click()
    await expect(page).toHaveURL(/calendar/)

    await nav.getByRole('button', { name: 'Task' }).click()
    await expect(page).toHaveURL(/tasks/)

    await nav.getByRole('button', { name: 'Dispensa' }).click()
    await expect(page).toHaveURL(/dispensa/)

    await nav.getByRole('button', { name: 'Spese' }).click()
    await expect(page).toHaveURL(/expenses/)

    await nav.getByRole('button', { name: 'Home' }).click()
    await expect(page).toHaveURL(/dashboard/)
  })

  test('pages render without errors', async ({ page }) => {
    const tabs = ['Calendario', 'Task', 'Dispensa', 'Spese']
    const nav = page.locator('nav')
    for (const tab of tabs) {
      await nav.getByRole('button', { name: tab }).click()
      // Page should render with visible main content
      await expect(page.locator('main')).toBeVisible()
      // No error boundary should appear
      await expect(page.getByText(/Something went wrong|Errore/)).not.toBeVisible()
    }
  })
})

test.describe('Protected routes', () => {
  test('redirects to setup when not configured', async ({ page }) => {
    await page.goto('/')
    await clearAppData(page)
    await page.reload()
    await expect(page).toHaveURL(/setup/)
  })

  test('redirects to login when not authenticated', async ({ page }) => {
    await quickSetup(page)
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/login/)
  })
})
