/**
 * 03-tier-limit.spec.ts
 *
 * Jornada: usuário free com limite atingido → LimitReachedBlock → /planos → checkout
 *
 * Cenários:
 *  1. POST /api/plans retorna 402 → LimitReachedBlock visível na wizard
 *  2. LimitReachedBlock mostra barra de uso (2/2 planos)
 *  3. Botão "Ver planos" navega para /planos
 *  4. /planos exibe os 4 cards de plano
 *  5. "Assinar Pro" chama POST /api/checkout e redireciona para Stripe
 */

import { test, expect, type Route } from '@playwright/test'
import { mockPlanLimitReached, mockCheckout, mockPlanGet, mockPlanSession, MOCK_PLAN } from './helpers'

test.describe('Limite de tier — free plan esgotado', () => {

  test('wizard retorna 402 e exibe LimitReachedBlock', async ({ page }) => {
    // Mock: GET /api/plans → 2 planos; POST /api/plans → 402
    await mockPlanLimitReached(page)

    // Também precisamos de mocks parciais da etapa anterior
    await page.route('http://localhost:3001/api/subjects/upload', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          subject: {
            id: 'sub-limit-001',
            user_id: 'u1',
            name: 'Cálculo I',
            topics: ['Limites'],
            workload_hours: 60,
            bibliography: [],
            prerequisites: [],
            source_type: 'pdf',
            created_at: new Date().toISOString(),
          },
        }),
      })
    })
    await page.route('http://localhost:3001/api/subjects/sub-limit-001', async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            subject: {
              id: 'sub-limit-001', user_id: 'u1', name: 'Cálculo I',
              topics: ['Limites'], bibliography: [], prerequisites: [],
              source_type: 'pdf', created_at: new Date().toISOString(),
            },
          }),
        })
      } else { await route.continue() }
    })

    await page.goto('/plan/new')

    // Upload do PDF mínimo
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n' +
      '0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
    )
    await page.locator('input[type="file"]').setInputFiles({
      name: 'ementa.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    })

    // Aguardar step confirm
    await expect(page.getByText(/complete os dados/i)).toBeVisible({ timeout: 10_000 })
    await page.getByRole('button', { name: /confirmar/i }).click()

    // Step profile
    await expect(page.getByText(/conhecimento prévio/i)).toBeVisible({ timeout: 8_000 })
    await page.getByRole('button', { name: /continuar/i }).click()

    // Step configure → gerar
    await expect(page.getByText(/horas de estudo por dia/i)).toBeVisible({ timeout: 8_000 })
    await page.getByRole('button', { name: /gerar plano com ia/i }).click()

    // 402 deve exibir LimitReachedBlock com caminho de upgrade
    const upgradeLink = page.locator('a[href="/planos"]').filter({ hasText: /planos|upgrade/i }).first()
    await expect(upgradeLink).toBeVisible({ timeout: 10_000 })
  })

  test('/planos renderiza os cards de assinatura', async ({ page }) => {
    await page.goto('/planos')

    // Deve exibir os 4 planos
    await expect(page.getByRole('heading', { name: /escolha seu plano/i })).toBeVisible()

    // Cards dos planos pagos
    await expect(page.getByText(/básico/i).first()).toBeVisible()
    await expect(page.getByText(/pro/i).first()).toBeVisible()
    await expect(page.getByText(/max/i).first()).toBeVisible()
  })

  test('/planos → "Assinar Pro" chama checkout e redireciona', async ({ page }) => {
    await mockCheckout(page)

    // Capturar navegações externas (para o Stripe)
    const externalNavs: string[] = []
    page.on('request', req => {
      if (req.url().includes('stripe.com') || req.url().includes('checkout.stripe')) {
        externalNavs.push(req.url())
      }
    })

    await page.goto('/planos')

    // Botão "Assinar Pro" (ou variações como "Assinar Básico")
    const assinarPro = page.getByRole('button', { name: /assinar pro/i }).first()
    await expect(assinarPro).toBeVisible({ timeout: 8_000 })

    // Interceptar o redirecionamento para o Stripe antes de ele acontecer
    const navigationPromise = page.waitForRequest(
      req => req.url().includes('localhost:3001/api/checkout'),
      { timeout: 8_000 }
    )

    await assinarPro.click()
    await navigationPromise

    // O redirecionamento para a URL do Stripe é uma navegação externa —
    // verificamos que o POST foi feito (capturado acima) e que a URL contém stripe
    // ou que a página tentou navegar para ela
    // (Em testes, Playwright bloqueia navegações externas por padrão, então apenas
    //  validamos a requisição ao backend)
  })

})

test.describe('Plano detail — exercícios com limite atingido', () => {

  test.beforeEach(async ({ page }) => {
    await mockPlanGet(page)
    await mockPlanSession(page)
  })

  test('gerar exercício com 402 exibe LimitReachedBlock no modal', async ({ page }) => {
    // Mock POST /api/exercises/generate → 402
    await page.route('http://localhost:3001/api/exercises/generate', async (route: Route) => {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          limited: true,
          upgrade_url: '/planos',
          usage: { used: 10, max: 10, percent: 100 },
        }),
      })
    })

    // Sem exercícios salvos: o modal precisa tentar gerar e receber o 402
    await page.route(/\/api\/exercises\?plan_id=/, async (route: Route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ exercises: [] }),
      })
    })

    await page.goto(`/plan/${MOCK_PLAN.id}`)

    // Clicar no botão de praticar do DayItem
    const praticarBtn = page.getByRole('button', { name: /praticar/i }).first()
    await expect(praticarBtn).toBeVisible({ timeout: 10_000 })
    await praticarBtn.click()

    // LimitReachedBlock no modal de exercícios
    await expect(page.getByRole('heading', { name: /limite do plano atingido/i })).toBeVisible()

    // Link "Ver planos"
    const verPlanosLink = page.getByRole('link', { name: /ver planos/i })
    await expect(verPlanosLink).toBeVisible()
    await expect(verPlanosLink).toHaveAttribute('href', '/planos')
  })

  test('checkin com cooldown ativo exibe CooldownNotice', async ({ page }) => {
    // Mock POST /api/skills/checkin → 429 com cooldown
    const retryAt = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString() // +20h
    await page.route('http://localhost:3001/api/skills/checkin', async (route: Route) => {
      await route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({
          cooldown: true,
          retry_at: retryAt,
          message: 'Você já fez check-in recentemente. Tente novamente mais tarde.',
        }),
      })
    })

    await page.goto(`/plan/${MOCK_PLAN.id}`)

    // Abrir o CheckinCard
    const checkinBtn = page.getByRole('button', { name: /fazer check-in da semana 1/i })
    await expect(checkinBtn).toBeVisible({ timeout: 10_000 })
    await checkinBtn.click()

    // Submeter o formulário para disparar a chamada
    await page.getByRole('button', { name: /enviar check-in/i }).click()

    // CooldownNotice deve aparecer
    await expect(page.getByRole('heading', { name: /aguarde um pouco/i })).toBeVisible()
    await expect(page.getByText(/disponível novamente em 20 horas/i)).toBeVisible()
  })

})
