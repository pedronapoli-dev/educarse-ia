import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardSkeleton } from '../DashboardSkeleton'

describe('DashboardSkeleton', () => {
  it('renderiza wrapper animado e oculto para leitores de tela', () => {
    const { container } = render(<DashboardSkeleton />)
    const root = container.firstElementChild as HTMLElement
    expect(root).toHaveAttribute('aria-hidden', 'true')
    expect(root).toHaveClass('animate-pulse')
  })

  it('renderiza 3 placeholders de cards de estatística', () => {
    const { container } = render(<DashboardSkeleton />)
    const statCards = container.querySelectorAll('dl > div.card')
    expect(statCards).toHaveLength(3)
  })

  it('renderiza 3 linhas de placeholder na lista de planos', () => {
    render(<DashboardSkeleton />)
    // role queries precisam de `hidden: true` pois o wrapper tem aria-hidden="true"
    expect(screen.getAllByRole('listitem', { hidden: true })).toHaveLength(3)
  })
})
