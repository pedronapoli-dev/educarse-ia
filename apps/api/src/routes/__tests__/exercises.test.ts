/**
 * Integration tests for POST /api/exercises/generate (apps/api/src/routes/exercises.ts)
 *
 * Testa o wiring da rota com checkAndIncrementApiCall (402 + LimitedResponse,
 * 201 com/sem warning de 80%), mockando supabase, lib/limits e exerciseService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockSingle, mockFrom, mockCheckAndIncrementApiCall, mockGenerateAndSaveExercises } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq     = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom   = vi.fn(() => ({ select: mockSelect }))
  return {
    mockSingle, mockEq, mockSelect, mockFrom,
    mockCheckAndIncrementApiCall:    vi.fn(),
    mockGenerateAndSaveExercises:    vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../../lib/limits', () => ({
  checkAndIncrementApiCall: mockCheckAndIncrementApiCall,
}))

vi.mock('../../services/exerciseService', () => ({
  generateAndSaveExercises: mockGenerateAndSaveExercises,
  answerExercise:           vi.fn(),
}))

// ── Imports após mock ─────────────────────────────────────────────────────

import { exercisesRoutes } from '../exercises'

const TEST_USER_ID = 'user-1'

const buildApp = async () => {
  const app = Fastify()
  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.user = { sub: TEST_USER_ID }
  })
  await app.register(exercisesRoutes, { prefix: '/api/exercises' })
  await app.ready()
  return app
}

const VALID_BODY = {
  plan_id:      'plan-1',
  topic:        'Derivadas',
  subject_name: 'Cálculo I',
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: { plan: 'free' }, error: null })
})

describe('POST /api/exercises/generate', () => {
  it('retorna 402 com LimitedResponse quando o limite de calls foi atingido', async () => {
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({
      allowed: false,
      limited: { limited: true, upgrade_url: '/planos', usage: { used: 10, max: 10, percent: 100 } },
    })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/exercises/generate', payload: VALID_BODY })

    expect(res.statusCode).toBe(402)
    expect(res.json()).toEqual({
      limited: true,
      upgrade_url: '/planos',
      usage: { used: 10, max: 10, percent: 100 },
    })
    expect(mockGenerateAndSaveExercises).not.toHaveBeenCalled()
  })

  it('retorna 201 com warning quando uso atinge 80%', async () => {
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({
      allowed: true,
      warning: { warning: true, usage: { used: 9, max: 10, percent: 90 } },
    })
    mockGenerateAndSaveExercises.mockResolvedValueOnce([{ id: 'ex-1' }])

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/exercises/generate', payload: VALID_BODY })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({
      exercises: [{ id: 'ex-1' }],
      warning: true,
      usage: { used: 9, max: 10, percent: 90 },
    })
  })

  it('retorna 201 sem warning quando uso está abaixo de 80%', async () => {
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({ allowed: true })
    mockGenerateAndSaveExercises.mockResolvedValueOnce([{ id: 'ex-1' }])

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/exercises/generate', payload: VALID_BODY })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ exercises: [{ id: 'ex-1' }] })
  })
})
