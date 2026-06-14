'use client'

import Link from 'next/link'
import { Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LimitedResponse } from '@/types'

interface Props {
  limitError: LimitedResponse
  context?: 'modal' | 'inline'
}

export const LimitReachedBlock = ({ limitError, context = 'modal' }: Props) => {
  const { usage } = limitError
  const percent   = usage.max ? Math.min(100, Math.round((usage.used / usage.max) * 100)) : 100

  return (
    <div className={cn('flex flex-col items-center text-center', context === 'modal' ? 'py-10 px-6' : 'py-6 px-4')}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft mb-4">
        <Lock className="text-danger" size={20} />
      </div>

      <h3 className="text-sm font-semibold text-text mb-1">Limite do plano atingido</h3>
      <p className="text-sm text-text-muted mb-5 max-w-xs">
        Você usou {usage.used} de {usage.max ?? '∞'} gerações este mês.
        Faça upgrade para continuar.
      </p>

      {/* Usage bar */}
      {usage.max !== null && (
        <div className="w-full max-w-xs mb-5">
          <div className="flex justify-between text-xs text-text-subtle mb-1">
            <span>{usage.used} usadas</span>
            <span>{usage.max} total</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-1.5 rounded-full bg-danger transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      <Link href={limitError.upgrade_url} className="btn-accent">
        Ver planos
      </Link>
    </div>
  )
}
