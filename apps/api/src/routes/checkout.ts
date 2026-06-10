import { FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'

type PlanKey = 'basic' | 'pro' | 'max' | 'beta'

const PRICE_IDS: Record<PlanKey, string | undefined> = {
  basic: process.env.STRIPE_PRICE_ID_BASIC,
  pro:   process.env.STRIPE_PRICE_ID_PRO,
  max:   process.env.STRIPE_PRICE_ID_MAX,
  beta:  process.env.STRIPE_PRICE_ID_BETA,
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

export const checkoutRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post<{ Body: { plan: PlanKey } }>(
    '/checkout',
    {
      preHandler: [fastify.authenticate],
      schema: {
        body: {
          type: 'object',
          required: ['plan'],
          properties: {
            plan: { type: 'string', enum: ['basic', 'pro', 'max', 'beta'] },
          },
        },
      },
    },
    async (request, reply) => {
      const userId = request.user.sub
      const { plan } = request.body

      const priceId = PRICE_IDS[plan]
      if (!priceId) return reply.status(400).send({ error: `Plano '${plan}' não configurado.` })

      const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000'

      const session = await stripe.checkout.sessions.create({
        mode:                'subscription',
        payment_method_types: ['card'],
        line_items: [{ price: priceId, quantity: 1 }],
        metadata:   { user_id: userId },
        success_url: `${frontendUrl}/planos/sucesso?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url:  `${frontendUrl}/planos`,
        locale:      'pt-BR',
      })

      return reply.send({ url: session.url })
    },
  )
}
