import { cn } from '@/lib/utils'
import type { BloomLevel } from '@/types'

// Bloom → badge (CLAUDE.md "Design System"). barClass usa uma progressão
// teal → terracota: complexidade cognitiva crescente espelha a transição de
// rigor analítico (frio) para geração/síntese (quente) — Mayer, sinalização:
// a cor da estrutura visual deve espelhar a estrutura conceitual.
const BLOOM_CONFIG: Record<BloomLevel, { label: string; badgeClass: string; barClass: string }> = {
  lembrar:  { label: 'Recordar',    badgeClass: 'badge-gray',    barClass: 'bg-creme-400' },
  entender: { label: 'Compreender', badgeClass: 'badge-info',    barClass: 'bg-teal-300'  },
  aplicar:  { label: 'Aplicar',     badgeClass: 'badge-primary', barClass: 'bg-teal-600'  },
  analisar: { label: 'Analisar',    badgeClass: 'badge-accent',  barClass: 'bg-terra-400' },
  avaliar:  { label: 'Avaliar',     badgeClass: 'badge-amber',   barClass: 'bg-warning'   },
  criar:    { label: 'Criar',       badgeClass: 'badge-green',   barClass: 'bg-success'   },
}

interface BloomBadgeProps {
  level: BloomLevel | undefined
  className?: string
}

export const BloomBadge = ({ level, className }: BloomBadgeProps) => {
  if (!level) return null
  const { label, badgeClass } = BLOOM_CONFIG[level]
  return (
    <span className={cn(badgeClass, className)}>
      {label}
    </span>
  )
}

// Horizontal strip showing Bloom level distribution across all days
interface BloomDistributionProps {
  days: Array<{ bloom_level?: BloomLevel; completed?: boolean }>
}

export const BloomDistribution = ({ days }: BloomDistributionProps) => {
  const levels: BloomLevel[] = ['lembrar', 'entender', 'aplicar', 'analisar', 'avaliar', 'criar']

  const counts = days.reduce<Partial<Record<BloomLevel, number>>>((acc, d) => {
    if (d.bloom_level) acc[d.bloom_level] = (acc[d.bloom_level] ?? 0) + 1
    return acc
  }, {})

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-text-subtle uppercase tracking-wide">Distribuição cognitiva</p>
      {/* Segmented bar */}
      <div className="flex h-2 rounded-full overflow-hidden gap-0.5">
        {levels.map(level => {
          const count = counts[level] ?? 0
          if (count === 0) return null
          const pct = (count / total) * 100
          return <div key={level} style={{ width: `${pct}%` }} className={cn('rounded-full', BLOOM_CONFIG[level].barClass)} />
        })}
      </div>
      {/* Legend chips */}
      <div className="flex flex-wrap gap-1.5">
        {levels.map(level => {
          const count = counts[level] ?? 0
          if (count === 0) return null
          return (
            <span key={level} className={BLOOM_CONFIG[level].badgeClass}>
              {BLOOM_CONFIG[level].label}
              <span className="opacity-70">{count}</span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
