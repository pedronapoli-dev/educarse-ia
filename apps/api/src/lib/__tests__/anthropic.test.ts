/**
 * Unit tests for apps/api/src/lib/anthropic.ts
 *
 * parseJsonResponse is a pure exported function tested directly. generate() and
 * generateWithTools() use the module-level Anthropic client instance, so
 * @anthropic-ai/sdk is mocked at module level via vi.hoisted() + vi.mock().
 * Tests cover: JSON parsing success/failure, code-fence stripping, non-text
 * block rejection, and the agentic loop termination paths (end_turn, tool_use
 * round-trip, max iterations exceeded).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock @anthropic-ai/sdk ────────────────────────────────────────────────────

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
}))

vi.mock('@anthropic-ai/sdk', () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate }
  },
}))

// ── Imports após mock ─────────────────────────────────────────────────────────

import { parseJsonResponse, generate, generateWithTools } from '../anthropic'

// ── Helpers ───────────────────────────────────────────────────────────────────

const textResponse = (text: string, stopReason = 'end_turn') => ({
  stop_reason: stopReason,
  content: [{ type: 'text', text }],
  usage: { input_tokens: 10, output_tokens: 20 },
})

const toolUseResponse = (toolName: string, toolId: string, input: unknown) => ({
  stop_reason: 'tool_use',
  content: [
    { type: 'tool_use', id: toolId, name: toolName, input },
  ],
  usage: { input_tokens: 10, output_tokens: 20 },
})

beforeEach(() => { vi.clearAllMocks() })

// ── parseJsonResponse ─────────────────────────────────────────────────────────

describe('parseJsonResponse', () => {
  it('parseia JSON válido e retorna o objeto tipado', () => {
    // given
    const json = '{"name":"Cálculo I","topics":["Limites"]}'
    // when
    const result = parseJsonResponse<{ name: string; topics: string[] }>(json, 'ementa')
    // then
    expect(result.name).toBe('Cálculo I')
    expect(result.topics).toEqual(['Limites'])
  })

  it('parseia array JSON válido', () => {
    // given
    const json = '[{"id":1},{"id":2}]'
    // when
    const result = parseJsonResponse<{ id: number }[]>(json, 'exercícios')
    // then
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe(1)
  })

  it('lança erro com mensagem em português quando o JSON é inválido', () => {
    // given
    const invalid = 'isso não é json {'
    // when / then
    expect(() => parseJsonResponse(invalid, 'diagnóstico'))
      .toThrow('Falha ao parsear diagnóstico da IA. Tente novamente.')
  })

  it('lança erro quando a string está vazia', () => {
    expect(() => parseJsonResponse('', 'plano')).toThrow('Falha ao parsear plano da IA')
  })
})

// ── generate ──────────────────────────────────────────────────────────────────

describe('generate', () => {
  it('retorna o texto do bloco quando stop_reason é end_turn', async () => {
    // given
    mockCreate.mockResolvedValueOnce(textResponse('{"resultado":"ok"}'))
    // when
    const result = await generate('system', 'user')
    // then
    expect(result).toBe('{"resultado":"ok"}')
  })

  it('remove code fences de respostas com ```json...```', async () => {
    // given
    const withFences = '```json\n{"key":"value"}\n```'
    mockCreate.mockResolvedValueOnce(textResponse(withFences))
    // when
    const result = await generate('system', 'user')
    // then
    expect(result).toBe('{"key":"value"}')
  })

  it('remove code fences simples de respostas com ```...```', async () => {
    // given
    mockCreate.mockResolvedValueOnce(textResponse('```\n[1,2,3]\n```'))
    // when
    const result = await generate('system', 'user')
    // then
    expect(result).toBe('[1,2,3]')
  })

  it('lança erro quando o bloco de conteúdo não é do tipo `text`', async () => {
    // given
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [{ type: 'tool_use', id: 'tu_1', name: 'some_tool', input: {} }],
      usage: { input_tokens: 5, output_tokens: 5 },
    })
    // when / then
    await expect(generate('system', 'user')).rejects.toThrow('Resposta inesperada da API')
  })

  it('passa maxTokens correto para a API', async () => {
    // given
    mockCreate.mockResolvedValueOnce(textResponse('{}'))
    // when
    await generate('system', 'user', 512)
    // then
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ max_tokens: 512 }))
  })
})

// ── generateWithTools ─────────────────────────────────────────────────────────

describe('generateWithTools', () => {
  const tools: never[] = []
  const toolExecutor = vi.fn()

  it('retorna o texto imediatamente quando stop_reason é end_turn na primeira iteração', async () => {
    // given
    mockCreate.mockResolvedValueOnce(textResponse('{"resultado":"diagnóstico"}'))
    // when
    const result = await generateWithTools('system', 'user', tools, toolExecutor, 1024)
    // then
    expect(result).toBe('{"resultado":"diagnóstico"}')
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(toolExecutor).not.toHaveBeenCalled()
  })

  it('executa a ferramenta e retorna o texto na segunda iteração (tool_use → end_turn)', async () => {
    // given
    mockCreate
      .mockResolvedValueOnce(toolUseResponse('get_plan_context', 'tu_abc', { plan_id: 'p1' }))
      .mockResolvedValueOnce(textResponse('{"resultado":"recalibrado"}'))
    toolExecutor.mockResolvedValueOnce({ topics_done: ['Limites'] })
    // when
    const result = await generateWithTools('system', 'user', tools, toolExecutor, 2048, 3)
    // then
    expect(result).toBe('{"resultado":"recalibrado"}')
    expect(toolExecutor).toHaveBeenCalledWith('get_plan_context', { plan_id: 'p1' })
    expect(mockCreate).toHaveBeenCalledTimes(2)
  })

  it('lança erro quando maxIterations é atingido sem end_turn', async () => {
    // given: always returns tool_use, never end_turn
    mockCreate.mockResolvedValue(toolUseResponse('tool', 'tu_1', {}))
    toolExecutor.mockResolvedValue({})
    // when / then
    await expect(
      generateWithTools('system', 'user', tools, toolExecutor, 1024, 2)
    ).rejects.toThrow('limite de iterações atingido')
  })

  it('lança erro quando end_turn não contém bloco de texto', async () => {
    // given
    mockCreate.mockResolvedValueOnce({
      stop_reason: 'end_turn',
      content: [],
      usage: { input_tokens: 5, output_tokens: 0 },
    })
    // when / then
    await expect(
      generateWithTools('system', 'user', tools, toolExecutor, 1024)
    ).rejects.toThrow('Resposta inesperada da API')
  })
})
