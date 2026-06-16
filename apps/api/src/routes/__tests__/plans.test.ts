/**
 * Integration tests for apps/api/src/routes/plans.ts
 *
 * Testa o wiring de POST / com checkPlansLimit (resposta 402 + LimitedResponse)
 * e o caminho de sucesso (201), GET / (lista com join de subjects), GET /:id
 * (detalhe + 404 cross-user), PATCH /:id/session (completeSession) e
 * DELETE /:id — mockando supabase com um builder encadeável genérico
 * (select/insert/update/delete/eq/order, single() e await via fila de
 * resultados), lib/limits e planService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'

// ── Mocks ──────────────────────────────────────────────────────────────────

const {
  mockFrom, queueResult,
  mockCheckPlansLimit, mockGenerateAndSavePlan, mockCompleteSession,
} = vi.hoisted(() => {
  type Result = { data: unknown; error: unknown }
  const queue: Result[] = []
  const next = (): Result => queue.shift() ?? { data: null, error: null }

  const raw: Record<string, unknown> = {}
  for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    raw[name] = vi.fn(() => raw)
  }
  raw.single = vi.fn(() => Promise.resolve(next()))
  raw.then = (onFulfilled?: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(onFulfilled, onRejected)

  return {
    mockFrom:    vi.fn(() => raw),
    queueResult: (result: Result) => { queue.push(result) },
    mockCheckPlansLimit:     vi.fn(),
    mockGenerateAndSavePlan: vi.fn(),
    mockCompleteSession:     vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../../lib/limits', () => ({
  checkPlansLimit: mockCheckPlansLimit,
}))

vi.mock('../../services/planService', () => ({
  generateAndSavePlan: mockGenerateAndSavePlan,
  completeSession:     mockCompleteSession,
}))

// ── Imports após mock ─────────────────────────────────────────────────────

import { plansRoutes } from '../plans'

const TEST_USER_ID = 'user-1'

const buildApp = async () => {
  const app = Fastify()
  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.user = { sub: TEST_USER_ID }
  })
  await app.register(plansRoutes, { prefix: '/api/plans' })
  await app.ready()
  return app
}

const VALID_BODY = {
  subject_id:    'subject-1',
  hours_per_day: 2,
  days_per_week: 5,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/plans', () => {
  it('retorna 402 com LimitedResponse quando o limite de planos foi atingido', async () => {
    queueResult({ data: { plan: 'free', plans_count: 2 }, error: null })
    mockCheckPlansLimit.mockResolvedValueOnce({
      allowed: false,
      limited: { limited: true, upgrade_url: '/planos', usage: { used: 2, max: 2, percent: 100 } },
    })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/plans', payload: VALID_BODY })

    expect(res.statusCode).toBe(402)
    expect(res.json()).toEqual({
      limited: true,
      upgrade_url: '/planos',
      usage: { used: 2, max: 2, percent: 100 },
    })
    expect(mockGenerateAndSavePlan).not.toHaveBeenCalled()
  })

  it('retorna 201 com o plano gerado quando dentro do limite', async () => {
    queueResult({ data: { plan: 'free', plans_count: 1 }, error: null })
    mockCheckPlansLimit.mockResolvedValueOnce({ allowed: true })
    mockGenerateAndSavePlan.mockResolvedValueOnce({ id: 'plan-1', title: 'Plano de teste' })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/plans', payload: VALID_BODY })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ plan: { id: 'plan-1', title: 'Plano de teste' } })
    expect(mockGenerateAndSavePlan).toHaveBeenCalledWith(
      expect.objectContaining({ userId: TEST_USER_ID, subjectId: 'subject-1' })
    )
  })
})

describe('GET /api/plans', () => {
  it('retorna 200 com a lista de planos do usuário, incluindo a ementa relacionada', async () => {
    queueResult({
      data: [{ id: 'plan-1', title: 'Plano 1', status: 'active', progress: 10, total_weeks: 5, exam_date: null, created_at: '2026-06-01', subjects: { id: 'subject-1', name: 'Cálculo I', code: 'MAT101' } }],
      error: null,
    })

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/plans' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      plans: [{ id: 'plan-1', title: 'Plano 1', status: 'active', progress: 10, total_weeks: 5, exam_date: null, created_at: '2026-06-01', subjects: { id: 'subject-1', name: 'Cálculo I', code: 'MAT101' } }],
    })
    expect(mockFrom).toHaveBeenCalledWith('plans')
  })
})

describe('GET /api/plans/:id', () => {
  it('retorna 200 com o plano e a ementa relacionada (subjects *)', async () => {
    queueResult({ data: { id: 'plan-1', title: 'Plano 1', subjects: { id: 'subject-1', name: 'Cálculo I' } }, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/plans/plan-1' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ plan: { id: 'plan-1', title: 'Plano 1', subjects: { id: 'subject-1', name: 'Cálculo I' } } })
  })

  it('retorna 404 quando o plano não existe ou não pertence ao usuário', async () => {
    queueResult({ data: null, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/plans/outro-id' })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Plano não encontrado' })
  })
})

describe('PATCH /api/plans/:id/session', () => {
  it('retorna 200 e chama completeSession com userId, planId, week, day e duration_actual', async () => {
    mockCompleteSession.mockResolvedValueOnce(undefined)

    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/plans/plan-1/session',
      payload: { week: 2, day: 3, duration_actual: 90 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
    expect(mockCompleteSession).toHaveBeenCalledWith(TEST_USER_ID, 'plan-1', 2, 3, 90)
  })

  it('retorna 400 quando week ou day não são inteiros', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/plans/plan-1/session',
      payload: { week: 'dois', day: 3 },
    })

    expect(res.statusCode).toBe(400)
    expect(mockCompleteSession).not.toHaveBeenCalled()
  })
})

describe('DELETE /api/plans/:id', () => {
  it('retorna 204 ao excluir o plano do usuário', async () => {
    queueResult({ data: null, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/plans/plan-1' })

    expect(res.statusCode).toBe(204)
    expect(mockFrom).toHaveBeenCalledWith('plans')
  })
})
