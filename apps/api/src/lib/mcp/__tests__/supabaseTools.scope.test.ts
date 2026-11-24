import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, queryCalls } = vi.hoisted(() => {
  const queryCalls: { table: string; column: string; value: unknown }[] = []
  const mockFrom = vi.fn((table: string) => {
    const queryChain: Record<string, unknown> = {}
    queryChain.select = vi.fn(() => queryChain)
    queryChain.not = vi.fn(() => queryChain)
    queryChain.gte = vi.fn(() => queryChain)
    queryChain.eq = vi.fn((column: string, value: unknown) => {
      queryCalls.push({ table, column, value })
      return queryChain
    })
    queryChain.single = vi.fn(() => Promise.resolve({
      data: { schedule: [], total_weeks: 4, exam_date: null, progress: 0 },
      error: null,
    }))
    queryChain.then = (onFulfilled: (result: { data: unknown[]; error: null }) => unknown) =>
      Promise.resolve({ data: [], error: null }).then(onFulfilled)
    return queryChain
  })
  return { mockFrom, queryCalls }
})

vi.mock('../../supabase', () => ({ supabase: { from: mockFrom } }))

import { executeSupabaseTool, SUPABASE_TOOLS } from '../supabaseTools'

const SCOPE = { userId: 'user-1', planId: 'plan-1' }
const FOREIGN_INPUT = { plan_id: 'plan-de-outro-usuario', week_number: 1 }

beforeEach(() => {
  vi.clearAllMocks()
  queryCalls.length = 0
})

describe('escopo das tools de plano', () => {
  it('não expõe plan_id no schema de nenhuma tool', () => {
    for (const tool of SUPABASE_TOOLS) {
      expect(Object.keys(tool.input_schema.properties ?? {})).not.toContain('plan_id')
      expect(tool.input_schema.required ?? []).not.toContain('plan_id')
    }
  })

  it.each(['get_student_progress', 'get_spaced_review_status', 'get_plan_context'])(
    '%s ignora plan_id vindo do modelo e filtra pelo escopo do servidor',
    async (toolName) => {
      await executeSupabaseTool(SCOPE, toolName, FOREIGN_INPUT)

      const tables = new Set(queryCalls.map(call => call.table))
      for (const table of tables) {
        expect(queryCalls).toContainEqual({ table, column: 'user_id', value: SCOPE.userId })
      }
      expect(queryCalls.some(call => call.value === FOREIGN_INPUT.plan_id)).toBe(false)
    },
  )
})
