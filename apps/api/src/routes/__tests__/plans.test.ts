/**
 * Integration tests for POST /api/plans (apps/api/src/routes/plans.ts)
 *
 * Testa o wiring da rota com checkPlansLimit (resposta 402 + LimitedResponse)
 * e o caminho de sucesso (201), mockando supabase, lib/limits e planService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockSingle, mockEq, mockSelect, mockFrom, mockCheckPlansLimit, mockGenerateAndSavePlan } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq     = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom   = vi.fn(() => ({ select: mockSelect }))
  return {
    mockSingle, mockEq, mockSelect, mockFrom,
    mockCheckPlansLimit:     vi.fn(),
    mockGenerateAndSavePlan: vi.fn(),
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
  completeSession:     vi.fn(),
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
    mockSingle.mockResolvedValueOnce({ data: { plan: 'free', plans_count: 2 }, error: null })
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
    mockSingle.mockResolvedValueOnce({ data: { plan: 'free', plans_count: 1 }, error: null })
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
