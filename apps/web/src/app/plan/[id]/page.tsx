'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { toast } from 'sonner'
import { Loader2, ArrowLeft, AlertTriangle, CalendarX } from 'lucide-react'
import { plansApi } from '@/lib/api'
import { getProgressBarColor } from '@/lib/constants'
import { DayItem } from '@/components/DayItem'
import { ExerciseModal } from '@/components/ExerciseModal'
import { CheckinCard } from '@/components/CheckinCard'
import { RecalibrateModal } from '@/components/RecalibrateModal'
import { BloomDistribution } from '@/components/BloomBadge'
import type { Plan, ScheduleDay, LoadingState } from '@/types'

const PlanPage = () => {
  const { id }  = useParams<{ id: string }>()
  const router  = useRouter()
  const [plan, setPlan]               = useState<Plan | null>(null)
  const [state, setState]             = useState<LoadingState>('loading')
  const [activeWeek, setActiveWeek]   = useState(1)
  const [exerciseDay, setExerciseDay]       = useState<ScheduleDay | null>(null)
  const [showRecalibrate, setShowRecalibrate] = useState(false)

  useEffect(() => {
    plansApi.get(id)
      .then(res => { setPlan(res.plan); setState('success') })
      .catch(() => setState('error'))
  }, [id])

  const handleComplete = async (week: number, day: ScheduleDay) => {
    if (!plan || day.completed) return
    try {
      await plansApi.completeSession(id, week, day.day)
      setPlan(prev => {
        if (!prev) return prev
        const schedule  = prev.schedule.map(w =>
          w.week !== week ? w : { ...w, days: w.days.map(d => d.day !== day.day ? d : { ...d, completed: true }) }
        )
        const total     = schedule.reduce((a, w) => a + w.days.length, 0)
        const completed = schedule.reduce((a, w) => a + w.days.filter(d => d.completed).length, 0)
        return { ...prev, schedule, progress: Math.round((completed / total) * 100) }
      })
      toast.success('Sessão concluída! Mais um passo na sua jornada.')
    } catch {
      toast.error('Não foi possível registrar a sessão. Tente novamente.')
    }
  }

  const { currentWeek, completedDays, totalDays, allDays, barColor } = useMemo(() => {
    if (!plan) return { currentWeek: undefined, completedDays: 0, totalDays: 0, allDays: [], barColor: '' }
    const cw = plan.schedule.find(w => w.week === activeWeek)
    const cd = plan.schedule.reduce((a, w) => a + w.days.filter(d => d.completed).length, 0)
    const td = plan.schedule.reduce((a, w) => a + w.days.length, 0)
    const ad = plan.schedule.flatMap(w => w.days)
    return { currentWeek: cw, completedDays: cd, totalDays: td, allDays: ad, barColor: getProgressBarColor(plan.progress) }
  }, [plan, activeWeek])

  if (state === 'loading') return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Loader2 className="animate-spin text-primary" size={24} />
    </div>
  )
  if (!plan) return <p className="p-8 text-text-subtle">Plano não encontrado.</p>

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">

      {/* Back */}
      <button
        onClick={() => router.push('/dashboard')}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text transition-colors"
      >
        <ArrowLeft size={14} /> Meus planos
      </button>

      {/* Page heading */}
      <div className="border-b border-border pb-5 mb-5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold leading-tight text-text">{plan.title}</h1>
          {plan.subjects && (
            <p className="mt-1 text-sm text-text-muted">
              {plan.subjects.name}
              {plan.subjects.course && <span className="text-text-subtle"> · {plan.subjects.course}</span>}
            </p>
          )}
        </div>
        <div className="sm:flex-shrink-0 sm:text-right">
          <p className="text-2xl sm:text-3xl font-semibold tracking-tight text-primary tabular-nums leading-none">
            {plan.progress}<span className="text-base font-medium text-text-subtle">%</span>
          </p>
          <p className="mt-1 text-xs text-text-subtle">{completedDays}/{totalDays} dias</p>
        </div>
      </div>

      {plan.schedule.length === 0 ? (
        /* Empty schedule state */
        <div className="text-center py-16">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft">
            <CalendarX className="text-primary" size={22} />
          </div>
          <h3 className="text-sm font-semibold text-text">Nenhuma semana de estudos ainda</h3>
          <p className="mt-1 text-sm text-text-muted">
            Este plano ainda não tem um cronograma gerado. Volte para o painel para criar ou revisar seus planos.
          </p>
          <div className="mt-6">
            <Link href="/dashboard" className="btn-secondary">
              Voltar para o painel
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div
              className={`h-1.5 rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${plan.progress}%` }}
            />
          </div>

          {/* Bloom distribution strip */}
          <div className="mb-6">
            <BloomDistribution days={allDays} />
          </div>

          {/* Week tabs — pill style */}
          <nav className="mb-6 flex flex-wrap gap-1.5" aria-label="Semanas">
            {plan.schedule.map((week, index) => {
              const done    = week.days.every(d => d.completed)
              const current = activeWeek === week.week
              return (
                <button
                  key={`${week.week}-${index}`}
                  onClick={() => setActiveWeek(week.week)}
                  className={`flex-shrink-0 rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                    current ? 'bg-primary text-on-primary'
                    : done   ? 'bg-success-soft text-on-success-soft hover:bg-success/15'
                    :          'text-text-muted hover:bg-surface-muted hover:text-text'
                  }`}
                >
                  Sem. {week.week}{done ? ' ✓' : ''}
                  {week.module && <span className="ml-1 opacity-70 text-xs hidden sm:inline">· {week.module}</span>}
                </button>
              )
            })}
          </nav>

          {/* Activity list */}
          {currentWeek && (
            <div>
              {/* Week focus banner */}
              <div className="mb-4 rounded-md bg-primary-soft px-4 py-2.5 ring-1 ring-inset ring-primary/10">
                <p className="text-xs font-semibold text-on-primary-soft">
                  {currentWeek.module
                    ? <><span className="text-on-primary-soft/60">{currentWeek.module}</span> · </>
                    : null
                  }
                  Semana {currentWeek.week} · <span className="font-normal text-on-primary-soft/70">{currentWeek.focus}</span>
                </p>
              </div>

              <ul role="list" className="space-y-2.5">
                {currentWeek.days.map(day => (
                  <DayItem
                    key={day.day}
                    day={day}
                    onComplete={() => handleComplete(currentWeek.week, day)}
                    onPractice={() => setExerciseDay(day)}
                  />
                ))}
              </ul>
            </div>
          )}

          {/* Check-in + Recalibrate actions */}
          {currentWeek && (
            <div className="mt-6 space-y-3">
              <CheckinCard plan={plan} activeWeek={activeWeek} />
              <button
                onClick={() => setShowRecalibrate(true)}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-warning/30 bg-warning-soft/50 px-4 py-3 text-sm font-medium text-warning transition-colors hover:bg-warning-soft hover:border-warning/50"
              >
                <AlertTriangle size={14} /> Estou travado
              </button>
            </div>
          )}
        </>
      )}

      <ExerciseModal
        planId={id}
        subjectName={plan.subjects?.name ?? ''}
        day={exerciseDay}
        progress={plan.progress}
        onClose={() => setExerciseDay(null)}
      />

      {showRecalibrate && (
        <RecalibrateModal
          plan={plan}
          activeWeek={activeWeek}
          onClose={() => setShowRecalibrate(false)}
        />
      )}
    </main>
  )
}

export default PlanPage
