/**
 * Integration tests for POST /api/checkout (apps/api/src/routes/checkout.ts)
 *
 * Cobre 200 {url} para cada plano pago (basic/pro/max/beta), 400 quando o
 * plano está fora do enum, e 400 quando a env var do price ID do plano não
 * está configurada — esse último caso usa vi.resetModules() + dynamic import,
 * já que PRICE_IDS é computado uma única vez no carregamento do módulo a
 * partir de process.env. Mocka o módulo `stripe` (checkout.sessions.create).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockSessionsCreate } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY     = 'sk_test_123'
  process.env.STRIPE_PRICE_ID_BASIC = 'price_basic'
  process.env.STRIPE_PRICE_ID_PRO   = 'price_pro'
  process.env.STRIPE_PRICE_ID_MAX   = 'price_max'
  process.env.STRIPE_PRICE_ID_BETA  = 'price_beta'
  process.env.FRONTEND_URL          = 'https://app.educarse-ia.com.br'

  return { mockSessionsCreate: vi.fn() }
})

vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(function () {
    return {
      checkout: { sessions: { create: mockSessionsCreate } },
    }
  }),
}))

// ── Imports após mock ─────────────────────────────────────────────────────

import { checkoutRoutes } from '../checkout'

const TEST_USER_ID = 'user-1'

const buildApp = async (routes = checkoutRoutes) => {
  const app = Fastify()
  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.user = { sub: TEST_USER_ID }
  })
  await app.register(routes, { prefix: '/api' })
  await app.ready()
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/checkout', () => {
  it.each(['basic', 'pro', 'max', 'beta'] as const)(
    'retorna 200 com a url da sessão de checkout para o plano %s',
    async (plan) => {
      mockSessionsCreate.mockResolvedValueOnce({ url: `https://checkout.stripe.com/session/${plan}` })

      const app = await buildApp()
      const res = await app.inject({ method: 'POST', url: '/api/checkout', payload: { plan } })

      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ url: `https://checkout.stripe.com/session/${plan}` })
      expect(mockSessionsCreate).toHaveBeenCalledWith(expect.objectContaining({
        mode:       'subscription',
        metadata:   { user_id: TEST_USER_ID },
        line_items: [{ price: process.env[`STRIPE_PRICE_ID_${plan.toUpperCase()}`], quantity: 1 }],
      }))
    },
  )

  it('retorna 400 quando o plano está fora do enum basic|pro|max|beta', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/checkout', payload: { plan: 'free' } })

    expect(res.statusCode).toBe(400)
    expect(mockSessionsCreate).not.toHaveBeenCalled()
  })

  it('retorna 400 quando a env var do price ID do plano não está configurada', async () => {
    const original = process.env.STRIPE_PRICE_ID_BASIC
    delete process.env.STRIPE_PRICE_ID_BASIC
    vi.resetModules()

    try {
      const { checkoutRoutes: freshCheckoutRoutes } = await import('../checkout')
      const app = await buildApp(freshCheckoutRoutes)
      const res = await app.inject({ method: 'POST', url: '/api/checkout', payload: { plan: 'basic' } })

      expect(res.statusCode).toBe(400)
      expect(res.json()).toEqual({ error: "Plano 'basic' não configurado." })
      expect(mockSessionsCreate).not.toHaveBeenCalled()
    } finally {
      process.env.STRIPE_PRICE_ID_BASIC = original
    }
  })
})
