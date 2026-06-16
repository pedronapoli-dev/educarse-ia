/**
 * Unit tests for apps/api/src/services/recalibrateService.ts
 *
 * runRecalibration mirrors runCheckin's Phase 1/Phase 2 structure. Phase 1
 * (no planId) uses generate() with maxTokens 2048. Phase 2 (planId provided)
 * uses generateWithTools() with RECALIBRATE_TOOLS and maxIterations 3.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGenerate, mockGenerateWithTools } = vi.hoisted(() => ({
  mockGenerate:          vi.fn(),
  mockGenerateWithTools: vi.fn(),
}))

vi.mock('../../lib/anthropic', () => ({
  generate:          mockGenerate,
  generateWithTools: mockGenerateWithTools,
  parseJsonResponse: <T>(response: string, label: string): T => {
    try { return JSON.parse(response) as T }
    catch { throw new Error(`Falha ao parsear ${label} da IA. Tente novamente.`) }
  },
}))

vi.mock('../../lib/mcp/supabaseTools', () => ({
  RECALIBRATE_TOOLS: [],
}))

vi.mock('../../lib/mcp/registry', () => ({
  dispatchTool: vi.fn(),
}))

// ── Imports após mock ─────────────────────────────────────────────────────────

import { runRecalibration } from '../recalibrateService'
import type { RecalibrateInput } from '../../lib/prompts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseInput: RecalibrateInput = {
  blockedTopic:        'Derivadas',
  blockType:           'compreensão',
  weeksCurrent:        3,
  weeksRemaining:      5,
  topicsRemaining:     ['Integrais'],
  topicsDone:          ['Limites'],
  applicationContext:  'Engenharia',
  currentScaffolding:  'alto',
}

const baseResult = {
  diagnosis:             'Dificuldade conceitual em Derivadas.',
  root_cause:            'ZDP violado',
  actions:               [{ action_type: 'subdividir_topico', target_topic: 'Derivadas', description: 'Dividir em subtópicos.', rationale: 'Reduz carga cognitiva.' }],
  new_scaffolding_level: 'alto',
  topics_to_skip:        [],
  motivational_message:  'Você está progredindo!',
  revised_timeline:      null,
}

beforeEach(() => { vi.clearAllMocks() })

// ── runRecalibration ──────────────────────────────────────────────────────────

describe('runRecalibration', () => {
  describe('quando planId não é fornecido (Phase 1)', () => {
    it('chama generate() e retorna RecalibrateResult parseado', async () => {
      // given
      mockGenerate.mockResolvedValueOnce(JSON.stringify(baseResult))
      // when
      const result = await runRecalibration(baseInput)
      // then
      expect(mockGenerate).toHaveBeenCalledTimes(1)
      expect(mockGenerateWithTools).not.toHaveBeenCalled()
      expect(result.diagnosis).toBe(baseResult.diagnosis)
      expect(result.root_cause).toBe('ZDP violado')
    })

    it('chama generate() com maxTokens 2048', async () => {
      // given
      mockGenerate.mockResolvedValueOnce(JSON.stringify(baseResult))
      // when
      await runRecalibration(baseInput)
      // then
      const [, , maxTokens] = mockGenerate.mock.calls[0]
      expect(maxTokens).toBe(2048)
    })

    it('lança erro quando a IA retorna JSON inválido na Phase 1', async () => {
      // given
      mockGenerate.mockResolvedValueOnce('não é json')
      // when / then
      await expect(runRecalibration(baseInput))
        .rejects.toThrow('Falha ao parsear recalibração da IA. Tente novamente.')
    })
  })

  describe('quando planId é fornecido (Phase 2)', () => {
    it('chama generateWithTools() e não chama generate()', async () => {
      // given
      mockGenerateWithTools.mockResolvedValueOnce(JSON.stringify(baseResult))
      // when
      await runRecalibration(baseInput, 'plan-1')
      // then
      expect(mockGenerateWithTools).toHaveBeenCalledTimes(1)
      expect(mockGenerate).not.toHaveBeenCalled()
    })

    it('inclui o planId no prompt enviado para generateWithTools()', async () => {
      // given
      mockGenerateWithTools.mockResolvedValueOnce(JSON.stringify(baseResult))
      // when
      await runRecalibration(baseInput, 'plan-abc')
      // then
      const [, userPrompt] = mockGenerateWithTools.mock.calls[0]
      expect(userPrompt).toContain('plan-abc')
    })

    it('chama generateWithTools() com maxIterations 3', async () => {
      // given
      mockGenerateWithTools.mockResolvedValueOnce(JSON.stringify(baseResult))
      // when
      await runRecalibration(baseInput, 'plan-1')
      // then
      const [, , , , , maxIterations] = mockGenerateWithTools.mock.calls[0]
      expect(maxIterations).toBe(3)
    })

    it('lança erro quando a IA retorna JSON inválido na Phase 2', async () => {
      // given
      mockGenerateWithTools.mockResolvedValueOnce('não é json')
      // when / then
      await expect(runRecalibration(baseInput, 'plan-1'))
        .rejects.toThrow('Falha ao parsear recalibração da IA. Tente novamente.')
    })
  })
})
