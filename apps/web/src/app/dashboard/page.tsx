'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, Clock, CalendarDays, ChevronRight, AlertTriangle } from 'lucide-react'
import { plansApi } from '@/lib/api'
import { createClient } from '@/lib/supabase'
import { PLAN_STATUS_CONFIG, getProgressBarColor, formatDateBR } from '@/lib/constants'
import { DashboardSkeleton } from '@/components/DashboardSkeleton'
import type { Plan, LoadingState, User } from '@/types'
import { PLAN_LIMITS } from '@/types'

const DashboardPage = () => {
  const [plans, setPlans] = useState<Plan[]>([])
  const [user, setUser]   = useState<User | null>(null)
  const [state, setState] = useState<LoadingState>('loading')

  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      plansApi.list(),
      supabase.auth.getUser().then(({ data }) =>
        data.user
          ? supabase.from('users').select('*').eq('id', data.user.id).single().then(r => r.data)
          : null
      ),
    ])
      .then(([plansRes, userData]) => {
        setPlans(plansRes.plans)
        setUser(userData as User | null)
        setState('success')
      })
      .catch(() => setState('error'))
  }, [])

  // Aviso de uso de API calls (>= 80%)
  const usageWarning = useMemo(() => {
    if (!user) return null
    const limits = PLAN_LIMITS[user.plan]
    if (limits.maxApiCallsPerMonth === null) return null
    const percent = Math.round((user.api_calls_this_month / limits.maxApiCallsPerMonth) * 100)
    if (percent < 80) return null
    return { used: user.api_calls_this_month, max: limits.maxApiCallsPerMonth, percent }
  }, [user])

  const { active, avgProgress, nextExam } = useMemo(() => {
    const active = plans.filter(p => p.status === 'active')
    const avgProgress = active.length
      ? Math.round(active.reduce((s, p) => s + p.progress, 0) / active.length)
      : 0
    const nextExam = plans
      .filter(p => p.exam_date && new Date(p.exam_date) >= new Date())
      .sort((a, b) => new Date(a.exam_date!).getTime() - new Date(b.exam_date!).getTime())[0]
    return { active, avgProgress, nextExam }
  }, [plans])

  if (state === 'loading') return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold leading-7 text-gray-900">Meus Planos</h1>
          <p className="mt-1 text-sm text-gray-500">Acompanhe o progresso de cada disciplina</p>
        </div>
        <Link href="/plan/new" className="btn-primary">
          <Plus size={14} /> Novo plano
        </Link>
      </div>
      <DashboardSkeleton />
    </main>
  )

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">

      {/* Page header */}
      <div className="page-header">
        <div>
          <h1 className="text-2xl font-bold leading-7 text-gray-900">Meus Planos</h1>
          <p className="mt-1 text-sm text-gray-500">Acompanhe o progresso de cada disciplina</p>
        </div>
        <Link href="/plan/new" className="btn-primary">
          <Plus size={14} /> Novo plano
        </Link>
      </div>

      {/* Banner de aviso de uso */}
      {usageWarning && (
        <div className="mb-6 flex items-start gap-3 rounded-lg bg-amber-50 px-4 py-3 ring-1 ring-amber-200">
          <AlertTriangle size={16} className="mt-0.5 flex-shrink-0 text-amber-500" />
          <div className="flex-1 text-sm">
            <span className="font-semibold text-amber-800">
              Você usou {usageWarning.percent}% das suas gerações este mês
            </span>
            <span className="text-amber-700">
              {' '}({usageWarning.used}/{usageWarning.max}).{' '}
            </span>
            <Link href="/planos" className="font-semibold text-amber-800 underline hover:text-amber-700">
              Fazer upgrade
            </Link>
            {' '}para continuar usando exercícios e recalibrações sem interrupção.
          </div>
        </div>
      )}

      {plans.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50">
            <Plus className="text-indigo-600" size={22} />
          </div>
          <h3 className="text-sm font-semibold text-gray-900">Nenhum plano criado</h3>
          <p className="mt-1 text-sm text-gray-500">
            Faça upload da ementa para começar.
          </p>
          <div className="mt-6">
            <Link href="/plan/new" className="btn-primary">
              <Plus size={14} /> Criar primeiro plano
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <dl className="grid grid-cols-1 gap-5 sm:grid-cols-3 mb-8">
            {[
              { label: 'Planos ativos',    value: active.length,       suffix: ''  },
              { label: 'Progresso médio',  value: `${avgProgress}%`,   suffix: ''  },
              {
                label: 'Próxima prova',
                value: nextExam
                  ? formatDateBR(nextExam.exam_date!)
                  : '—',
                suffix: '',
              },
            ].map(stat => (
              <div key={stat.label} className="card px-4 py-5 sm:p-6">
                <dt className="truncate text-sm font-medium text-gray-500">{stat.label}</dt>
                <dd className="mt-1 text-3xl font-semibold tracking-tight text-gray-900">{stat.value}</dd>
              </div>
            ))}
          </dl>

          {/* Plans list */}
          <div className="card">
            <ul role="list" className="divide-y divide-gray-100">
              {plans.map(plan => <PlanRow key={plan.id} plan={plan} />)}
            </ul>

            <div className="border-t border-gray-100 px-5 py-3">
              <Link
                href="/plan/new"
                className="flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                <Plus size={14} /> Adicionar disciplina
              </Link>
            </div>
          </div>
        </>
      )}

    </main>
  )
}

export default DashboardPage

const PlanRow = ({ plan }: { plan: Plan }) => {
  const status = PLAN_STATUS_CONFIG[plan.status]
  const barColor = getProgressBarColor(plan.progress)

  return (
    <li>
      <Link
        href={`/plan/${plan.id}`}
        className="flex items-center justify-between gap-x-6 px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        {/* Left */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className={status.cls}>{status.label}</span>
          </div>
          <p className="truncate text-sm font-semibold text-gray-900">{plan.title}</p>
          {plan.subjects && (
            <p className="truncate text-xs text-gray-400 mt-0.5">{plan.subjects.name}</p>
          )}
          {/* Progress bar */}
          <div className="mt-2 flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-100">
              <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${plan.progress}%` }} />
            </div>
            <span className="text-xs tabular-nums text-gray-500">{plan.progress}%</span>
          </div>
        </div>

        {/* Right meta */}
        <div className="hidden sm:flex flex-shrink-0 items-center gap-4 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            <Clock size={11} /> {plan.total_weeks}sem
          </span>
          {plan.exam_date && (
            <span className="flex items-center gap-1">
              <CalendarDays size={11} />
              {formatDateBR(plan.exam_date)}
            </span>
          )}
          <ChevronRight size={14} className="text-gray-300" />
        </div>
      </Link>
    </li>
  )
}
