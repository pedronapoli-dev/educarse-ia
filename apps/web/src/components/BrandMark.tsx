import { cn } from '@/lib/utils'

interface BrandMarkProps {
  inverted?: boolean
  className?: string
}

// Marca tipográfica mínima: "e" em Fraunces sobre teal-petróleo.
// Decisão — Krug (Não me faça pensar): o wordmark já é auto-explicativo;
// o "e" reserva o lugar para o símbolo proprietário da Fase 5 (DESIGN_SYSTEM.md).
// `inverted` troca a relação figura/fundo para uso sobre superfícies escuras
// (footer, CTA final) — mantém o mesmo contraste em qualquer contexto.
export const BrandMark = ({ inverted = false, className }: BrandMarkProps) => (
  <span
    className={cn(
      'flex h-8 w-8 items-center justify-center rounded-md font-display text-base font-bold leading-none select-none',
      inverted ? 'bg-on-primary text-primary' : 'bg-primary text-on-primary',
      className,
    )}
  >
    e
  </span>
)
