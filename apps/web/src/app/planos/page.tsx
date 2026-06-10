'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Check, Sparkles, Zap, Crown, GraduationCap, ArrowLeft, Loader2,
} from 'lucide-react'
import { api } from '@/lib/api'

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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">

      {/* Header */}
      <div className="mx-auto max-w-4xl">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-8"
        >
          <ArrowLeft size={13} /> Voltar
        </Link>

        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Escolha seu plano</h1>
          <p className="mt-2 text-sm text-gray-500">
            Cancele quando quiser. Sem taxa de cancelamento.
          </p>
        </div>

        {/* Beta callout */}
        <div className="mb-8 rounded-xl bg-indigo-50 ring-1 ring-indigo-200 px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-indigo-800">🎓 Oferta beta — vagas limitadas</p>
            <p className="text-sm text-indigo-600 mt-0.5">
              Apoie o projeto desde o início e trave o Pro por <strong>R$ 14,90/mês para sempre</strong>.
            </p>
          </div>
          <button
            onClick={() => handleCheckout('beta')}
            disabled={loading !== null}
            className="flex-shrink-0 inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 transition-colors disabled:opacity-60"
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
                className={`relative flex flex-col rounded-xl bg-white p-5 ring-1 shadow-sm ${
                  plan.highlight
                    ? 'ring-indigo-400 shadow-indigo-100/60'
                    : 'ring-gray-200'
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="inline-flex items-center rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-semibold text-white">
                      Mais popular
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-lg mb-3 ${
                    plan.highlight ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                  }`}>
                    <Icon size={18} />
                  </div>
                  <h2 className="text-base font-bold text-gray-900">{plan.name}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{plan.description}</p>
                </div>

                <div className="mb-5">
                  <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                  <span className="text-sm text-gray-500">{plan.period}</span>
                </div>

                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-700">
                      <Check size={13} className="mt-0.5 flex-shrink-0 text-green-500" />
                      {f}
                    </li>
                  ))}
                  {plan.missing.map(f => (
                    <li key={f} className="flex items-start gap-2 text-xs text-gray-400 line-through">
                      <span className="mt-0.5 flex-shrink-0 w-[13px]" />
                      {f}
                    </li>
                  ))}
                </ul>

                {isPaid ? (
                  <button
                    onClick={() => handleCheckout(plan.key as PlanKey)}
                    disabled={loading !== null}
                    className={`w-full rounded-md px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-60 flex items-center justify-center gap-2 ${
                      plan.highlight
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {isLoading && <Loader2 size={14} className="animate-spin" />}
                    {plan.cta}
                  </button>
                ) : (
                  <button
                    onClick={() => router.push('/dashboard')}
                    className="w-full rounded-md bg-gray-100 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    {plan.cta}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Pagamento processado com segurança pelo Stripe. Cancele a qualquer momento pelo dashboard.
        </p>
      </div>
    </div>
  )
}

export default PlanosPage
