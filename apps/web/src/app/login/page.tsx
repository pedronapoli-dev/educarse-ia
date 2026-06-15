'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase'
import { Footer } from '@/components/Footer'
import { BrandMark } from '@/components/BrandMark'
import { AlertCircle, Loader2, MailCheck, ArrowLeft } from 'lucide-react'

type Mode = 'signin' | 'signup' | 'confirm' | 'forgot' | 'forgot-sent'

const LoginPage = () => {
  const router = useRouter()
  const [email, setEmail]         = useState('')
  const [password, setPassword]   = useState('')
  const [error, setError]         = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [mode, setMode]           = useState<Mode>('signin')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)
    const supabase = createClient()

    if (mode === 'signin') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) { setError(error.message); setIsLoading(false); return }
      router.push('/dashboard')
      router.refresh()
      return
    }

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset-password`,
      })
      if (error) { setError(error.message); setIsLoading(false); return }
      setIsLoading(false)
      setMode('forgot-sent')
      return
    }

    // signup
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setIsLoading(false); return }

    // Supabase retorna session=null quando confirmação de e-mail está habilitada
    if (data.session) {
      router.push('/dashboard')
      router.refresh()
    } else {
      setIsLoading(false)
      setMode('confirm')
    }
  }

  // ── Tela de confirmação de e-mail ──────────────────────────
  if (mode === 'confirm') {
    return (
      <div className="flex min-h-screen flex-col justify-center bg-bg py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <BrandMark className="h-10 w-10 rounded-xl" />
          </div>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="card px-6 py-8 sm:px-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
                <MailCheck className="text-primary" size={22} />
              </div>
            </div>
            <h2 className="font-display text-lg font-bold text-text mb-2">Confirme seu e-mail</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Enviamos um link de confirmação para{' '}
              <span className="font-medium text-text">{email}</span>.
              Clique no link para ativar sua conta e depois entre aqui.
            </p>
            <button
              onClick={() => setMode('signin')}
              className="mt-6 btn-primary w-full py-2"
            >
              Já confirmei — entrar
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Tela de confirmação de envio do link de redefinição ────
  if (mode === 'forgot-sent') {
    return (
      <div className="flex min-h-screen flex-col justify-center bg-bg py-12 sm:px-6 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="flex justify-center">
            <BrandMark className="h-10 w-10 rounded-xl" />
          </div>
        </div>
        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
          <div className="card px-6 py-8 sm:px-10 text-center">
            <div className="flex justify-center mb-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
                <MailCheck className="text-primary" size={22} />
              </div>
            </div>
            <h2 className="font-display text-lg font-bold text-text mb-2">Verifique seu email</h2>
            <p className="text-sm text-text-muted leading-relaxed">
              Se houver uma conta cadastrada com{' '}
              <span className="font-medium text-text">{email}</span>,
              enviamos um link para redefinir sua senha. Verifique também a
              caixa de spam.
            </p>
            <button
              onClick={() => setMode('signin')}
              className="mt-6 btn-primary w-full py-2"
            >
              Voltar para o login
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Formulário de login / cadastro ─────────────────────────
  return (
    <div className="flex min-h-screen flex-col justify-center bg-bg py-12 sm:px-6 lg:px-8">

      {/* Logo + heading */}
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <BrandMark className="h-10 w-10 rounded-xl" />
        </div>
        <h2 className="mt-4 text-center font-display text-2xl font-bold leading-tight tracking-tight text-text">
          {mode === 'signin' ? 'Entrar na sua conta' : mode === 'forgot' ? 'Redefinir senha' : 'Criar conta gratuita'}
        </h2>
        <p className="mt-2 text-center text-sm text-text-muted">
          {mode === 'signin'
            ? 'Acesse seus planos de estudo'
            : mode === 'forgot'
            ? 'Enviaremos um link para você criar uma nova senha'
            : 'Comece a estudar de forma inteligente'}
        </p>
      </div>

      {/* Form card */}
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="card px-6 py-8 sm:px-10">
          <form onSubmit={handleSubmit} className="space-y-5">

            {error && (
              <div className="flex items-start gap-2.5 rounded-md bg-danger-soft p-3.5 ring-1 ring-inset ring-danger/20">
                <AlertCircle className="mt-px flex-shrink-0 text-danger" size={15} />
                <p className="text-sm text-on-danger-soft">{error}</p>
              </div>
            )}

            <div>
              <label htmlFor="email">Email</label>
              <div className="mt-1.5">
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="voce@email.com"
                />
              </div>
            </div>

            {mode !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password">Senha</label>
                  {mode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => { setMode('forgot'); setError(null) }}
                      className="text-sm font-medium text-primary hover:text-primary-hover"
                    >
                      Esqueci minha senha
                    </button>
                  )}
                </div>
                <div className="mt-1.5">
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-2 mt-2"
            >
              {isLoading && <Loader2 size={15} className="animate-spin" />}
              {mode === 'signin' ? 'Entrar' : mode === 'forgot' ? 'Enviar link de redefinição' : 'Criar conta'}
            </button>
          </form>

          {mode === 'forgot' ? (
            <p className="mt-6 text-center text-sm text-text-muted">
              <button
                onClick={() => { setMode('signin'); setError(null) }}
                className="font-semibold text-primary hover:text-primary-hover"
              >
                Voltar para o login
              </button>
            </p>
          ) : (
            <p className="mt-6 text-center text-sm text-text-muted">
              {mode === 'signin' ? 'Não tem conta?' : 'Já tem conta?'}{' '}
              <button
                onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null) }}
                className="font-semibold text-primary hover:text-primary-hover"
              >
                {mode === 'signin' ? 'Criar conta' : 'Entrar'}
              </button>
            </p>
          )}

          {mode === 'signup' && (
            <p className="mt-3 text-center text-xs text-text-subtle">
              Ao criar conta, você concorda com os{' '}
              <Link href="/termos" className="underline hover:text-text-muted">Termos de Uso</Link>
              {' '}e a{' '}
              <Link href="/privacidade" className="underline hover:text-text-muted">Política de Privacidade</Link>.
            </p>
          )}
        </div>

        {/* Voltar para home */}
        <div className="mt-4 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-text-muted transition-colors"
          >
            <ArrowLeft size={13} />
            Voltar para o início
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default LoginPage
