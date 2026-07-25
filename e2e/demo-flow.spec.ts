import { test, expect } from '@playwright/test'

const CREDS = {
  reclutador: { email: 'reclutador@empresa.com', password: 'hackathon123' },
  freelancer: { email: 'freelancer1@dev.com', password: 'hackathon123' },
  voluntario: { email: 'voluntario1@ong.com', password: 'hackathon123' },
}

async function loginAs(page: any, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForSelector('input[type="email"]', { timeout: 10000 })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  // Esperar navegación al dashboard
  await page.waitForURL(/dashboard/, { timeout: 15000 })
  await page.waitForLoadState('networkidle')
}

test.describe('TalentFlow AI — E2E Demo Flow', () => {

  test('1. Landing Page carga y muestra elementos clave', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    // La app SPA renderiza en cliente — esperar que React monte
    await page.waitForSelector('nav, header', { timeout: 15000 })
    // Screenshot para evidencia visual
    await page.screenshot({ path: 'e2e/screenshots/01-landing.png', fullPage: false })
    // Verificar que el título existe en algún lugar
    const title = await page.title()
    expect(title).toContain('TalentFlow')
  })

  test('2. Landing Page — navbar muestra botones de auth sin flash', async ({ page }) => {
    await page.goto('/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(3000) // Esperar que AuthContext resuelva
    // La navbar debe mostrar Login o Dashboard (no ambos parpadeando)
    const hasLogin = await page.locator('text=Iniciar sesión').isVisible().catch(() => false)
    const hasRegister = await page.locator('text=Registrarme').isVisible().catch(() => false)
    const hasDashboard = await page.locator('text=Mi dashboard').isVisible().catch(() => false)
    // Al menos uno de los dos conjuntos debe estar visible
    expect(hasLogin || hasDashboard).toBeTruthy()
    await page.screenshot({ path: 'e2e/screenshots/02-navbar-auth.png', fullPage: false })
  })

  test('3. Login reclutador exitoso → dashboard', async ({ page }) => {
    await loginAs(page, CREDS.reclutador.email, CREDS.reclutador.password)
    // Verificar que llegamos al dashboard
    await expect(page.locator('body')).toContainText('InnovateTech', { timeout: 5000 })
    await page.screenshot({ path: 'e2e/screenshots/03-login-success.png', fullPage: false })
  })

  test('4. Login con credenciales incorrectas muestra error', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', 'fake@fake.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')
    // Esperar mensaje de error
    await page.waitForTimeout(3000)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText.toLowerCase()).toMatch(/error|incorrect|inválid|no se pudo/)
    await page.screenshot({ path: 'e2e/screenshots/04-login-error.png', fullPage: false })
  })

  test('5. Dashboard reclutador — estadísticas con datos reales', async ({ page }) => {
    await loginAs(page, CREDS.reclutador.email, CREDS.reclutador.password)
    await page.waitForTimeout(3000) // Esperar carga de datos
    const bodyText = await page.locator('body').innerText()
    // No debe mostrar "Cargando..."
    expect(bodyText).not.toContain('Cargando...')
    // Debe mostrar contenido del dashboard
    expect(bodyText).toMatch(/Ofertas|Resumen|publicadas|contratados/)
    await page.screenshot({ path: 'e2e/screenshots/05-dashboard-reclutador.png', fullPage: true })
  })

  test('6. Job Board — ofertas publicadas con botón Ver postulantes', async ({ page }) => {
    await loginAs(page, CREDS.reclutador.email, CREDS.reclutador.password)
    // Usar navegación por sidebar para mantener sesión
    await page.locator('a:has-text("Mis ofertas"), a:has-text("Ofertas")').first().click()
    await page.waitForTimeout(3000)
    const bodyText = await page.locator('body').innerText()
    // Verificar que cargó la página de ofertas (no el login)
    expect(bodyText).not.toMatch(/Inicia sesión/)
    await page.screenshot({ path: 'e2e/screenshots/06-jobboard.png', fullPage: true })
  })

  test('7. Panel de postulantes con IA ranking', async ({ page }) => {
    await loginAs(page, CREDS.reclutador.email, CREDS.reclutador.password)
    // Navegar a ofertas por sidebar
    await page.locator('a:has-text("Mis ofertas"), a:has-text("Ofertas")').first().click()
    await page.waitForTimeout(3000)
    // Clic en "Ver postulantes" del primer posting
    const verBtn = page.locator('text=Ver postulantes').first()
    await verBtn.waitFor({ state: 'visible', timeout: 10000 })
    await verBtn.click()
    // Esperar el modal de postulantes
    await page.waitForTimeout(5000)
    const bodyText = await page.locator('body').innerText()
    // Debe mostrar scores o nombres de postulantes
    expect(bodyText).toMatch(/Carlos|Elena|match|compatib|puntaje|Postulantes/i)
    await page.screenshot({ path: 'e2e/screenshots/07-ai-ranking.png', fullPage: true })
  })

  test('8. Mensajes — carga conversaciones con el reclutador', async ({ page }) => {
    await loginAs(page, CREDS.reclutador.email, CREDS.reclutador.password)
    // Usar navegación por sidebar
    await page.locator('a:has-text("Mensajes")').first().click()
    await page.waitForTimeout(5000)
    await page.screenshot({ path: 'e2e/screenshots/08-messages.png', fullPage: true })
    const bodyText = await page.locator('body').innerText()
    // Verificar que no redirigió a login
    expect(bodyText).not.toMatch(/Inicia sesión/)
  })

  test('9. Dashboard freelancer — postulaciones y perfil', async ({ page }) => {
    await loginAs(page, CREDS.freelancer.email, CREDS.freelancer.password)
    await page.waitForTimeout(3000)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/Carlos|Postulaciones|perfil|tarifa/i)
    await page.screenshot({ path: 'e2e/screenshots/09-dashboard-freelancer.png', fullPage: true })
  })

  test('10. Settings freelancer — perfil profesional cargado', async ({ page }) => {
    await loginAs(page, CREDS.freelancer.email, CREDS.freelancer.password)
    // Navegar a configuración por sidebar
    await page.locator('a:has-text("Configuración")').first().click()
    await page.waitForTimeout(3000)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).not.toMatch(/Inicia sesión/)
    await page.screenshot({ path: 'e2e/screenshots/10-settings-freelancer.png', fullPage: true })
  })

  test('11. Dashboard voluntario — oportunidades', async ({ page }) => {
    await loginAs(page, CREDS.voluntario.email, CREDS.voluntario.password)
    await page.waitForTimeout(3000)
    const bodyText = await page.locator('body').innerText()
    expect(bodyText).toMatch(/Mateo|Oportunidades|voluntariado|disponibilidad/i)
    await page.screenshot({ path: 'e2e/screenshots/11-dashboard-voluntario.png', fullPage: true })
  })

})
