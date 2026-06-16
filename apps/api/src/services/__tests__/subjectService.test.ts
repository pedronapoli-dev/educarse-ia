/**
 * Unit tests for apps/api/src/services/subjectService.ts
 *
 * extractTextFromPdf: mocks pdf-parse to avoid needing real PDFs.
 * parseSubjectFromText: mocks generate() and verifies text truncation at 12k chars.
 * saveSubject: mocks supabase.from('subjects') and checks insert fields and defaults.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { baseSubject } from '../../__tests__/helpers'

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

const mockPdfParse = vi.hoisted(() => vi.fn())

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

vi.mock('pdf-parse', () => ({
  default: mockPdfParse,
}))

// ── Imports após mock ─────────────────────────────────────────────────────────

import { extractTextFromPdf, parseSubjectFromText, saveSubject } from '../subjectService'
import type { ParsedSubject } from '@educarseia/types'

// ── Fixtures ──────────────────────────────────────────────────────────────────

const parsedSubject: ParsedSubject = {
  name:          'Cálculo I',
  code:          'MAT101',
  course:        'Engenharia',
  university:    'UFMG',
  credits:       4,
  workload_hours: 60,
  description:   'Fundamentos do cálculo.',
  topics:        ['Limites', 'Derivadas'],
  bibliography:  ['Stewart, Cálculo'],
  prerequisites: ['Pré-Cálculo'],
}

beforeEach(() => { vi.clearAllMocks() })

// ── extractTextFromPdf ────────────────────────────────────────────────────────

describe('extractTextFromPdf', () => {
  it('extrai e retorna o texto trimado do PDF', async () => {
    // given
    mockPdfParse.mockResolvedValueOnce({ text: '  Cálculo I — Ementa  ' })
    // when
    const result = await extractTextFromPdf(Buffer.from('%PDF'))
    // then
    expect(result).toBe('Cálculo I — Ementa')
    expect(mockPdfParse).toHaveBeenCalledWith(expect.any(Buffer))
  })
})

// ── parseSubjectFromText ──────────────────────────────────────────────────────

describe('parseSubjectFromText', () => {
  it('retorna ParsedSubject parseado quando a IA responde com JSON válido', async () => {
    // given
    mockGenerate.mockResolvedValueOnce(JSON.stringify(parsedSubject))
    // when
    const result = await parseSubjectFromText('texto da ementa')
    // then
    expect(result.name).toBe('Cálculo I')
    expect(result.topics).toEqual(['Limites', 'Derivadas'])
  })

  it('garante arrays não-nulos para topics, bibliography e prerequisites', async () => {
    // given: IA retorna campos nulos
    const withNulls = { ...parsedSubject, topics: null, bibliography: null, prerequisites: null }
    mockGenerate.mockResolvedValueOnce(JSON.stringify(withNulls))
    // when
    const result = await parseSubjectFromText('texto')
    // then
    expect(result.topics).toEqual([])
    expect(result.bibliography).toEqual([])
    expect(result.prerequisites).toEqual([])
  })

  it('trunca o texto para 12.000 caracteres antes de enviar para a IA', async () => {
    // given
    const longText = 'a'.repeat(15_000)
    mockGenerate.mockResolvedValueOnce(JSON.stringify(parsedSubject))
    // when
    await parseSubjectFromText(longText)
    // then: the 15k 'a' run must be cut — no consecutive sequence longer than 12k
    const [, userPrompt] = mockGenerate.mock.calls[0]
    expect(/a{12001,}/.test(userPrompt)).toBe(false)
    expect(userPrompt).toContain('a'.repeat(100)) // text was included, just truncated
  })

  it('passa o texto completo quando menor que 12.000 caracteres', async () => {
    // given
    const shortText = 'Ementa resumida de Cálculo I'
    mockGenerate.mockResolvedValueOnce(JSON.stringify(parsedSubject))
    // when
    await parseSubjectFromText(shortText)
    // then
    const [, userPrompt] = mockGenerate.mock.calls[0]
    expect(userPrompt).toContain(shortText)
  })

  it('lança erro quando a IA retorna JSON inválido', async () => {
    // given
    mockGenerate.mockResolvedValueOnce('não é json')
    // when / then
    await expect(parseSubjectFromText('texto')).rejects.toThrow('Falha ao parsear ementa da IA')
  })
})

// ── saveSubject ───────────────────────────────────────────────────────────────

describe('saveSubject', () => {
  it('insere a ementa no banco e retorna o registro salvo', async () => {
    // given
    mockChain.single = vi.fn(() => Promise.resolve({ data: baseSubject, error: null }))
    // when
    const result = await saveSubject('u1', parsedSubject, 'texto original')
    // then
    expect(mockFrom).toHaveBeenCalledWith('subjects')
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', name: 'Cálculo I', raw_text: 'texto original' })
    )
    expect(result).toEqual(baseSubject)
  })

  it('usa `pdf` como source_type padrão quando não fornecido', async () => {
    // given
    mockChain.single = vi.fn(() => Promise.resolve({ data: baseSubject, error: null }))
    // when
    await saveSubject('u1', parsedSubject, 'texto')
    // then
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: 'pdf' })
    )
  })

  it('usa source_type `text` quando fornecido explicitamente', async () => {
    // given
    mockChain.single = vi.fn(() => Promise.resolve({ data: baseSubject, error: null }))
    // when
    await saveSubject('u1', parsedSubject, 'texto', 'text')
    // then
    expect(mockChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ source_type: 'text' })
    )
  })

  it('lança erro quando o insert no banco falha', async () => {
    // given
    mockChain.single = vi.fn(() => Promise.resolve({ data: null, error: { message: 'DB error' } }))
    // when / then
    await expect(saveSubject('u1', parsedSubject, 'texto')).rejects.toMatchObject({ message: 'DB error' })
  })
})
