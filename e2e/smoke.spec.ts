import { test, expect } from '@playwright/test'

test('smoke — frontend carga React', async ({ page }) => {
  // Esperar solo a que el DOM esté listo, no network idle
  await page.goto('http://localhost:5173', { waitUntil: 'domcontentloaded', timeout: 30000 })
  // Esperar a que React monte (cualquier elemento significativo)
  await page.waitForTimeout(5000)
  // Screenshot para ver qué hay
  await page.screenshot({ path: 'e2e/screenshots/smoke.png', fullPage: true })
  // Verificar el título
  const title = await page.title()
  console.log('Page title:', title)
  // Obtener todo el texto visible
  const text = await page.locator('body').innerText()
  console.log('Body text (first 500 chars):', text.substring(0, 500))
  expect(title).toBeTruthy()
})

test('smoke — login page renders', async ({ page }) => {
  await page.goto('http://localhost:5173/login', { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'e2e/screenshots/login.png', fullPage: true })
  const text = await page.locator('body').innerText()
  console.log('Login body text (first 500 chars):', text.substring(0, 500))
})
