/**
 * Unit tests for apps/api/src/services/checkinService.ts
 *
 * runCheckin has two paths: Phase 1 (no planId) uses generate(); Phase 2
 * (scope provided) uses generateWithTools() with CHECKIN_TOOLS and a scoped dispatcher.
 * lib/anthropic and lib/mcp/registry are mocked. Tests verify which function is
 * called, that the dispatcher is bound to the server-side scope, and that JSON parse
 * failures propagate correctly in both phases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGenerate, mockGenerateWithTools, mockDispatchTool, mockCreatePlanToolDispatcher } = vi.hoisted(() => ({
  mockGenerate:          vi.fn(),
  mockGenerateWithTools: vi.fn(),
  mockDispatchTool:      vi.fn(),
  mockCreatePlanToolDispatcher: vi.fn(),
}))

vi.mock('../../lib/anthropic', () => ({
  generate:              mockGenerate,
  generateWithTools:     mockGenerateWithTools,
  parseJsonResponse: <T>(response: string, label: string): T => {
    try { return JSON.parse(response) as T }
    catch { throw new Error(`Falha ao parsear ${label} da IA. Tente novamente.`) }
  },
}))

vi.mock('../../lib/mcp/supabaseTools', () => ({
  CHECKIN_TOOLS: [],
}))

vi.mock('../../lib/mcp/registry', () => ({
  createPlanToolDispatcher: mockCreatePlanToolDispatcher,
}))

// ── Imports após mock ─────────────────────────────────────────────────────────

import { runCheckin } from '../checkinService'
import type { CheckinInput } from '../../lib/prompts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseCheckinInput: CheckinInput = {
  week:                     2,
  topicsCovered:            ['Limites'],
  masteryCriteriaResults:   [{ topic: 'Limites', achieved: true }],
  spacedReviewsDone:        true,
  difficulties:             'Nenhuma',
  hoursStudiedThisWeek:     5,
  hoursPlannedThisWeek:     6,
  applicationContext:       'Engenharia de Software',
}

const baseCheckinResult = {
  week:                    2,
  quantitative_progress:   85,
  qualitative_progress:    90,
  spaced_reviews_completed: true,
  difficulties:            'Nenhuma',
  performance_trend:       'no-ritmo',
  proposed_action:         'manter',
  action_rationale:        'Progresso consistente.',
}

const PLAN_TOOL_SCOPE = { userId: 'user-1', planId: 'plan-xyz' }

beforeEach(() => {
  vi.clearAllMocks()
  mockCreatePlanToolDispatcher.mockReturnValue(mockDispatchTool)
})

// ── runCheckin (Phase 1 — sem planId) ─────────────────────────────────────────

describe('runCheckin', () => {
  describe('quando planId não é fornecido (Phase 1)', () => {
    it('chama generate() e retorna PlanCheckin parseado', async () => {
      // given
      mockGenerate.mockResolvedValueOnce(JSON.stringify(baseCheckinResult))
      // when
      const result = await runCheckin(baseCheckinInput)
      // then
      expect(mockGenerate).toHaveBeenCalledTimes(1)
      expect(mockGenerateWithTools).not.toHaveBeenCalled()
      expect(result.performance_trend).toBe('no-ritmo')
      expect(result.proposed_action).toBe('manter')
    })

    it('chama generate() com maxTokens 1024', async () => {
      // given
      mockGenerate.mockResolvedValueOnce(JSON.stringify(baseCheckinResult))
      // when
      await runCheckin(baseCheckinInput)
      // then
      const [, , maxTokens] = mockGenerate.mock.calls[0]
      expect(maxTokens).toBe(1024)
    })

    it('lança erro quando a IA retorna JSON inválido na Phase 1', async () => {
      // given
      mockGenerate.mockResolvedValueOnce('não é json')
      // when / then
      await expect(runCheckin(baseCheckinInput))
        .rejects.toThrow('Falha ao parsear check-in da IA. Tente novamente.')
    })
  })

  describe('quando planId é fornecido (Phase 2)', () => {
    it('chama generateWithTools() e não chama generate()', async () => {
      // given
      mockGenerateWithTools.mockResolvedValueOnce(JSON.stringify(baseCheckinResult))
      // when
      await runCheckin(baseCheckinInput, PLAN_TOOL_SCOPE)
      // then
      expect(mockGenerateWithTools).toHaveBeenCalledTimes(1)
      expect(mockGenerate).not.toHaveBeenCalled()
    })

    it('vincula o dispatcher ao escopo do servidor sem expor o planId no prompt', async () => {
      // given
      mockGenerateWithTools.mockResolvedValueOnce(JSON.stringify(baseCheckinResult))
      // when
      await runCheckin(baseCheckinInput, PLAN_TOOL_SCOPE)
      // then
      const [, userPrompt, , toolExecutor] = mockGenerateWithTools.mock.calls[0]
      expect(mockCreatePlanToolDispatcher).toHaveBeenCalledWith(PLAN_TOOL_SCOPE)
      expect(toolExecutor).toBe(mockDispatchTool)
      expect(userPrompt).not.toContain(PLAN_TOOL_SCOPE.planId)
    })

    it('chama generateWithTools() com maxIterations 3', async () => {
      // given
      mockGenerateWithTools.mockResolvedValueOnce(JSON.stringify(baseCheckinResult))
      // when
      await runCheckin(baseCheckinInput, PLAN_TOOL_SCOPE)
      // then
      const [, , , , , maxIterations] = mockGenerateWithTools.mock.calls[0]
      expect(maxIterations).toBe(3)
    })

    it('lança erro quando a IA retorna JSON inválido na Phase 2', async () => {
      // given
      mockGenerateWithTools.mockResolvedValueOnce('não é json')
      // when / then
      await expect(runCheckin(baseCheckinInput, PLAN_TOOL_SCOPE))
        .rejects.toThrow('Falha ao parsear check-in da IA. Tente novamente.')
    })
  })
})
