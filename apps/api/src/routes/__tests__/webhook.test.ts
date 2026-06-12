/**
 * Integration tests for POST /api/webhooks/stripe (apps/api/src/routes/webhook.ts)
 *
 * Usa verificação de assinatura real do Stripe (Stripe.webhooks.generateTestHeaderString
 * + constructEvent, ambos crypto puro e sem rede) registrando o plugin fastify-raw-body
 * exatamente como em server.ts. Sem esse plugin, request.rawBody fica vazio e toda
 * assinatura é rejeitada como inválida — então estes testes validam o fix de ponta a ponta.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import rawBody from 'fastify-raw-body'
import Stripe from 'stripe'

// ── Mocks ──────────────────────────────────────────────────────────────────

const { mockEq, mockUpdate, mockFrom } = vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY     = 'sk_test_123'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret'
  process.env.STRIPE_PRICE_ID_BASIC = 'price_basic'
  process.env.STRIPE_PRICE_ID_PRO   = 'price_pro'
  process.env.STRIPE_PRICE_ID_MAX   = 'price_max'
  process.env.STRIPE_PRICE_ID_BETA  = 'price_beta'

  const mockEq     = vi.fn().mockResolvedValue({ error: null })
  const mockUpdate = vi.fn(() => ({ eq: mockEq }))
  const mockFrom   = vi.fn(() => ({ update: mockUpdate }))
  return { mockEq, mockUpdate, mockFrom }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ── Imports após mock ─────────────────────────────────────────────────────

import { webhookRoutes } from '../webhook'

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET!

const buildApp = async () => {
  const app = Fastify()
  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: false,
    runFirst: true,
  })
  await app.register(webhookRoutes, { prefix: '/api/webhooks' })
  await app.ready()
  return app
}

const sign = (payload: string, secret = WEBHOOK_SECRET) =>
  Stripe.webhooks.generateTestHeaderString({
    payload,
    secret,
    timestamp: Math.floor(Date.now() / 1000),
  })

const postWebhook = (app: Awaited<ReturnType<typeof buildApp>>, payload: string, signature: string) =>
  app.inject({
    method: 'POST',
    url: '/api/webhooks/stripe',
    headers: {
      'content-type': 'application/json',
      'stripe-signature': signature,
    },
    payload,
  })

beforeEach(() => {
  vi.clearAllMocks()
  mockEq.mockResolvedValue({ error: null })
})

describe('POST /api/webhooks/stripe', () => {
  it('checkout.session.completed sem subscription atualiza o plano para pro (fallback)', async () => {
    const event = {
      id: 'evt_1',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_1',
          object: 'checkout.session',
          customer: 'cus_123',
          subscription: null,
          metadata: { user_id: 'user-1' },
        },
      },
    }
    const payload = JSON.stringify(event)

    const app = await buildApp()
    const res = await postWebhook(app, payload, sign(payload))

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ received: true })
    expect(mockFrom).toHaveBeenCalledWith('users')
    expect(mockUpdate).toHaveBeenCalledWith({ plan: 'pro', stripe_customer_id: 'cus_123' })
    expect(mockEq).toHaveBeenCalledWith('id', 'user-1')
  })

  it('checkout.session.completed sem metadata.user_id não atualiza o banco', async () => {
    const event = {
      id: 'evt_2',
      object: 'event',
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_2',
          object: 'checkout.session',
          customer: 'cus_456',
          subscription: null,
          metadata: {},
        },
      },
    }
    const payload = JSON.stringify(event)

    const app = await buildApp()
    const res = await postWebhook(app, payload, sign(payload))

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ received: true })
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('customer.subscription.updated mapeia o price id para o tier correto', async () => {
    const event = {
      id: 'evt_3',
      object: 'event',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_1',
          object: 'subscription',
          customer: 'cus_789',
          items: { object: 'list', data: [{ price: { id: process.env.STRIPE_PRICE_ID_BASIC } }] },
        },
      },
    }
    const payload = JSON.stringify(event)

    const app = await buildApp()
    const res = await postWebhook(app, payload, sign(payload))

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ received: true })
    expect(mockUpdate).toHaveBeenCalledWith({ plan: 'basic' })
    expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_789')
  })

  it('customer.subscription.deleted reverte o usuário para o tier free', async () => {
    const event = {
      id: 'evt_4',
      object: 'event',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test_2',
          object: 'subscription',
          customer: 'cus_999',
        },
      },
    }
    const payload = JSON.stringify(event)

    const app = await buildApp()
    const res = await postWebhook(app, payload, sign(payload))

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ received: true })
    expect(mockUpdate).toHaveBeenCalledWith({ plan: 'free' })
    expect(mockEq).toHaveBeenCalledWith('stripe_customer_id', 'cus_999')
  })

  it('rejeita assinatura inválida com 400', async () => {
    const payload = JSON.stringify({
      id: 'evt_5',
      object: 'event',
      type: 'checkout.session.completed',
      data: { object: {} },
    })

    const app = await buildApp()
    const res = await postWebhook(app, payload, sign(payload, 'whsec_wrong_secret'))

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Assinatura inválida' })
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
