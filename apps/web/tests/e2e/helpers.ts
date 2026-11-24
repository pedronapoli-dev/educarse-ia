/**
 * helpers.ts — Utilitários compartilhados para os testes E2E
 *
 * Fornece mocks de rota para interceptar chamadas à API (porta 3001)
 * sem atingir serviços reais (Anthropic, YouTube, etc.).
 */

import { type Page, type Route } from '@playwright/test'
import type { Subject, Plan, ScheduleWeek } from '@educarseia/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const MOCK_SUBJECT: Subject = {
  id: 'sub-e2e-001',
  user_id: 'user-placeholder',
  name: 'Cálculo I',
  code: 'MAT101',
  course: 'Engenharia',
  university: 'USP',
  workload_hours: 64,
  credits: 4,
  topics: ['Limites', 'Derivadas', 'Integrais'],
  prerequisites: ['Pré-Cálculo', 'Álgebra'],
  bibliography: ['Stewart, Cálculo Vol. 1'],
  source_type: 'pdf',
  created_at: new Date().toISOString(),
}

const MOCK_WEEK: ScheduleWeek = {
  week: 1,
  focus: 'Limites e Continuidade',
  module: 'Fundamentos',
  days: [
    {
      day: 1,
      topic: 'Noção intuitiva de limite',
      duration_minutes: 60,
      type: 'teoria',
      bloom_level: 'entender',
      scaffolding_level: 'alto',
      priority: 'alta',
      mastery_criteria: 'Calcular limites simples corretamente',
      tip: 'Desenhe o gráfico para visualizar o comportamento',
      completed: false,
    },
  ],
}

export const MOCK_PLAN: Plan = {
  id: 'plan-e2e-001',
  user_id: 'user-placeholder',
  subject_id: 'sub-e2e-001',
  title: 'Plano de Estudos — Cálculo I',
  status: 'active',
  hours_per_day: 2,
  days_per_week: 5,
  exam_date: null,
  total_weeks: 8,
  application_context: null,
  progress: 0,
  schedule: [MOCK_WEEK],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

const API = 'http://localhost:3001'

/** Mock POST /api/subjects/upload → retorna MOCK_SUBJECT */
export async function mockSubjectUpload(page: Page) {
  await page.route(`${API}/api/subjects/upload`, async (route: Route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ subject: MOCK_SUBJECT }),
    })
  })
}

/** Mock POST /api/subjects/text → retorna MOCK_SUBJECT */
export async function mockSubjectText(page: Page) {
  await page.route(`${API}/api/subjects/text`, async (route: Route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ subject: MOCK_SUBJECT }),
    })
  })
}

/** Mock GET /api/subjects/:id → retorna MOCK_SUBJECT */
export async function mockSubjectGet(page: Page, id = MOCK_SUBJECT.id) {
  await page.route(`${API}/api/subjects/${id}`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ subject: MOCK_SUBJECT }),
    })
  })
}

/** Mock POST /api/plans → retorna MOCK_PLAN; GET → lista vazia */
export async function mockPlanCreate(page: Page) {
  await page.route(`${API}/api/plans`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ plan: MOCK_PLAN }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plans: [] }),
      })
    }
  })
}

/** Mock GET /api/plans → lista de planos */
export async function mockPlanList(page: Page, plans: Plan[] = []) {
  await page.route(`${API}/api/plans`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plans }),
      })
    } else {
      await route.continue()
    }
  })
}

/** Mock GET /api/plans/:id → retorna MOCK_PLAN */
export async function mockPlanGet(page: Page, id = MOCK_PLAN.id) {
  await page.route(`${API}/api/plans/${id}`, async (route: Route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ plan: MOCK_PLAN }),
      })
    } else {
      await route.continue()
    }
  })
}

/** Mock PATCH /api/plans/:id/session → 200 OK */
export async function mockPlanSession(page: Page, id = MOCK_PLAN.id) {
  await page.route(`${API}/api/plans/${id}/session`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true }),
    })
  })
}

/**
 * Mock POST /api/plans → 402 LimitedResponse (2/2 planos do free tier atingidos).
 * GET → retorna 2 planos existentes.
 */
export async function mockPlanLimitReached(page: Page) {
  await page.route(`${API}/api/plans`, async (route: Route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 402,
        contentType: 'application/json',
        body: JSON.stringify({
          limited: true,
          upgrade_url: '/planos',
          usage: { used: 2, max: 2, percent: 100 },
        }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          plans: [
            { ...MOCK_PLAN, id: 'plan-e2e-A' },
            { ...MOCK_PLAN, id: 'plan-e2e-B' },
          ],
        }),
      })
    }
  })
}

/** Mock POST /api/checkout → retorna URL de checkout Stripe */
export async function mockCheckout(page: Page) {
  await page.route(`${API}/api/checkout`, async (route: Route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ url: 'https://checkout.stripe.com/pay/test_mock_session' }),
    })
  })
}
