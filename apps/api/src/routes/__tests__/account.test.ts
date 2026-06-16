/**
 * Integration tests for DELETE /api/account (apps/api/src/routes/account.ts)
 *
 * Cobre: 204 com cancelamento best-effort de assinaturas Stripe ativas,
 * 204 sem stripe_customer_id (não chama Stripe), 500 se a busca inicial no
 * supabase falha, e 204 mesmo se o cancelamento na Stripe lançar (best-effort,
 * só loga). Mocka supabase com um builder encadeável genérico e o módulo
 * `stripe` (subscriptions.list/cancel).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'

// ── Mocks ──────────────────────────────────────────────────────────────────

const {
  mockFrom, mockDeleteUser, queueResult,
  mockSubscriptionsList, mockSubscriptionsCancel,
} = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_123'

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
    mockFrom:       vi.fn(() => raw),
    mockDeleteUser: vi.fn(),
    queueResult:    (result: Result) => { queue.push(result) },
    mockSubscriptionsList:   vi.fn(),
    mockSubscriptionsCancel: vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom, auth: { admin: { deleteUser: mockDeleteUser } } },
}))

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      subscriptions: { list: mockSubscriptionsList, cancel: mockSubscriptionsCancel },
    }
  }),
}))

// ── Imports após mock ─────────────────────────────────────────────────────

import { accountRoutes } from '../account'

const TEST_USER_ID = 'user-1'

const buildApp = async () => {
  const app = Fastify()
  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.user = { sub: TEST_USER_ID }
  })
  await app.register(accountRoutes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DELETE /api/account', () => {
  it('retorna 204, cancela assinaturas Stripe ativas e exclui o usuário', async () => {
    queueResult({ data: { stripe_customer_id: 'cus_123' }, error: null })
    mockSubscriptionsList
      .mockResolvedValueOnce({ data: [{ id: 'sub_1' }] })  // status: active
      .mockResolvedValueOnce({ data: [] })                 // status: trialing
    mockSubscriptionsCancel.mockResolvedValueOnce({})
    mockDeleteUser.mockResolvedValueOnce({ error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/account' })

    expect(res.statusCode).toBe(204)
    expect(mockSubscriptionsList).toHaveBeenCalledWith({ customer: 'cus_123', status: 'active' })
    expect(mockSubscriptionsList).toHaveBeenCalledWith({ customer: 'cus_123', status: 'trialing' })
    expect(mockSubscriptionsCancel).toHaveBeenCalledWith('sub_1')
    expect(mockDeleteUser).toHaveBeenCalledWith(TEST_USER_ID)
  })

  it('retorna 204 sem chamar a Stripe quando o usuário não tem stripe_customer_id', async () => {
    queueResult({ data: { stripe_customer_id: null }, error: null })
    mockDeleteUser.mockResolvedValueOnce({ error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/account' })

    expect(res.statusCode).toBe(204)
    expect(mockSubscriptionsList).not.toHaveBeenCalled()
    expect(mockDeleteUser).toHaveBeenCalledWith(TEST_USER_ID)
  })

  it('retorna 500 quando a busca inicial no supabase falha', async () => {
    queueResult({ data: null, error: { message: 'erro de conexão' } })

    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/account' })

    expect(res.statusCode).toBe(500)
    expect(res.json()).toEqual({ error: 'Erro ao buscar dados da conta.' })
    expect(mockDeleteUser).not.toHaveBeenCalled()
  })

  it('retorna 204 mesmo se o cancelamento na Stripe lançar (best-effort)', async () => {
    queueResult({ data: { stripe_customer_id: 'cus_789' }, error: null })
    mockSubscriptionsList.mockRejectedValueOnce(new Error('Stripe indisponível'))
    mockDeleteUser.mockResolvedValueOnce({ error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/account' })

    expect(res.statusCode).toBe(204)
    expect(mockDeleteUser).toHaveBeenCalledWith(TEST_USER_ID)
  })
})
