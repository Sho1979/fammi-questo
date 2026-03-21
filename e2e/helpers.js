/**
 * Shared E2E test helpers
 */

export async function clearAppData(page) {
  await page.evaluate(() => {
    localStorage.clear()
    sessionStorage.clear()
    indexedDB.deleteDatabase('FammiQuestoDB')
  })
}

/**
 * Run the full setup wizard with a minimal family:
 * - 1 parent (Cristian, PIN 1234)
 * - optionally 1 child (Viola, age 12, PIN 5678)
 * - No grandparents
 * - Local-only sync
 */
export async function quickSetup(page, { withChildren = true } = {}) {
  await page.goto('/')
  await clearAppData(page)
  await page.reload()
  await page.waitForURL('**/setup')

  // Step 1: Welcome
  await page.getByRole('button', { name: /Inizia/ }).click()

  // Step 2: Role + Name
  await page.getByText('Genitore / Adulto').click()
  await page.locator('input[placeholder="es. Marco"]').fill('Cristian')
  await page.getByRole('button', { name: /Avanti/ }).click()

  // Step 3: Family composition
  // The page has 3 sections: Genitori, Nonni, Figli
  // Each section has its own Sì/No toggle in a div.mb-6

  // Find all section containers
  const sections = page.locator('.mb-6')

  // Nonni section (second one) — click "No"
  // Use text-based approach: find the section that contains "Nonni" text
  const nonniNo = page.locator('text=Nonni').locator('..').locator('..').locator('button:has-text("No")')
  await nonniNo.click()

  if (withChildren) {
    // Figli section — click "Sì"
    const figliSi = page.locator('text=Figli').locator('..').locator('..').locator('button:has-text("Sì")')
    await figliSi.click()

    // Fill child name and age
    await page.locator('input[placeholder="Nome"]').first().fill('Viola')
    await page.locator('input[placeholder="Età"]').first().fill('12')
  } else {
    const figliNo = page.locator('text=Figli').locator('..').locator('..').locator('button:has-text("No")')
    await figliNo.click()
  }
  await page.getByRole('button', { name: /Avanti/ }).click()

  // Step 4: PIN
  const pinInputs = page.locator('input[type="password"]')
  await pinInputs.nth(0).fill('1234')
  await pinInputs.nth(1).fill('1234')
  if (withChildren) {
    await pinInputs.nth(2).fill('5678')
    await pinInputs.nth(3).fill('5678')
  }

  // Step 4 button is "Completa Setup ✓" (calls onNext internally)
  await page.getByRole('button', { name: /Completa Setup/ }).click()

  // Step 5: Permissions — defaults
  await page.getByRole('button', { name: /Avanti/ }).click()

  // Step 6: Sync — solo locale
  await page.getByText('Solo locale').click()
  await page.getByRole('button', { name: /Avanti/ }).click()

  // Step 7: Create
  await page.getByRole('button', { name: /Crea famiglia/ }).click()
  await page.waitForURL('**/login', { timeout: 15000 })
}

/**
 * Login as a member with a PIN via the numeric keypad
 */
export async function login(page, name, pin) {
  await page.goto('/login')
  // Wait for member list
  await page.waitForSelector('text=Chi sei?', { timeout: 5000 })
  await page.getByText(name).click()

  // Wait for PIN keypad
  await page.getByTestId('pin-dots').waitFor({ state: 'visible' })

  // Enter PIN digits
  for (const digit of pin) {
    await page.getByRole('button', { name: digit, exact: true }).click()
  }

  // Submit
  await page.getByRole('button', { name: /Entra/ }).click()
  await page.waitForURL('**/dashboard', { timeout: 15000 })
}

/**
 * Full setup + login as Cristian (parent)
 */
export async function setupAndLogin(page, opts) {
  await quickSetup(page, opts)
  await login(page, 'Cristian', '1234')
}
