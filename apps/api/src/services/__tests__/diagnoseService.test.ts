/**
 * Unit tests for apps/api/src/services/diagnoseService.ts
 *
 * runDiagnosis is the simplest service: one generate() call, no DB write.
 * lib/anthropic is mocked at module level — generate() is replaced by a vi.fn()
 * while parseJsonResponse keeps its real implementation (inlined) so the
 * JSON parsing and error messages remain faithful. Tests verify prompt content,
 * maxTokens, successful parsing, and parse-failure propagation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { baseDiagnosticResult } from '../../__tests__/helpers'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }))

vi.mock('../../lib/anthropic', () => ({
  generate: mockGenerate,
  parseJsonResponse: <T>(response: string, label: string): T => {
    try { return JSON.parse(response) as T }
    catch { throw new Error(`Falha ao parsear ${label} da IA. Tente novamente.`) }
  },
}))

// ── Imports após mock ─────────────────────────────────────────────────────────

import { runDiagnosis } from '../diagnoseService'
import type { DiagnoseStudentInput } from '../../lib/prompts'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const baseInput: DiagnoseStudentInput = {
  subjectName:         'Cálculo I',
  topics:              ['Limites', 'Derivadas'],
  priorKnowledgeLevel: 4,
  learningFormats:     ['videos', 'exercicios'],
  applicationContext:  'Engenharia de Software',
  weeklyHours:         8,
}

beforeEach(() => { vi.clearAllMocks() })

// ── runDiagnosis ──────────────────────────────────────────────────────────────

describe('runDiagnosis', () => {
  it('retorna DiagnosticResult parseado quando a IA responde com JSON válido', async () => {
    // given
    mockGenerate.mockResolvedValueOnce(JSON.stringify(baseDiagnosticResult))
    // when
    const result = await runDiagnosis(baseInput)
    // then
    expect(result.zdp_entry_point).toBe(baseDiagnosticResult.zdp_entry_point)
    expect(result.critical_prerequisites).toEqual(baseDiagnosticResult.critical_prerequisites)
    expect(result.risk_topics).toEqual(baseDiagnosticResult.risk_topics)
    expect(result.estimated_difficulty).toBe(baseDiagnosticResult.estimated_difficulty)
  })

  it('chama generate() com maxTokens 512 conforme especificado no serviço', async () => {
    // given
    mockGenerate.mockResolvedValueOnce(JSON.stringify(baseDiagnosticResult))
    // when
    await runDiagnosis(baseInput)
    // then
    const [, , maxTokens] = mockGenerate.mock.calls[0]
    expect(maxTokens).toBe(512)
  })

  it('inclui o nome da disciplina no prompt do usuário enviado para a IA', async () => {
    // given
    mockGenerate.mockResolvedValueOnce(JSON.stringify(baseDiagnosticResult))
    // when
    await runDiagnosis(baseInput)
    // then
    const [, userPrompt] = mockGenerate.mock.calls[0]
    expect(userPrompt).toContain('Cálculo I')
  })

  it('lança erro com mensagem em português quando a IA retorna JSON inválido', async () => {
    // given
    mockGenerate.mockResolvedValueOnce('isso não é json')
    // when / then
    await expect(runDiagnosis(baseInput))
      .rejects.toThrow('Falha ao parsear diagnóstico da IA. Tente novamente.')
  })
})
