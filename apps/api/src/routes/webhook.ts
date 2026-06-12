import { FastifyPluginAsync } from 'fastify'
import Stripe from 'stripe'
import { supabase } from '../lib/supabase'
import type { UserPlan } from '@educarseia/types'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2024-04-10' })

// Mapeia Price ID → tier do plano
const resolvePlan = (priceId: string | null): UserPlan => {
  if (!priceId) return 'free'
  const map: Record<string, UserPlan> = {
    [process.env.STRIPE_PRICE_ID_BASIC ?? '']: 'basic',
    [process.env.STRIPE_PRICE_ID_PRO   ?? '']: 'pro',
    [process.env.STRIPE_PRICE_ID_MAX   ?? '']: 'max',
    [process.env.STRIPE_PRICE_ID_BETA  ?? '']: 'beta',
  }
  return map[priceId] ?? 'pro'  // fallback conservador
}

export const webhookRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/stripe', { config: { rawBody: true } }, async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string
    let event: Stripe.Event
    try { event = stripe.webhooks.constructEvent(request.rawBody ?? Buffer.alloc(0), sig, process.env.STRIPE_WEBHOOK_SECRET!) }
    catch { return reply.status(400).send({ error: 'Assinatura inválida' }) }

    if (event.type === 'checkout.session.completed') {
      const session  = event.data.object as Stripe.Checkout.Session
      const userId   = session.metadata?.user_id
      if (!userId) return { received: true }

      // Busca o price_id da subscription para mapear o tier correto
      let plan: UserPlan = 'pro'
      if (session.subscription) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = sub.items.data[0]?.price.id ?? null
        plan = resolvePlan(priceId)
      }

      await supabase
        .from('users')
        .update({ plan, stripe_customer_id: session.customer as string })
        .eq('id', userId)
    }

    if (event.type === 'customer.subscription.updated') {
      const sub     = event.data.object as Stripe.Subscription
      const priceId = sub.items.data[0]?.price.id ?? null
      const plan    = resolvePlan(priceId)
      await supabase
        .from('users')
        .update({ plan })
        .eq('stripe_customer_id', sub.customer as string)
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as Stripe.Subscription
      await supabase
        .from('users')
        .update({ plan: 'free' })
        .eq('stripe_customer_id', sub.customer as string)
    }

    return { received: true }
  })
}
