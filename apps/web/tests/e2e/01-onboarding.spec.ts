/**
 * 01-onboarding.spec.ts
 *
 * Jornada: novo usuário → landing → login → dashboard vazio
 *
 * NÃO usa storageState (testa o fluxo de auth em si).
 * O usuário foi criado em global-setup.ts e as credenciais estão em
 * process.env.E2E_USER_EMAIL / E2E_USER_PASSWORD.
 *
 * Cenários:
 *  - Landing page renderiza sem erros
 *  - Link "Entrar" abre /login
 *  - Login com credenciais incorretas mostra erro
 *  - Login com credenciais corretas redireciona para /dashboard
 *  - Dashboard vazio exibe CTA "Criar meu primeiro plano"
 */

import { test, expect } from '@playwright/test'
import { mockPlanList }  from './helpers'

// Este arquivo NÃO herda storageState — explicitamente sobrescreve para auth limpo
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Onboarding — novo usuário', () => {

  test('landing page carrega e exibe CTA principal', async ({ page }) => {
    await page.goto('/')

    // Título da landing (h1 com font-display)
    await expect(page.locator('h1').first()).toBeVisible()

    // Botão CTA principal
    const cta = page.getByRole('link', { name: /começar grátis/i })
    await expect(cta).toBeVisible()

    // Link de login no header
    const loginLink = page.getByRole('link', { name: /entrar/i })
    await expect(loginLink).toBeVisible()
  })

  test('link "Entrar" navega para /login', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: /entrar/i }).click()
    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('#email')).toBeVisible()
    await expect(page.locator('#password')).toBeVisible()
  })

  test('login com senha incorreta exibe mensagem de erro', async ({ page }) => {
    await page.goto('/login')

    await page.fill('#email', process.env.E2E_USER_EMAIL ?? 'test@test.com')
    await page.fill('#password', 'senha-errada-123')
    await page.click('button[type="submit"]')

    // Aguardar feedback de erro (mensagem no formulário ou sonner toast)
    const errorMsg = page
      .locator('text=/inválid|incorret|erro|invalid|unauthorized/i')
      .first()
    await expect(errorMsg).toBeVisible({ timeout: 8_000 })

    // Continua na página de login
    await expect(page).toHaveURL(/\/login/)
  })

  test('login com credenciais corretas redireciona para /dashboard', async ({ page }) => {
    await page.goto('/login')

    const email    = process.env.E2E_USER_EMAIL    ?? ''
    const password = process.env.E2E_USER_PASSWORD ?? ''

    expect(email).toBeTruthy()
    expect(password).toBeTruthy()

    await mockPlanList(page) // Dashboard tentará GET /api/plans

    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')

    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })
  })

  test('dashboard vazio exibe estado "Nenhum plano ainda"', async ({ page }) => {
    // Reutiliza o login bem-sucedido do teste anterior via navegação direta
    const email    = process.env.E2E_USER_EMAIL    ?? ''
    const password = process.env.E2E_USER_PASSWORD ?? ''

    await mockPlanList(page) // sem planos

    await page.goto('/login')
    await page.fill('#email', email)
    await page.fill('#password', password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 })

    // Empty state
    await expect(page.getByText(/nenhum plano ainda/i)).toBeVisible()

    // CTA do empty state
    const criarBtn = page.getByRole('link', { name: /criar meu primeiro plano/i })
    await expect(criarBtn).toBeVisible()
    await expect(criarBtn).toHaveAttribute('href', '/plan/new')
  })

  test('link "Voltar para o início" na /login navega para /', async ({ page }) => {
    await page.goto('/login')
    const voltarLink = page.getByRole('link', { name: /voltar para o início/i })
    await expect(voltarLink).toBeVisible()
    await voltarLink.click()
    await expect(page).toHaveURL('/')
  })

})
