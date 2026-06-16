/**
 * Shared test helpers for apps/api.
 *
 * Exports factory functions used across all test suites to build consistent
 * Supabase query-builder mocks and Anthropic module mocks, plus date utilities
 * and base fixtures for common domain objects. Call factories inside vi.hoisted()
 * in each test file so mock instances are available for vi.mock() wiring.
 */

import { vi } from 'vitest'

// ── Types ─────────────────────────────────────────────────────────────────────

export type MockResult = { data: unknown; error: unknown }

// ── Supabase chainable mock builder ──────────────────────────────────────────

/**
 * Builds a chainable Supabase query-builder mock backed by a result queue.
 * Call enqueue() to push { data, error } objects that successive DB calls
 * will consume in order. Unqueued calls resolve to { data: null, error: null }.
 */
export function makeChainableSupabaseMock() {
  const queue: MockResult[] = []
  const dequeue = (): MockResult => queue.shift() ?? { data: null, error: null }

  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'gte', 'is', 'limit', 'filter']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single      = vi.fn(() => Promise.resolve(dequeue()))
  chain.maybeSingle = vi.fn(() => Promise.resolve(dequeue()))
  chain.then = (
    ok?: (v: MockResult) => unknown,
    err?: (e: unknown) => unknown,
  ) => Promise.resolve(dequeue()).then(ok, err)

  const mockFrom = vi.fn(() => chain)
  const mockRpc  = vi.fn().mockResolvedValue({ error: null })

  return {
    mockFrom,
    mockRpc,
    chain,
    enqueue: (r: MockResult) => { queue.push(r) },
  }
}

// ── Anthropic module mock builder ─────────────────────────────────────────────

/**
 * Returns vi.fn() instances for generate() and generateWithTools() ready to be
 * wired with: vi.mock('../../lib/anthropic', () => makeAnthropicMock())
 */
export function makeAnthropicMock() {
  return {
    mockGenerate:          vi.fn<() => Promise<string>>(),
    mockGenerateWithTools: vi.fn<() => Promise<string>>(),
  }
}

// ── Date utilities ────────────────────────────────────────────────────────────

export const futureDate = (days: number): string =>
  new Date(Date.now() + days * 86_400_000).toISOString().split('T')[0]

export const pastDate = (days: number): string => futureDate(-days)

// ── Base fixtures ─────────────────────────────────────────────────────────────

export const baseSubject = {
  id:            'sub-1',
  name:          'Cálculo I',
  code:          'MAT101',
  course:        'Engenharia',
  university:    'UFMG',
  topics:        ['Limites', 'Derivadas', 'Integrais'],
  description:   'Fundamentos do cálculo diferencial e integral.',
  bibliography:  [],
  prerequisites: [],
  raw_text:      'Ementa de Cálculo I...',
  source_type:   'text',
}

export const basePlan = {
  id:            'plan-1',
  user_id:       'u1',
  subject_id:    'sub-1',
  title:         'Plano de Cálculo I',
  status:        'active',
  hours_per_day: 2,
  days_per_week: 5,
  exam_date:     null,
  total_weeks:   4,
  schedule:      [],
  progress:      0,
}

export const baseDiagnosticResult = {
  zdp_entry_point:               'Álgebra básica consolidada',
  critical_prerequisites:        ['Funções', 'Trigonometria'],
  risk_topics:                   ['Integrais impróprias'],
  estimated_difficulty:          'desafiador',
  recommended_scaffolding_start: 'alto',
  recommended_student_level:     'iniciante',
}
