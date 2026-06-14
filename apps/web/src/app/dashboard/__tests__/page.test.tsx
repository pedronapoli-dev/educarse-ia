import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { Plan, User } from '@/types'

const { mockList, mockGetUser, mockSingle, mockFrom } = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq     = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom   = vi.fn(() => ({ select: mockSelect }))
  const mockGetUser = vi.fn()
  const mockList    = vi.fn()
  return { mockList, mockGetUser, mockSingle, mockFrom }
})

vi.mock('@/lib/api', () => ({
  plansApi: { list: mockList },
}))

vi.mock('@/lib/supabase', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
    from: mockFrom,
  }),
}))

import DashboardPage from '../page'

const basePlan: Plan = {
  id: 'plan-1',
  user_id: 'user-1',
  subject_id: 'subject-1',
  title: 'Cálculo II',
  status: 'active',
  hours_per_day: 1,
  days_per_week: 5,
  exam_date: null,
  total_weeks: 4,
  schedule: [],
  progress: 50,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

const baseUser: User = {
  id: 'user-1',
  email: 'aluno@example.com',
  plan: 'free',
  plans_count: 1,
  api_calls_this_month: 9,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('DashboardPage', () => {
  it('renderiza o skeleton de carregamento junto do cabeçalho real', () => {
    mockList.mockReturnValue(new Promise(() => {}))
    mockGetUser.mockReturnValue(new Promise(() => {}))

    const { container } = render(<DashboardPage />)

    expect(screen.getByRole('heading', { name: 'Meus Planos' })).toBeInTheDocument()
    expect(container.querySelector('[aria-hidden="true"].animate-pulse')).toBeInTheDocument()
  })

  it('mostra estado vazio quando não há planos', async () => {
    mockList.mockResolvedValue({ plans: [] })
    mockGetUser.mockResolvedValue({ data: { user: null } })

    render(<DashboardPage />)

    expect(await screen.findByText('Nenhum plano ainda')).toBeInTheDocument()
  })

  it('renderiza estatísticas e lista de planos quando há planos', async () => {
    mockList.mockResolvedValue({ plans: [basePlan] })
    mockGetUser.mockResolvedValue({ data: { user: null } })

    render(<DashboardPage />)

    expect(await screen.findByText('Cálculo II')).toBeInTheDocument()
    expect(screen.getByText('Planos ativos')).toBeInTheDocument()
  })

  it('mostra aviso de uso quando >= 80% das chamadas de API do mês foram usadas', async () => {
    mockList.mockResolvedValue({ plans: [basePlan] })
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSingle.mockResolvedValue({ data: baseUser })

    render(<DashboardPage />)

    expect(await screen.findByText('Você usou 90% das suas gerações este mês')).toBeInTheDocument()
  })
})
