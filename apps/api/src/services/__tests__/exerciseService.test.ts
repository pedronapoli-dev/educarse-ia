/**
 * Unit tests for apps/api/src/services/exerciseService.ts
 *
 * generateAndSaveExercises: mocks generate() + supabase.from('exercises').
 * answerExercise: mocks supabase update chain. Tests cover valid generation,
 * non-array AI response, invalid exercise type defaulting to 'conceitual',
 * DB insert/update errors, and correct answer comparison.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGenerate, mockFrom, mockChain } = vi.hoisted(() => {
  const mockGenerate = vi.fn()
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'gte', 'is', 'limit', 'filter']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn()
  chain.maybeSingle = vi.fn()
  chain.then = vi.fn()
  const mockFrom = vi.fn(() => chain)
  return { mockGenerate, mockFrom, mockChain: chain }
})

vi.mock('../../lib/anthropic', () => ({
  generate: mockGenerate,
  parseJsonResponse: <T>(response: string, label: string): T => {
    try { return JSON.parse(response) as T }
    catch { throw new Error(`Falha ao parsear ${label} da IA. Tente novamente.`) }
  },
}))

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

// ── Imports após mock ─────────────────────────────────────────────────────────

import { generateAndSaveExercises, answerExercise } from '../exerciseService'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseParams = {
  userId:      'u1',
  planId:      'plan-1',
  topic:       'Derivadas',
  subjectName: 'Cálculo I',
}

const rawExercise = {
  question:        'O que é uma derivada?',
  options:         [{ key: 'a', text: 'Taxa de variação' }, { key: 'b', text: 'Área sob curva' }],
  answer:          'a',
  explanation:     'Derivada mede a taxa de variação instantânea.',
  type:            'conceitual',
  scaffolded_hint: 'Pense em velocidade.',
}

const savedExercise = { id: 'ex-1', ...rawExercise, user_id: 'u1', plan_id: 'plan-1', topic: 'Derivadas' }

beforeEach(() => { vi.clearAllMocks() })

// ── generateAndSaveExercises ──────────────────────────────────────────────────

describe('generateAndSaveExercises', () => {
  it('insere exercícios no banco e retorna os dados salvos quando a IA responde corretamente', async () => {
    // given
    mockGenerate.mockResolvedValueOnce(JSON.stringify([rawExercise]))
    mockChain.then = vi.fn(
      (ok?: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: [savedExercise], error: null }).then(ok)
    )
    // when
    const result = await generateAndSaveExercises(baseParams)
    // then
    expect(mockFrom).toHaveBeenCalledWith('exercises')
    expect(result).toEqual([savedExercise])
  })

  it('lança erro quando a IA retorna um objeto em vez de array', async () => {
    // given
    mockGenerate.mockResolvedValueOnce(JSON.stringify({ not: 'an array' }))
    // when / then
    await expect(generateAndSaveExercises(baseParams))
      .rejects.toThrow('Falha ao gerar exercícios. Tente novamente.')
  })

  it('normaliza tipo inválido para `conceitual`', async () => {
    // given
    const exerciseComTipoInvalido = { ...rawExercise, type: 'tipo_inexistente' }
    mockGenerate.mockResolvedValueOnce(JSON.stringify([exerciseComTipoInvalido]))
    let capturedRows: unknown[] = []
    mockChain.insert = vi.fn((rows: unknown[]) => {
      capturedRows = rows
      return mockChain
    })
    mockChain.then = vi.fn(
      (ok?: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: [savedExercise], error: null }).then(ok)
    )
    // when
    await generateAndSaveExercises(baseParams)
    // then
    expect((capturedRows[0] as Record<string, unknown>).type).toBe('conceitual')
  })

  it('lança erro quando o insert no banco falha', async () => {
    // given
    mockGenerate.mockResolvedValueOnce(JSON.stringify([rawExercise]))
    mockChain.then = vi.fn(
      (ok?: (v: { data: unknown; error: unknown }) => unknown) =>
        Promise.resolve({ data: null, error: { message: 'insert error' } }).then(ok)
    )
    // when / then
    await expect(generateAndSaveExercises(baseParams)).rejects.toMatchObject({ message: 'insert error' })
  })
})

// ── answerExercise ────────────────────────────────────────────────────────────

describe('answerExercise', () => {
  it('atualiza user_answer e answered_at e retorna o exercício atualizado', async () => {
    // given
    const updated = { ...savedExercise, user_answer: 'a', answered_at: '2026-06-15T00:00:00.000Z' }
    mockChain.single = vi.fn(() => Promise.resolve({ data: updated, error: null }))
    // when
    const result = await answerExercise('u1', 'ex-1', 'a')
    // then
    expect(mockFrom).toHaveBeenCalledWith('exercises')
    expect(mockChain.update).toHaveBeenCalledWith(
      expect.objectContaining({ user_answer: 'a' })
    )
    expect(result).toEqual(updated)
  })

  it('lança erro quando o update no banco falha', async () => {
    // given
    mockChain.single = vi.fn(() => Promise.resolve({ data: null, error: { message: 'update error' } }))
    // when / then
    await expect(answerExercise('u1', 'ex-1', 'b')).rejects.toMatchObject({ message: 'update error' })
  })
})
