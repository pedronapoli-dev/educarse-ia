import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function createTestUser(): Promise<string> {
  const admin = getAdmin()
  const { data, error } = await admin.auth.admin.createUser({
    email: `test-${Date.now()}@educarseia.test`,
    password: 'test-password-123',
    email_confirm: true,
  })
  if (error) throw new Error(`Falha ao criar usuário de teste: ${error.message}`)
  return data.user.id
}

export async function deleteTestUser(userId: string): Promise<void> {
  const admin = getAdmin()
  await admin.auth.admin.deleteUser(userId)
}
