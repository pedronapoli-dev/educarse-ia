import { BRAND_SYMBOL_DOT, BRAND_SYMBOL_PATH } from '@/lib/brand-symbol'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  inverted?: boolean
  className?: string
}

// `inverted` troca a relação figura/fundo para uso sobre superfícies escuras
// (footer, CTA final) — mantém o mesmo contraste em qualquer contexto.
export const BrandMark = ({ inverted = false, className }: BrandMarkProps) => (
  <span
    className={cn(
      'flex h-8 w-8 items-center justify-center rounded-md select-none',
      inverted ? 'bg-on-primary' : 'bg-primary',
      className,
    )}
  >
    <svg viewBox="0 0 32 32" className="h-full w-full" aria-hidden="true">
      <path
        d={BRAND_SYMBOL_PATH}
        fill="none"
        strokeWidth={2.4}
        strokeLinecap="round"
        className={inverted ? 'stroke-primary' : 'stroke-on-primary'}
      />
      <circle
        cx={BRAND_SYMBOL_DOT.cx}
        cy={BRAND_SYMBOL_DOT.cy}
        r={BRAND_SYMBOL_DOT.r}
        className={inverted ? 'fill-primary' : 'fill-terra-500'}
      />
    </svg>
  </span>
)
