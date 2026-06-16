/**
 * Integration tests for apps/api/src/routes/exercises.ts
 *
 * Testa POST /generate (wiring com checkAndIncrementApiCall — 402 +
 * LimitedResponse, 201 com/sem warning de 80%), GET / (lista por plan_id,
 * 400 sem plan_id) e PATCH /:id/answer (correct/answer/explanation, 400 fora
 * do enum a|b|c|d) — mockando supabase com um builder encadeável genérico
 * (select/insert/update/delete/eq/order, single() e await via fila de
 * resultados), lib/limits e exerciseService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'

// ── Mocks ──────────────────────────────────────────────────────────────────

const {
  mockFrom, queueResult,
  mockCheckAndIncrementApiCall, mockGenerateAndSaveExercises, mockAnswerExercise,
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
    mockCheckAndIncrementApiCall: vi.fn(),
    mockGenerateAndSaveExercises: vi.fn(),
    mockAnswerExercise:           vi.fn(),
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
  answerExercise:           mockAnswerExercise,
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
})

describe('POST /api/exercises/generate', () => {
  it('retorna 402 com LimitedResponse quando o limite de calls foi atingido', async () => {
    queueResult({ data: { plan: 'free' }, error: null })
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
    queueResult({ data: { plan: 'free' }, error: null })
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
    queueResult({ data: { plan: 'free' }, error: null })
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({ allowed: true })
    mockGenerateAndSaveExercises.mockResolvedValueOnce([{ id: 'ex-1' }])

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/exercises/generate', payload: VALID_BODY })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ exercises: [{ id: 'ex-1' }] })
  })
})

describe('GET /api/exercises', () => {
  it('retorna 200 com a lista de exercícios do plano, ordenada por created_at', async () => {
    queueResult({ data: [{ id: 'ex-1', topic: 'Derivadas' }], error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/exercises?plan_id=plan-1' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ exercises: [{ id: 'ex-1', topic: 'Derivadas' }] })
    expect(mockFrom).toHaveBeenCalledWith('exercises')
  })

  it('retorna 400 quando plan_id não é informado', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/exercises' })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'plan_id obrigatório' })
  })
})

describe('PATCH /api/exercises/:id/answer', () => {
  it('retorna 200 com correct:true quando a resposta enviada bate com o gabarito', async () => {
    mockAnswerExercise.mockResolvedValueOnce({ answer: 'b', explanation: 'Porque a derivada de x² é 2x.' })

    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/exercises/ex-1/answer', payload: { answer: 'b' } })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ correct: true, answer: 'b', explanation: 'Porque a derivada de x² é 2x.' })
    expect(mockAnswerExercise).toHaveBeenCalledWith(TEST_USER_ID, 'ex-1', 'b')
  })

  it('retorna correct:false quando a resposta enviada difere do gabarito', async () => {
    mockAnswerExercise.mockResolvedValueOnce({ answer: 'b', explanation: 'Porque a derivada de x² é 2x.' })

    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/exercises/ex-1/answer', payload: { answer: 'c' } })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ correct: false, answer: 'b', explanation: 'Porque a derivada de x² é 2x.' })
  })

  it('retorna 400 quando answer está fora do enum a|b|c|d', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/exercises/ex-1/answer', payload: { answer: 'z' } })

    expect(res.statusCode).toBe(400)
    expect(mockAnswerExercise).not.toHaveBeenCalled()
  })
})
