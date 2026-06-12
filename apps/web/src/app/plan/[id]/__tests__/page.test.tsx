import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Plan, ScheduleDay } from '@/types'

const { mockUseParams, mockGet, mockCompleteSession, mockToastSuccess, mockToastError } = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockGet: vi.fn(),
  mockCompleteSession: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock('sonner', () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}))

vi.mock('@/lib/api', () => ({
  plansApi: { get: mockGet, completeSession: mockCompleteSession },
}))

vi.mock('@/components/ExerciseModal', () => ({ ExerciseModal: () => null }))
vi.mock('@/components/CheckinCard', () => ({ CheckinCard: () => null }))
vi.mock('@/components/RecalibrateModal', () => ({ RecalibrateModal: () => null }))
vi.mock('@/components/BloomBadge', () => ({ BloomBadge: () => null, BloomDistribution: () => null }))

import PlanPage from '../page'

const activeDay: ScheduleDay = {
  day: 1,
  topic: 'Introdução a limites',
  duration_minutes: 45,
  type: 'teoria',
  priority: 'alta',
  completed: false,
  bloom_level: 'entender',
}

const createEmptyPlan = (): Plan => ({
  id: 'plan-empty',
  user_id: 'user-1',
  subject_id: 'subject-1',
  title: 'Plano vazio',
  status: 'active',
  hours_per_day: 1,
  days_per_week: 5,
  exam_date: null,
  total_weeks: 4,
  schedule: [],
  progress: 0,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
})

const createActivePlan = (): Plan => ({
  ...createEmptyPlan(),
  id: 'plan-active',
  title: 'Plano ativo',
  schedule: [
    {
      week: 1,
      focus: 'Fundamentos de limites',
      days: [{ ...activeDay }],
    },
  ],
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('PlanPage', () => {
  it('exibe estado vazio quando o cronograma está vazio', async () => {
    mockUseParams.mockReturnValue({ id: 'plan-empty' })
    mockGet.mockResolvedValue({ plan: createEmptyPlan() })

    render(<PlanPage />)

    expect(await screen.findByText('Nenhuma semana de estudos ainda')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Voltar para o painel' })).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('navigation', { name: 'Semanas' })).not.toBeInTheDocument()
  })

  it('exibe semanas e atividades quando o cronograma não está vazio', async () => {
    mockUseParams.mockReturnValue({ id: 'plan-active' })
    mockGet.mockResolvedValue({ plan: createActivePlan() })

    render(<PlanPage />)

    expect(await screen.findByText('Introdução a limites')).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Semanas' })).toBeInTheDocument()
  })

  it('marca o dia como concluído e exibe toast de sucesso', async () => {
    mockUseParams.mockReturnValue({ id: 'plan-active' })
    mockGet.mockResolvedValue({ plan: createActivePlan() })
    mockCompleteSession.mockResolvedValue({ ok: true })

    const user = userEvent.setup()
    render(<PlanPage />)

    await screen.findByText('Introdução a limites')
    await user.click(screen.getByRole('button', { name: 'Marcar como concluído' }))

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith('Sessão concluída! Mais um passo na sua jornada.')
    })
    expect(mockCompleteSession).toHaveBeenCalledWith('plan-active', 1, 1)
    expect(screen.getByRole('button', { name: 'Concluído' })).toBeDisabled()
  })

  it('exibe toast de erro e mantém o dia pendente quando a conclusão falha', async () => {
    mockUseParams.mockReturnValue({ id: 'plan-active' })
    mockGet.mockResolvedValue({ plan: createActivePlan() })
    mockCompleteSession.mockRejectedValue(new Error('falhou'))

    const user = userEvent.setup()
    render(<PlanPage />)

    await screen.findByText('Introdução a limites')
    await user.click(screen.getByRole('button', { name: 'Marcar como concluído' }))

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith('Não foi possível registrar a sessão. Tente novamente.')
    })
    expect(screen.getByRole('button', { name: 'Marcar como concluído' })).toBeInTheDocument()
  })
})
