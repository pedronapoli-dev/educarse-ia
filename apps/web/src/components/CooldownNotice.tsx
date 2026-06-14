'use client'

import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CooldownResponse } from '@/types'

interface Props {
  cooldownError: CooldownResponse
  context?: 'modal' | 'inline'
}

const formatRetryAt = (retryAt: string) => {
  const date = new Date(retryAt)
  const now  = new Date()
  const diffHours = Math.ceil((date.getTime() - now.getTime()) / (60 * 60 * 1000))

  if (diffHours <= 1) return 'em menos de 1 hora'
  if (diffHours < 24) return `em ${diffHours} horas`

  const diffDays = Math.ceil(diffHours / 24)
  return diffDays === 1 ? 'amanhã' : `em ${diffDays} dias`
}

export const CooldownNotice = ({ cooldownError, context = 'modal' }: Props) => {
  return (
    <div className={cn('flex flex-col items-center text-center', context === 'modal' ? 'py-10 px-6' : 'py-6 px-4')}>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-info-soft mb-4">
        <Clock className="text-info" size={20} />
      </div>

      <h3 className="text-sm font-semibold text-text mb-1">Aguarde um pouco</h3>
      <p className="text-sm text-text-muted max-w-xs">
        {cooldownError.message} Disponível novamente {formatRetryAt(cooldownError.retry_at)}.
      </p>
    </div>
  )
}
