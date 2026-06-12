#!/usr/bin/env node
// Stripe E2E smoke test — NOT part of `npm run test` (vitest).
//
// Exercises the real pipeline end-to-end against Stripe TEST mode + Supabase:
//   1. Create a throwaway Supabase auth user and sign in for a real access token
//   2. POST /api/checkout { plan: 'basic' } against the running API -> expect { url }
//   3. Create a real Stripe test customer + subscription on the Basic price
//   4. Send a signed checkout.session.completed webhook event to /api/webhooks/stripe
//   5. Verify users.plan flips to 'basic' and stripe_customer_id is persisted
//
// All created Stripe + Supabase objects are cleaned up, even on failure.
//
// Requires: API server running (default http://localhost:3001) with real
// STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_ID_BASIC and SUPABASE_*
// configured in apps/api/.env (the running server must have loaded them at boot).
//
// Usage (from apps/api/): npm run verify:stripe

import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

const apiBaseUrl = process.env.VERIFY_API_URL ?? 'http://localhost:3001'

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
const stripeSecretKey = process.env.STRIPE_SECRET_KEY
const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET
const stripeBasicPriceId = process.env.STRIPE_PRICE_ID_BASIC

for (const [name, value] of Object.entries({
  SUPABASE_URL: supabaseUrl,
  SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
  SUPABASE_ANON_KEY: supabaseAnonKey,
  STRIPE_SECRET_KEY: stripeSecretKey,
  STRIPE_WEBHOOK_SECRET: stripeWebhookSecret,
  STRIPE_PRICE_ID_BASIC: stripeBasicPriceId,
})) {
  if (!value) {
    console.error(`Missing required env var: ${name}`)
    process.exit(1)
  }
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey)
const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-04-10' })

const testEmail = `e2e-stripe-test+${Date.now()}@example.com`
const testPassword = 'Test1234!E2E'

let testUserId
let stripeCustomerId
let stripeSubscriptionId

const step = (label, ...rest) => console.log(`[${label}]`, ...rest)

try {
  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  })
  if (createUserError) throw new Error(`createUser: ${createUserError.message}`)
  testUserId = createdUser.user.id
  step('1/6', 'Created throwaway Supabase user', testUserId, testEmail)

  const { data: signInData, error: signInError } = await supabaseAnon.auth.signInWithPassword({
    email: testEmail,
    password: testPassword,
  })
  if (signInError) throw new Error(`signIn: ${signInError.message}`)
  const accessToken = signInData.session.access_token
  step('2/6', 'Signed in, got access token')

  const { data: userBefore } = await supabaseAdmin
    .from('users')
    .select('plan, stripe_customer_id, api_calls_this_month')
    .eq('id', testUserId)
    .single()
  step('3/6', 'users row before checkout:', userBefore)

  const checkoutResponse = await fetch(`${apiBaseUrl}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ plan: 'basic' }),
  })
  const checkoutBody = await checkoutResponse.json()
  step('4/6', `POST /api/checkout -> ${checkoutResponse.status}`, checkoutBody)
  if (checkoutResponse.status !== 200 || !checkoutBody.url) {
    throw new Error(`POST /api/checkout did not return a checkout url (status ${checkoutResponse.status})`)
  }

  const stripeCustomer = await stripe.customers.create({ email: testEmail })
  stripeCustomerId = stripeCustomer.id
  // 'pm_card_visa' is a one-time test token; attaching it returns the real pm_... id to reuse below.
  const attachedPaymentMethod = await stripe.paymentMethods.attach('pm_card_visa', { customer: stripeCustomerId })
  await stripe.customers.update(stripeCustomerId, {
    invoice_settings: { default_payment_method: attachedPaymentMethod.id },
  })

  const stripeSubscription = await stripe.subscriptions.create({
    customer: stripeCustomerId,
    items: [{ price: stripeBasicPriceId }],
    default_payment_method: attachedPaymentMethod.id,
  })
  stripeSubscriptionId = stripeSubscription.id
  step(
    '5/6',
    'Created Stripe test customer + subscription',
    stripeCustomerId,
    stripeSubscriptionId,
    `(${stripeSubscription.status}, price ${stripeSubscription.items.data[0].price.id})`,
  )

  const webhookEvent = {
    id: `evt_e2e_${Date.now()}`,
    object: 'event',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: `cs_e2e_${Date.now()}`,
        object: 'checkout.session',
        customer: stripeCustomerId,
        subscription: stripeSubscriptionId,
        metadata: { user_id: testUserId },
      },
    },
  }
  const webhookPayload = JSON.stringify(webhookEvent)
  const webhookSignature = Stripe.webhooks.generateTestHeaderString({
    payload: webhookPayload,
    secret: stripeWebhookSecret,
    timestamp: Math.floor(Date.now() / 1000),
  })

  const webhookResponse = await fetch(`${apiBaseUrl}/api/webhooks/stripe`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'stripe-signature': webhookSignature },
    body: webhookPayload,
  })
  const webhookBody = await webhookResponse.json()
  step('6/6', `POST /api/webhooks/stripe -> ${webhookResponse.status}`, webhookBody)
  if (webhookResponse.status !== 200) {
    throw new Error(`webhook handler returned ${webhookResponse.status}`)
  }

  const { data: userAfter } = await supabaseAdmin
    .from('users')
    .select('plan, stripe_customer_id, api_calls_this_month')
    .eq('id', testUserId)
    .single()
  step('verify', 'users row after webhook:', userAfter)

  if (userAfter.plan !== 'basic') {
    throw new Error(`expected plan='basic' after webhook, got '${userAfter.plan}'`)
  }
  if (userAfter.stripe_customer_id !== stripeCustomerId) {
    throw new Error('stripe_customer_id was not persisted by the webhook handler')
  }

  console.log('\n✅ Stripe E2E pipeline OK: checkout session created, webhook signature verified, plan upgraded to basic')
} finally {
  console.log('\n--- cleanup ---')
  if (stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(stripeSubscriptionId)
      console.log('cancelled Stripe subscription', stripeSubscriptionId)
    } catch (cleanupError) {
      console.error('failed to cancel subscription:', cleanupError.message)
    }
  }
  if (stripeCustomerId) {
    try {
      await stripe.customers.del(stripeCustomerId)
      console.log('deleted Stripe customer', stripeCustomerId)
    } catch (cleanupError) {
      console.error('failed to delete Stripe customer:', cleanupError.message)
    }
  }
  if (testUserId) {
    try {
      await supabaseAdmin.from('users').delete().eq('id', testUserId)
      console.log('deleted public.users row', testUserId)
    } catch (cleanupError) {
      console.error('failed to delete users row:', cleanupError.message)
    }
    try {
      await supabaseAdmin.auth.admin.deleteUser(testUserId)
      console.log('deleted Supabase auth user', testUserId)
    } catch (cleanupError) {
      console.error('failed to delete auth user:', cleanupError.message)
    }
  }
}
