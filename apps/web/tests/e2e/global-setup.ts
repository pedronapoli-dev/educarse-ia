/**
 * global-setup.ts — Playwright
 *
 * Executado UMA vez antes de todos os testes:
 *  1. Cria usuário de teste no Supabase local via Admin API
 *  2. Faz login via UI para capturar cookies de sessão reais
 *  3. Salva storage state em .auth/user.json (reutilizado pelos testes)
 *  4. Expõe E2E_USER_EMAIL / E2E_USER_PASSWORD / E2E_USER_ID para os testes
 *
 * Se o Supabase não estiver rodando, o setup lança erro claro orientando
 * o desenvolvedor a rodar `supabase start`.
 */

import { chromium, type FullConfig } from '@playwright/test'
import { createClient }               from '@supabase/supabase-js'
import path                           from 'path'
import fs                             from 'fs'

const SUPABASE_URL             = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const AUTH_DIR   = path.join(__dirname, '.auth')
const AUTH_STATE = path.join(AUTH_DIR, 'user.json')

export default async function globalSetup(config: FullConfig) {
  // Garantir que .auth/ exista
  fs.mkdirSync(AUTH_DIR, { recursive: true })

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  })

  // ── 1. Criar usuário de teste ─────────────────────────────────────────────
  const suffix  = Date.now()
  const email   = `e2e-${suffix}@educarseia-test.internal`
  const password = 'E2eTestPass123!'

  const { data: authData, error: authErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (authErr || !authData.user) {
    throw new Error(
      `[E2E global-setup] Falha ao criar usuário de teste: ${authErr?.message}\n` +
      'Certifique-se de que o Supabase local está rodando: supabase start'
    )
  }
  const userId = authData.user.id

  // Salvar ids para uso nos testes e teardown
  process.env.E2E_USER_EMAIL    = email
  process.env.E2E_USER_PASSWORD = password
  process.env.E2E_USER_ID       = userId

  // ── 2. Fazer login via UI e capturar storage state ────────────────────────
  const baseURL = config.projects.find(p => p.name === 'e2e')?.use?.baseURL ?? 'http://localhost:3000'

  const browser = await chromium.launch()
  const ctx     = await browser.newContext()
  const page    = await ctx.newPage()

  await page.goto(`${baseURL}/login`)

  // Preencher credenciais
  await page.fill('#email',    email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')

  // Aguardar redirecionamento para o dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 })

  // Salvar cookies + localStorage (auth tokens do Supabase)
  await ctx.storageState({ path: AUTH_STATE })

  await browser.close()

  console.log(`[E2E] Usuário de teste criado: ${email} (id: ${userId})`)
}
