'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check, Sparkles, Zap, Crown, GraduationCap, ArrowLeft, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

// ── Dados dos planos ──────────────────────────────────────────

const PLANS = [
  {
    key:   'free' as const,
    name:  'Grátis',
    price: 'R$ 0',
    period: '',
    description: 'Para experimentar',
    icon: GraduationCap,
    highlight: false,
    cta: 'Começar grátis',
    features: [
      '2 planos de estudo',
      'Upload de ementa (PDF ou texto)',
      'Geração básica de cronograma',
      '10 gerações de exercícios/mês',
      'Marcar sessões como concluídas',
    ],
    missing: [
      'Repetição espaçada (SM-2)',
      'Check-in semanal',
      'Recalibração de plano',
      'SkillRouter adaptativo',
    ],
  },
  {
    key:   'basic' as const,
    name:  'Básico',
    price: 'R$ 19,90',
    period: '/mês',
    description: 'Para quem estuda com consistência',
    icon: Sparkles,
    highlight: false,
    cta: 'Assinar Básico',
    features: [
      'Até 10 planos de estudo',
      'Repetição espaçada (SM-2)',
      'Check-in semanal',
      'Recalibração de plano',
      '30 gerações de exercícios/mês',
      'Exercícios até nível Aplicar (Bloom)',
    ],
    missing: [
      'SkillRouter adaptativo',
      'Diagnóstico ZDP completo',
      'Exercícios de análise e síntese',
      'Sugestões de vídeos por sessão',
    ],
  },
  {
    key:   'pro' as const,
    name:  'Pro',
    price: 'R$ 29,90',
    period: '/mês',
    description: 'Para dominar qualquer matéria',
    icon: Zap,
    highlight: true,
    cta: 'Assinar Pro',
    features: [
      'Planos ilimitados',
      'SkillRouter adaptativo (IA muda de estratégia conforme seu progresso)',
      'Diagnóstico ZDP completo',
      'Exercícios em todos os níveis Bloom',
      'Sugestões de vídeos por sessão (YouTube)',
      'Recalibração com diagnóstico de bloqueio',
      '100 gerações de exercícios/mês',
    ],
    missing: [],
  },
  {
    key:   'max' as const,
    name:  'Max',
    price: 'R$ 249,90',
    period: '/ano',
    description: '≈ R$ 20,83/mês — 2 meses grátis',
    icon: Crown,
    highlight: false,
    cta: 'Assinar Max',
    features: [
      'Tudo do Pro',
      'Gerações ilimitadas',
      'Export do plano em PDF',
      'Acesso antecipado a novos recursos',
    ],
    missing: [],
  },
] as const

type PlanKey = 'basic' | 'pro' | 'max' | 'beta'

// ── Componente ────────────────────────────────────────────────

const PlanosPage = () => {
  const router  = useRouter()
  const [loading, setLoading] = useState<PlanKey | null>(null)

  const handleCheckout = async (plan: PlanKey) => {
    setLoading(plan)
    try {
      const { url } = await api.post<{ url: string }>('/api/checkout', { plan })
      window.location.href = url
    } catch {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-bg py-12 px-4 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-text-subtle hover:text-text-muted transition-colors mb-8"
        >
          <ArrowLeft size={13} /> Voltar
        </Link>

        <div className="text-center mb-10">
          <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">Escolha seu plano</h1>
          <p className="mt-2 text-sm text-text-muted">
            Cancele quando quiser. Sem taxa de cancelamento.
          </p>
        </div>

        {/* Beta callout */}
        <div className="mb-8 rounded-lg bg-primary-soft ring-1 ring-primary/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-on-primary-soft">🎓 Oferta beta — vagas limitadas</p>
            <p className="text-sm text-on-primary-soft/80 mt-0.5">
              Apoie o projeto desde o início e trave o Pro por <strong>R$ 14,90/mês para sempre</strong>.
            </p>
          </div>
          <button
            onClick={() => handleCheckout('beta')}
            disabled={loading !== null}
            className="btn-primary flex-shrink-0"
          >
            {loading === 'beta' && <Loader2 size={14} className="animate-spin" />}
            Quero ser beta user
          </button>
        </div>

        {/* Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map(plan => {
            const Icon = plan.icon
            const isPaid = plan.key !== 'free'
            const isLoading = loading === plan.key

            return (
              <div
                key={plan.key}
                className={cn(
                  'relative flex flex-col rounded-lg bg-surface p-5 ring-1',
                  plan.highlight ? 'ring-accent/30 shadow-md' : 'ring-border shadow-xs',
                )}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="badge-accent rounded-full">
                      Mais popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <div className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-lg mb-3',
                    plan.highlight ? 'bg-accent text-on-accent' : 'bg-surface-muted text-text-muted',
                  )}>
                    <Icon size={18} />
                  </div>
                  <h2 className="text-base font-bold text-text">{plan.name}</h2>
                  <p className="text-xs text-text-muted mt-0.5">{plan.description}</p>
                </div>

                <div className="mb-5">
                  <span className="text-2xl font-bold text-text">{plan.price}</span>
                  <span className="text-sm text-text-muted">{plan.period}</span>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-text-muted">
                      <Check size={13} className="mt-0.5 flex-shrink-0 text-success" />
                      {f}
                    </li>
                  ))}
                  {plan.missing.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-text-subtle line-through">
                      <span className="mt-0.5 flex-shrink-0 w-[13px]" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isPaid ? (
                  <button
                    onClick={() => handleCheckout(plan.key as PlanKey)}
                    disabled={loading !== null}
                    className={cn('w-full', plan.highlight ? 'btn-accent' : 'btn-secondary')}
                  >
                    {isLoading && <Loader2 size={14} className="animate-spin" />}
                    {plan.cta}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="btn-secondary w-full"
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-8 text-center text-xs text-text-subtle">
          Pagamento processado com segurança pelo Stripe. Cancele a qualquer momento pelo dashboard.
        </p>
      </div>
    </div>
  )
}

export default PlanosPage
