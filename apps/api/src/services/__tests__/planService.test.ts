/**
 * Unit tests for apps/api/src/services/planService.ts
 *
 * generateAndSavePlan: mocks supabase (subjects lookup + plans insert + rpc),
 * generate(), calculateReviewSchedule, and searchYoutubeEducation. Tests cover
 * subject-not-found, successful plan creation, SM-2 and YouTube enrichments,
 * JSON parse failure, schedule normalization (1-based indices), and DB error.
 * completeSession: mocks study_sessions insert and plans select/update. Tests
 * cover session marking, progress calculation, and status transition to completed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { baseSubject, basePlan } from '../../__tests__/helpers'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const {
  mockGenerate, mockFrom, mockRpc, mockChain,
  mockCalculateReviewSchedule, mockSearchYoutube,
} = vi.hoisted(() => {
  const mockGenerate = vi.fn()
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'gte', 'is', 'limit', 'filter']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn()
  chain.maybeSingle = vi.fn()
  chain.then = vi.fn()
  const mockFrom = vi.fn(() => chain)
  const mockRpc  = vi.fn().mockResolvedValue({ error: null })
  return {
    mockGenerate,
    mockFrom,
    mockRpc,
    mockChain: chain,
    mockCalculateReviewSchedule: vi.fn(),
    mockSearchYoutube:           vi.fn(),
  }
})

vi.mock('../../lib/anthropic', () => ({
  generate: mockGenerate,
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom, rpc: mockRpc },
}))

vi.mock('../../lib/mcp/spacedRepTools', () => ({
  calculateReviewSchedule: mockCalculateReviewSchedule,
}))

vi.mock('../../lib/mcp/resourceTools', () => ({
  searchYoutubeEducation: mockSearchYoutube,
}))

// ── Imports após mock ─────────────────────────────────────────────────────────

import { generateAndSavePlan, completeSession } from '../planService'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const basePlanInput = {
  userId:      'u1',
  subjectId:   'sub-1',
  hoursPerDay: 2,
  daysPerWeek: 5,
}

const generatedPlan = {
  title:       'Plano de Cálculo I',
  total_weeks: 4,
  schedule:    [
    { week: 5, focus: 'Limites', days: [{ day: 10, topic: 'Limites', duration_minutes: 60, type: 'teoria', priority: 'alta', completed: false }] },
  ],
}

const scheduleWithCompletedDay = [
  { week: 1, focus: 'Semana 1', days: [
    { day: 1, topic: 'A', duration_minutes: 60, type: 'teoria', priority: 'alta', completed: true },
    { day: 2, topic: 'B', duration_minutes: 60, type: 'teoria', priority: 'media', completed: false },
    { day: 3, topic: 'C', duration_minutes: 60, type: 'teoria', priority: 'baixa', completed: false },
  ]},
]

beforeEach(() => {
  vi.clearAllMocks()
  mockRpc.mockResolvedValue({ error: null })
  mockCalculateReviewSchedule.mockReturnValue([])
  mockSearchYoutube.mockResolvedValue([])
})

// ── generateAndSavePlan ───────────────────────────────────────────────────────

describe('generateAndSavePlan', () => {
  it('lança erro quando a ementa não é encontrada no banco', async () => {
    // given
    mockChain.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
    // when / then
    await expect(generateAndSavePlan(basePlanInput)).rejects.toThrow('Ementa não encontrada')
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('gera e salva o plano com sucesso retornando o registro inserido', async () => {
    // given: first single() = subject lookup, second = plan insert
    mockChain.single = vi.fn()
      .mockResolvedValueOnce({ data: baseSubject, error: null })
      .mockResolvedValueOnce({ data: basePlan, error: null })
    mockGenerate.mockResolvedValueOnce(JSON.stringify(generatedPlan))
    // when
    const result = await generateAndSavePlan(basePlanInput)
    // then
    expect(mockFrom).toHaveBeenCalledWith('subjects')
    expect(mockFrom).toHaveBeenCalledWith('plans')
    expect(mockGenerate).toHaveBeenCalledTimes(1)
    expect(mockRpc).toHaveBeenCalledWith('increment_plans_count', { user_id_param: 'u1' })
    expect(result).toEqual(basePlan)
  })

  it('normaliza indices week e day para base-1 independentemente do que a IA retornar', async () => {
    // given: schedule with week=5 and day=10 (should become week=1, day=1)
    mockChain.single = vi.fn()
      .mockResolvedValueOnce({ data: baseSubject, error: null })
      .mockResolvedValueOnce({ data: basePlan, error: null })
    mockGenerate.mockResolvedValueOnce(JSON.stringify(generatedPlan))
    // when
    await generateAndSavePlan(basePlanInput)
    // then: indices normalized (week=5 → week=1, day=10 → day=1)
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        schedule: expect.arrayContaining([
          expect.objectContaining({ week: 1, days: expect.arrayContaining([expect.objectContaining({ day: 1 })]) })
        ])
      })
    )
  })

  it('injeta contexto SM-2 no prompt quando enableSm2 é true', async () => {
    // given
    process.env.YOUTUBE_API_KEY = ''
    mockCalculateReviewSchedule.mockReturnValue([
      { topic: 'Limites', study_date: '2026-01-01', review_dates: ['+1d', '+3d'], ease_factor: 2.5 },
    ])
    mockChain.single = vi.fn()
      .mockResolvedValueOnce({ data: baseSubject, error: null })
      .mockResolvedValueOnce({ data: basePlan, error: null })
    mockGenerate.mockResolvedValueOnce(JSON.stringify(generatedPlan))
    // when
    await generateAndSavePlan({ ...basePlanInput, enableSm2: true })
    // then
    expect(mockCalculateReviewSchedule).toHaveBeenCalled()
    const [, userPrompt] = mockGenerate.mock.calls[0]
    expect(userPrompt).toContain('SM-2')
  })

  it('injeta contexto YouTube no prompt quando enableYoutube é true e API key está presente', async () => {
    // given
    process.env.YOUTUBE_API_KEY = 'test-key'
    mockSearchYoutube.mockResolvedValueOnce([
      { title: 'Cálculo para Engenharia', url: 'https://yt.be/abc', channel: 'Canal Exatas' },
    ])
    mockChain.single = vi.fn()
      .mockResolvedValueOnce({ data: baseSubject, error: null })
      .mockResolvedValueOnce({ data: basePlan, error: null })
    mockGenerate.mockResolvedValueOnce(JSON.stringify(generatedPlan))
    // when
    await generateAndSavePlan({ ...basePlanInput, enableYoutube: true })
    // then
    expect(mockSearchYoutube).toHaveBeenCalled()
    const [, userPrompt] = mockGenerate.mock.calls[0]
    expect(userPrompt).toContain('Cálculo para Engenharia')
  })

  it('lança erro quando a IA retorna JSON inválido para o plano', async () => {
    // given
    mockChain.single = vi.fn().mockResolvedValueOnce({ data: baseSubject, error: null })
    mockGenerate.mockResolvedValueOnce('isto não é json')
    // when / then
    await expect(generateAndSavePlan(basePlanInput))
      .rejects.toThrow('Falha ao parsear plano da IA. Tente novamente.')
  })

  it('lança erro quando o insert do plano no banco falha', async () => {
    // given
    const dbError = { message: 'DB constraint violation' }
    mockChain.single = vi.fn()
      .mockResolvedValueOnce({ data: baseSubject, error: null })
      .mockResolvedValueOnce({ data: null, error: dbError })
    mockGenerate.mockResolvedValueOnce(JSON.stringify(generatedPlan))
    // when / then
    await expect(generateAndSavePlan(basePlanInput)).rejects.toMatchObject(dbError)
  })
})

// ── completeSession ───────────────────────────────────────────────────────────

describe('completeSession', () => {
  it('insere sessão de estudo e atualiza o cronograma marcando o dia como concluído', async () => {
    // given
    const planWithSchedule = { ...basePlan, schedule: scheduleWithCompletedDay }
    mockChain.then = vi.fn(
      (ok?: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(ok)
    )
    mockChain.single = vi.fn(() => Promise.resolve({ data: planWithSchedule, error: null }))
    // when
    await completeSession('u1', 'plan-1', 1, 2)
    // then
    expect(mockFrom).toHaveBeenCalledWith('study_sessions')
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', plan_id: 'plan-1', week: 1, day: 2, completed: true })
    )
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ progress: expect.any(Number) })
    )
  })

  it('calcula o progresso corretamente (1 de 3 dias concluídos → ~33%)', async () => {
    // given
    const planWithSchedule = { ...basePlan, schedule: scheduleWithCompletedDay }
    mockChain.then = vi.fn(
      (ok?: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(ok)
    )
    mockChain.single = vi.fn(() => Promise.resolve({ data: planWithSchedule, error: null }))
    let updatedData: Record<string, unknown> = {}
    mockChain.update = vi.fn((data) => { updatedData = data; return mockChain })
    // when: mark day 2 as complete (day 1 was already complete)
    await completeSession('u1', 'plan-1', 1, 2)
    // then: 2 completed out of 3 total = 67%
    expect(updatedData.progress).toBe(67)
  })

  it('define status `completed` quando progress chega a 100%', async () => {
    // given: all days already completed except day 3
    const nearCompleteSchedule = [
      { week: 1, focus: 'S1', days: [
        { day: 1, topic: 'A', duration_minutes: 60, type: 'teoria', priority: 'alta', completed: true },
        { day: 2, topic: 'B', duration_minutes: 60, type: 'teoria', priority: 'alta', completed: true },
        { day: 3, topic: 'C', duration_minutes: 60, type: 'teoria', priority: 'alta', completed: false },
      ]},
    ]
    mockChain.then = vi.fn(
      (ok?: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(ok)
    )
    mockChain.single = vi.fn(() =>
      Promise.resolve({ data: { ...basePlan, schedule: nearCompleteSchedule }, error: null })
    )
    let updatedData: Record<string, unknown> = {}
    mockChain.update = vi.fn((data) => { updatedData = data; return mockChain })
    // when
    await completeSession('u1', 'plan-1', 1, 3)
    // then
    expect(updatedData.progress).toBe(100)
    expect(updatedData.status).toBe('completed')
  })

  it('retorna sem erro quando o plano não é encontrado após a inserção da sessão', async () => {
    // given: study_sessions insert succeeds but plans select returns null
    mockChain.then = vi.fn(
      (ok?: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: null, error: null }).then(ok)
    )
    mockChain.single = vi.fn(() => Promise.resolve({ data: null, error: null }))
    // when / then: should not throw
    await expect(completeSession('u1', 'plan-1', 1, 1)).resolves.toBeUndefined()
    expect(mockChain.update).not.toHaveBeenCalled()
  })
})
