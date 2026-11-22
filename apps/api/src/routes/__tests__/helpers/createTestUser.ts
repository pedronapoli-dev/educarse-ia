/**
 * createTestUser — cria usuário real no Supabase local para integration tests.
 *
 * Fluxo:
 *  1. supabase.auth.admin.createUser → insere em auth.users (satisfaz FK)
 *  2. Trigger handle_new_user cria automaticamente a linha em public.users
 *  3. Atualizamos plan/api_calls/plans_count conforme opts
 *  4. Assinamos JWT HS256 com TEST_JWT_SECRET — compatível com buildApp()
 *
 * cleanup() deleta o usuário e todos os dados cascadeados (RLS via service_role).
 * Chame em afterEach para manter o banco limpo entre testes.
 */

import { createHmac } from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { UserPlan } from '@educarseia/types'
import { TEST_JWT_SECRET } from './buildApp'

// Cliente admin — bypassa RLS, pode criar/deletar auth users
const admin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

// ── JWT HS256 mínimo (sem dependências externas) ──────────────────────────────

function b64url(data: string): string {
  return Buffer.from(data).toString('base64url')
}

export function signTestJwt(userId: string, secret = TEST_JWT_SECRET): string {
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    sub:  userId,
    role: 'authenticated',
    iss:  'supabase-test',
    iat:  Math.floor(Date.now() / 1000),
    exp:  Math.floor(Date.now() / 1000) + 3600,
  }))
  const data      = `${header}.${payload}`
  const signature = createHmac('sha256', secret).update(data).digest('base64url')
  return `${data}.${signature}`
}

// ── Interface pública ─────────────────────────────────────────────────────────

export interface TestUser {
  userId:  string
  email:   string
  token:   string          // Bearer token pronto para uso nos headers
  authHeader: string       // `Bearer ${token}` — conveniência
  cleanup: () => Promise<void>
}

export interface CreateTestUserOpts {
  plan?:                  UserPlan
  plans_count?:           number
  api_calls_this_month?:  number
  /** ISO string — padrão: 30 dias no futuro (reset não ocorreu) */
  api_calls_reset_at?:    string
  stripe_customer_id?:    string
}

export async function createTestUser(opts: CreateTestUserOpts = {}): Promise<TestUser> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
  const email  = `test-${suffix}@educarseia-test.internal`

  // 1. Criar auth user (trigger cria public.users automaticamente)
  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password:       'TestPassword123!',
    email_confirm:  true,
  })
  if (authErr || !authData.user) {
    throw new Error(`createTestUser: falha ao criar auth user — ${authErr?.message}`)
  }
  const userId = authData.user.id

  // 2. Atualizar public.users com configuração do teste
  const futureReset = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
  const { error: updateErr } = await admin.from('users').update({
    plan:                   opts.plan                 ?? 'free',
    plans_count:            opts.plans_count          ?? 0,
    api_calls_this_month:   opts.api_calls_this_month ?? 0,
    api_calls_reset_at:     opts.api_calls_reset_at   ?? futureReset,
    ...(opts.stripe_customer_id ? { stripe_customer_id: opts.stripe_customer_id } : {}),
  }).eq('id', userId)

  if (updateErr) throw new Error(`createTestUser: falha ao atualizar public.users — ${updateErr.message}`)

  // 3. Assinar JWT HS256
  const token = signTestJwt(userId)

  return {
    userId,
    email,
    token,
    authHeader: `Bearer ${token}`,
    cleanup: async () => {
      // Deleta auth user → cascata apaga public.users + planos + etc.
      await admin.auth.admin.deleteUser(userId)
    },
  }
}

// ── Helper: cria subject diretamente no DB (sem AI) ──────────────────────────
// Usado pelos testes de planos para ter uma ementa real sem chamar a IA.

export interface TestSubject {
  id:     string
  name:   string
  topics: string[]
}

export async function createTestSubject(userId: string, overrides: Partial<{
  name:   string
  topics: string[]
  code:   string
}> = {}): Promise<TestSubject> {
  const { data, error } = await admin.from('subjects').insert({
    user_id:    userId,
    name:       overrides.name   ?? 'Cálculo I',
    code:       overrides.code   ?? 'MAT0121',
    topics:     overrides.topics ?? ['Limites e Continuidade', 'Derivadas', 'Integrais'],
    bibliography:  ['STEWART, James. Cálculo. Vol. 1.'],
    prerequisites: [],
    source_type:   'text',
    description:   'Ementa de teste para validação de integração.',
    raw_text:      'Ementa de Cálculo I — inserida diretamente em teste.',
  }).select('id, name, topics').single()

  if (error || !data) throw new Error(`createTestSubject: ${error?.message}`)
  return { id: data.id, name: data.name as string, topics: data.topics as string[] }
}

// ── Helper: insere registro de skill_usage_log (simula cooldown ativo) ────────

export async function insertSkillUsage(
  userId:    string,
  skillType: 'checkin' | 'recalibrate',
  planId?:   string,
  /** Offset em ms relativo a agora. Padrão: -1h (dentro do cooldown) */
  agoMs = 60 * 60 * 1000,
): Promise<void> {
  const createdAt = new Date(Date.now() - agoMs).toISOString()
  const { error } = await admin.from('skill_usage_log').insert({
    user_id:    userId,
    plan_id:    planId ?? null,
    skill_type: skillType,
    created_at: createdAt,
  })
  if (error) throw new Error(`insertSkillUsage: ${error.message}`)
}
