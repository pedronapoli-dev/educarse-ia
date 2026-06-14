'use client'

import { useState } from 'react'
import { Loader2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { skillsApi } from '@/lib/api'
import { CHECKIN_ACTION_LABELS } from '@/lib/constants'
import { useAsyncAction } from '@/hooks/useAsyncAction'
import { LimitReachedBlock } from '@/components/LimitReachedBlock'
import { CooldownNotice } from '@/components/CooldownNotice'
import { cn } from '@/lib/utils'
import type { Plan, PlanCheckin, ScheduleWeek } from '@/types'

interface Props {
  plan: Plan
  activeWeek: number
}

const TREND_CONFIG = {
  'atrasado':  { label: 'Atrasado',  icon: TrendingDown, cls: 'text-danger bg-danger-soft ring-danger/20' },
  'no-ritmo':  { label: 'No ritmo',  icon: Minus,        cls: 'text-success bg-success-soft ring-success/20' },
  'adiantado': { label: 'Adiantado', icon: TrendingUp,   cls: 'text-info bg-info-soft ring-info/20' },
}

export const CheckinCard = ({ plan, activeWeek }: Props) => {
  const [open, setOpen] = useState(false)
  const { loading, error, limitError, cooldownError, result, execute, reset } = useAsyncAction<PlanCheckin>()

  // Collect context from plan schedule for the active week
  const week = plan.schedule.find((w: ScheduleWeek) => w.week === activeWeek)
  if (!week) return null

  const completedDays = week.days.filter(d => d.completed)
  const totalDays     = week.days.length
  const hoursPlanned  = week.days.reduce((sum, d) => sum + d.duration_minutes, 0) / 60
  const hoursStudied  = completedDays.reduce((sum, d) => sum + d.duration_minutes, 0) / 60

  // Build mastery criteria results from completed days
  const masteryCriteria = week.days
    .filter(d => d.mastery_criteria)
    .map(d => ({ topic: d.topic, achieved: d.completed, notes: d.mastery_criteria }))

  // Spaced reviews: check if any revisao days exist and are completed
  const reviewDays = week.days.filter(d => d.type === 'revisao')
  const spacedReviewsDone = reviewDays.length === 0 || reviewDays.every(d => d.completed)

  const handleCheckin = async (difficulties: string) => {
    await execute(async () => {
      const res = await skillsApi.checkin({
        plan_id:                 plan.id,
        week:                    activeWeek,
        topics_covered:          completedDays.map(d => d.topic),
        mastery_criteria_results: masteryCriteria,
        spaced_reviews_done:     spacedReviewsDone,
        difficulties,
        hours_studied_this_week: Math.round(hoursStudied * 10) / 10,
        hours_planned_this_week: Math.round(hoursPlanned * 10) / 10,
        application_context:     plan.application_context ?? '',
      })
      return res.checkin
    })
  }

  if (result) {
    const trend = TREND_CONFIG[result.performance_trend]
    const TrendIcon = trend.icon
    return (
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-text">Check-in da Semana {activeWeek}</h3>
          <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', trend.cls)}>
            <TrendIcon size={12} /> {trend.label}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-md bg-surface-muted p-3">
            <p className="text-xs text-text-subtle">Progresso quantitativo</p>
            <p className="text-lg font-bold text-text">{result.quantitative_progress}%</p>
          </div>
          <div className="rounded-md bg-surface-muted p-3">
            <p className="text-xs text-text-subtle">Progresso qualitativo</p>
            <p className="text-lg font-bold text-text">{result.qualitative_progress}%</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-text-muted mb-1">
            Acao recomendada: <span className="text-primary">{CHECKIN_ACTION_LABELS[result.proposed_action] ?? result.proposed_action}</span>
          </p>
          <p className="text-sm text-text-muted leading-relaxed">{result.action_rationale}</p>
        </div>

        <button onClick={() => { reset(); setOpen(false) }} className="text-xs text-text-subtle hover:text-text-muted">
          Fechar
        </button>
      </div>
    )
  }

  if (limitError) {
    return (
      <div className="card">
        <LimitReachedBlock limitError={limitError} context="inline" />
      </div>
    )
  }

  if (cooldownError) {
    return (
      <div className="card">
        <CooldownNotice cooldownError={cooldownError} context="inline" />
      </div>
    )
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-lg border border-dashed border-primary/30 bg-primary-soft/50 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary-soft hover:border-primary/50"
      >
        Fazer check-in da Semana {activeWeek}
      </button>
    )
  }

  return <CheckinForm
    week={activeWeek}
    completedCount={completedDays.length}
    totalCount={totalDays}
    loading={loading}
    error={error}
    onSubmit={handleCheckin}
    onCancel={() => setOpen(false)}
  />
}

const CheckinForm = ({
  week, completedCount, totalCount, loading, error, onSubmit, onCancel,
}: {
  week: number; completedCount: number; totalCount: number
  loading: boolean; error: string | null
  onSubmit: (difficulties: string) => void; onCancel: () => void
}) => {
  const [difficulties, setDifficulties] = useState('')

  return (
    <div className="card p-5 space-y-4">
      <h3 className="text-sm font-semibold text-text">Check-in da Semana {week}</h3>
      <p className="text-xs text-text-muted">
        {completedCount}/{totalCount} sessoes concluidas nesta semana.
      </p>

      <div>
        <label htmlFor="checkin-difficulties">
          Teve alguma dificuldade?
        </label>
        <textarea
          id="checkin-difficulties"
          rows={2}
          value={difficulties}
          onChange={e => setDifficulties(e.target.value)}
          placeholder="Ex: Nao entendi bem derivadas parciais..."
          className="mt-1.5"
        />
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onCancel} className="btn-secondary flex-1" disabled={loading}>
          Cancelar
        </button>
        <button onClick={() => onSubmit(difficulties)} disabled={loading} className="btn-primary flex-1">
          {loading ? <Loader2 size={15} className="animate-spin" /> : 'Enviar check-in'}
        </button>
      </div>
    </div>
  )
}
