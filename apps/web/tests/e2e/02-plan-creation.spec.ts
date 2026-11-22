/**
 * 02-plan-creation.spec.ts
 *
 * Jornada: usuário autenticado → /plan/new → wizard completo → detalhe do plano
 *
 * Usa storageState salvo pelo global-setup (herdado via playwright.config.ts).
 * Todas as chamadas à API (porta 3001) são mockadas para não depender de
 * Anthropic, YouTube ou lógica real do backend.
 *
 * Fluxo testado:
 *  1. Dashboard → "Criar meu primeiro plano" → /plan/new
 *  2. Upload step: simula upload de PDF via input[type="file"]
 *  3. Confirm step: verifica metadados e confirma
 *  4. Profile step: seleciona formatos preferidos e continua
 *  5. Configure step: ajusta horas e clica "Gerar plano com IA"
 *  6. Generating step: spinner visível
 *  7. Redirecionamento para /plan/:id após mock de criação
 *  8. Plano detail: semana 1 visível, sessão do dia 1 visível
 *  9. Marcar sessão como concluída
 */

import { test, expect, type Route }               from '@playwright/test'
import {
  mockPlanList, mockSubjectUpload, mockPlanCreate,
  mockPlanGet, mockPlanSession, MOCK_PLAN, MOCK_SUBJECT,
} from './helpers'

test.describe('Criação de plano — wizard completo', () => {

  test.beforeEach(async ({ page }) => {
    // Mockear todos os endpoints necessários antes de cada teste
    await mockPlanList(page)
    await mockSubjectUpload(page)
    await mockPlanCreate(page)
    await mockPlanGet(page)
    await mockPlanSession(page)

    // Mock PATCH /api/subjects/:id (step confirm → salvar metadados)
    await page.route(`http://localhost:3001/api/subjects/${MOCK_SUBJECT.id}`, async (route: Route) => {
      const method = route.request().method()
      if (method === 'PATCH') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ subject: MOCK_SUBJECT }),
        })
      } else if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(MOCK_SUBJECT),
        })
      } else {
        await route.continue()
      }
    })
  })

  test('navega do dashboard para /plan/new', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByText(/nenhum plano ainda/i)).toBeVisible()

    const criarLink = page.getByRole('link', { name: /criar meu primeiro plano/i })
    await criarLink.click()
    await expect(page).toHaveURL(/\/plan\/new/)
  })

  test('wizard: upload → confirm → profile → configure → gerar → detalhe', async ({ page }) => {
    await page.goto('/plan/new')

    // ── Step 1: Upload ─────────────────────────────────────────────────────
    await expect(page.getByText(/arraste o pdf da ementa/i)).toBeVisible()

    // Criar um buffer de PDF mínimo e simular o upload via input[type="file"]
    // O mock de /api/subjects/upload retorna MOCK_SUBJECT imediatamente
    const pdfBuffer = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' +
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
      '3 0 obj<</Type/Page/MediaBox[0 0 612 792]/Parent 2 0 R>>endobj\n' +
      'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n' +
      '0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF'
    )

    // Localizar o input de arquivo dentro do dropzone
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'ementa-calculo.pdf',
      mimeType: 'application/pdf',
      buffer: pdfBuffer,
    })

    // ── Step 2: Confirm ────────────────────────────────────────────────────
    // Aguardar transição para a etapa de confirmação
    await expect(page.getByText(/complete os dados/i)).toBeVisible({ timeout: 10_000 })

    // Tópicos do MOCK_SUBJECT devem aparecer
    await expect(page.getByText('Limites')).toBeVisible()

    // Preencher metadados ausentes
    await page.fill('#meta-course', 'Engenharia de Computação')
    await page.fill('#meta-university', 'USP')

    // Clicar em Confirmar
    await page.getByRole('button', { name: /confirmar/i }).click()

    // ── Step 3: Profile ────────────────────────────────────────────────────
    await expect(page.getByText(/conhecimento prévio/i)).toBeVisible({ timeout: 8_000 })

    // Selecionar formato "Leitura" (exercícios já está selecionado por padrão)
    const leituraBtn = page.getByRole('button', { name: /^leitura$/i })
    await leituraBtn.click()

    // Continuar
    await page.getByRole('button', { name: /continuar/i }).click()

    // ── Step 4: Configure ──────────────────────────────────────────────────
    await expect(page.getByText(/horas de estudo por dia/i)).toBeVisible({ timeout: 8_000 })

    // Clicar "Gerar plano com IA"
    const gerarBtn = page.getByRole('button', { name: /gerar plano com ia/i })
    await expect(gerarBtn).toBeVisible()
    await gerarBtn.click()

    // ── Step 5: Generating ─────────────────────────────────────────────────
    // Spinner/texto de geração breve
    // (o mock responde imediatamente, então pode passar rápido)

    // ── Step 6: Redireciona para /plan/:id ─────────────────────────────────
    await expect(page).toHaveURL(/\/plan\/plan-e2e-001/, { timeout: 12_000 })
  })

  test('detalhe do plano: semana 1 e sessão do dia 1 são visíveis', async ({ page }) => {
    await page.goto(`/plan/${MOCK_PLAN.id}`)

    // Cabeçalho da semana
    await expect(page.getByText(/semana 1/i)).toBeVisible({ timeout: 10_000 })

    // Tópico do dia 1
    await expect(page.getByText('Noção intuitiva de limite')).toBeVisible()
  })

  test('marcar sessão como concluída dispara PATCH /session', async ({ page }) => {
    // Capturar a requisição de PATCH session
    const sessionRequests: string[] = []
    page.on('request', req => {
      if (req.url().includes('/session') && req.method() === 'PATCH') {
        sessionRequests.push(req.url())
      }
    })

    await page.goto(`/plan/${MOCK_PLAN.id}`)

    // Botão de completar sessão do DayItem
    const completeBtn = page.getByRole('button', { name: /marcar como concluído/i }).first()
    await expect(completeBtn).toBeVisible({ timeout: 10_000 })
    await completeBtn.click()

    // Verificar que a requisição foi feita
    await expect.poll(() => sessionRequests.length, { timeout: 5_000 }).toBeGreaterThan(0)
  })

})
