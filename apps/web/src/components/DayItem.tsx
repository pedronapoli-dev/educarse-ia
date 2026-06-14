'use client'

import { useState } from 'react'
import { CheckCircle2, Circle, Dumbbell, BookOpen, RotateCcw, Zap, ChevronDown } from 'lucide-react'
import { BloomBadge } from '@/components/BloomBadge'
import { cn } from '@/lib/utils'
import type { ScheduleDay } from '@/types'

const TYPE_CONFIG = {
  teoria:    { label: 'Teoria',  icon: BookOpen,  cls: 'badge-primary' },
  exercicio: { label: 'Prática', icon: Dumbbell,  cls: 'badge-accent'  },
  revisao:   { label: 'Revisão', icon: RotateCcw, cls: 'badge-amber'   },
}

const PRIORITY_CONFIG = {
  alta:  { label: 'Alta',  cls: 'badge-red'   },
  media: { label: 'Média', cls: 'badge-amber'  },
  baixa: { label: 'Baixa', cls: 'badge-gray'   },
}

export const DayItem = ({
  day, onComplete, onPractice,
}: {
  day: ScheduleDay
  onComplete: () => void
  onPractice: () => void
}) => {
  const [masteryOpen, setMasteryOpen] = useState(false)
  const cfg      = TYPE_CONFIG[day.type]
  const priority = PRIORITY_CONFIG[day.priority]
  const Icon     = cfg.icon

  return (
    <li className={cn(
      'bg-surface px-4 py-4 border border-border shadow-xs sm:rounded-lg transition-opacity',
      day.completed && 'opacity-50',
    )}>
      <div className="flex items-start gap-3">

        {/* Complete toggle */}
        <button
          onClick={onComplete}
          disabled={day.completed}
          className="mt-0.5 flex-shrink-0 transition-transform hover:scale-110 disabled:cursor-default disabled:hover:scale-100"
          aria-label={day.completed ? 'Concluído' : 'Marcar como concluído'}
        >
          {day.completed
            ? <CheckCircle2 className="text-success" size={20} />
            : <Circle className="text-border-strong transition-colors hover:text-text-subtle" size={20} />
          }
        </button>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Badges row */}
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span className={cn(cfg.cls, 'inline-flex items-center gap-1')}>
              <Icon size={9} />{cfg.label}
            </span>
            <span className={priority.cls}>{priority.label}</span>
            <BloomBadge level={day.bloom_level} />
            <span className="ml-auto text-xs tabular-nums text-text-subtle">{day.duration_minutes} min</span>
          </div>

          {/* Topic */}
          <p className={cn(
            'text-sm font-semibold leading-snug',
            day.completed ? 'line-through text-text-subtle' : 'text-text',
          )}>
            {day.topic}
          </p>

          {/* Review chain — topics being reviewed */}
          {day.type === 'revisao' && day.review_of && day.review_of.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="text-xs text-info font-medium">Revisando:</span>
              {day.review_of.map(t => (
                <span key={t} className={cn('badge-info', 'rounded-full')}>
                  {t}
                </span>
              ))}
            </div>
          )}

          {/* Mastery criteria — collapsible */}
          {day.mastery_criteria && (
            <div className="mt-2">
              <button
                onClick={() => setMasteryOpen(o => !o)}
                className="flex items-center gap-1 text-xs font-medium text-warning transition-opacity hover:opacity-80"
              >
                <ChevronDown size={12} className={cn('transition-transform', masteryOpen && 'rotate-180')} />
                Critério de maestria
              </button>
              {masteryOpen && (
                <div className="mt-1.5 rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-xs leading-relaxed text-on-warning-soft">
                  <span className="font-medium">Antes de avançar:</span> {day.mastery_criteria}
                </div>
              )}
            </div>
          )}

          {/* Tip */}
          {day.tip && (
            <p className="mt-1.5 rounded-md bg-surface-muted px-2.5 py-1.5 text-xs leading-relaxed text-text-muted">
              💡 {day.tip}
            </p>
          )}
        </div>

        {/* Exercises CTA */}
        {!day.completed && (
          <button
            onClick={onPractice}
            className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md bg-accent-soft px-3 py-1.5 text-xs font-semibold text-on-accent-soft ring-1 ring-inset ring-terra-200 transition-colors hover:bg-terra-200"
          >
            <Zap size={11} /> Praticar
          </button>
        )}
      </div>
    </li>
  )
}
