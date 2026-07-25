import { test } from '@playwright/test'

test('debug — capturar errores de consola', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`)
  })
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))

  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'e2e/screenshots/debug-landing.png', fullPage: true })

  console.log('=== CONSOLE ERRORS ===')
  errors.forEach(e => console.log(e))
  console.log('=== END ERRORS ===')
  console.log('Total errors:', errors.length)
})

test('debug — login page con errores', async ({ page }) => {
  const errors: string[] = []
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`CONSOLE ERROR: ${msg.text()}`)
  })
  page.on('pageerror', err => errors.push(`PAGE ERROR: ${err.message}`))

  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'e2e/screenshots/debug-login.png', fullPage: true })

  // Intentar llenar el formulario
  const emailInput = page.locator('input[type="email"]')
  const exists = await emailInput.count()
  console.log('Email input count:', exists)

  console.log('=== CONSOLE ERRORS ===')
  errors.forEach(e => console.log(e))
  console.log('Total errors:', errors.length)
})
