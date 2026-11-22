/**
 * Unit tests for apps/api/src/services/subjectService.ts
 *
 * Pipeline: pdf-parse → smartTruncate → extractEmentaStructure → generate (IA)
 *
 * parseSubjectFromText: mocks generate() — verifica retorno em array, wrap de objeto,
 *   normalização de campos nulos, truncamento em 50k chars e erros da IA.
 * parseSubjectFromPdf: mocks pdf-parse — verifica ScannedPdfError (texto < 200 chars),
 *   pipeline feliz com 1 ementa, ementário (múltiplas), e truncamento de texto longo.
 *   extractEmentaStructure roda de verdade (sem mock) — é determinístico e puro.
 * saveSubject: mocks supabase.from('subjects') e verifica campos do insert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { baseSubject } from '../../__tests__/helpers'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGenerate, mockPdfParse, mockFrom, mockChain } = vi.hoisted(() => {
  const mockGenerate = vi.fn()
  const mockPdfParse = vi.fn()
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'gte', 'is', 'limit', 'filter']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn()
  chain.maybeSingle = vi.fn()
  chain.then = vi.fn()
  const mockFrom = vi.fn(() => chain)
  return { mockGenerate, mockPdfParse, mockFrom, mockChain: chain }
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

vi.mock('pdf-parse', () => ({
  default: mockPdfParse,
}))

// ── Imports após mock ─────────────────────────────────────────────────────────

import { parseSubjectFromText, parseSubjectFromPdf, saveSubject, ScannedPdfError } from '../subjectService'
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

const parsedSubject2: ParsedSubject = {
  name:          'Álgebra Linear',
  code:          'MAT202',
  course:        'Engenharia',
  university:    'UFMG',
  credits:       4,
  workload_hours: 60,
  description:   'Vetores e matrizes.',
  topics:        ['Vetores', 'Matrizes'],
  bibliography:  ['Strang, Linear Algebra'],
  prerequisites: [],
}

beforeEach(() => { vi.clearAllMocks() })

// ── parseSubjectFromText ──────────────────────────────────────────────────────

describe('parseSubjectFromText', () => {
  it('retorna array com 1 elemento quando a IA retorna um único objeto', async () => {
    // given: IA retorna objeto único (fallback legado)
    mockGenerate.mockResolvedValueOnce(JSON.stringify(parsedSubject))
    // when
    const result = await parseSubjectFromText('texto da ementa')
    // then
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Cálculo I')
  })

  it('retorna array com 1 elemento quando a IA já retorna array de 1', async () => {
    // given
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    const result = await parseSubjectFromText('texto da ementa')
    // then
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Cálculo I')
  })

  it('retorna array com 3 elementos para Ementário com 3 disciplinas', async () => {
    // given
    const three = [parsedSubject, parsedSubject2, { ...parsedSubject, name: 'Cálculo II', code: 'MAT102' }]
    mockGenerate.mockResolvedValueOnce(JSON.stringify(three))
    // when
    const result = await parseSubjectFromText('ementário com 3 disciplinas')
    // then
    expect(result).toHaveLength(3)
    expect(result.map(s => s.name)).toEqual(['Cálculo I', 'Álgebra Linear', 'Cálculo II'])
  })

  it('normaliza arrays nulos (topics, bibliography, prerequisites) para []', async () => {
    // given: IA retorna campos nulos
    const withNulls = { ...parsedSubject, topics: null, bibliography: null, prerequisites: null }
    mockGenerate.mockResolvedValueOnce(JSON.stringify([withNulls]))
    // when
    const result = await parseSubjectFromText('texto')
    // then
    expect(result[0].topics).toEqual([])
    expect(result[0].bibliography).toEqual([])
    expect(result[0].prerequisites).toEqual([])
  })

  it('lança erro quando a IA retorna array vazio', async () => {
    // given
    mockGenerate.mockResolvedValueOnce('[]')
    // when / then
    await expect(parseSubjectFromText('texto')).rejects.toThrow('IA retornou lista vazia de ementas')
  })

  it('lança erro quando a IA retorna JSON inválido', async () => {
    // given
    mockGenerate.mockResolvedValueOnce('não é json')
    // when / then
    await expect(parseSubjectFromText('texto')).rejects.toThrow('Falha ao parsear ementa da IA')
  })

  it('trunca texto para 50.000 caracteres antes de enviar para a IA', async () => {
    // given
    const longText = 'a'.repeat(55_000)
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    await parseSubjectFromText(longText)
    // then: nenhuma sequência de 'a' com mais de 50k deve existir no prompt
    const [, userPrompt] = mockGenerate.mock.calls[0]
    expect(/a{50001,}/.test(userPrompt)).toBe(false)
    expect(userPrompt).toContain('a'.repeat(100))
  })

  it('passa o texto completo quando menor que 50.000 caracteres', async () => {
    // given
    const shortText = 'Ementa resumida de Cálculo I'
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    await parseSubjectFromText(shortText)
    // then
    const [, userPrompt] = mockGenerate.mock.calls[0]
    expect(userPrompt).toContain(shortText)
  })
})

// ── parseSubjectFromPdf ───────────────────────────────────────────────────────
//
// Pipeline: pdf-parse → ScannedPdfError? → smartTruncate → extractEmentaStructure → generate
// extractEmentaStructure não é mockado — é determinístico, pode rodar de verdade.

/** Texto rico suficiente para passar o threshold de 200 chars e ter campos detectáveis. */
const PDF_TEXT_SINGLE = `
Universidade Federal de São Paulo
Disciplina: Cálculo I
Código: MAT101
Carga Horária: 60h
Créditos: 4

Ementa
Funções, limites, derivadas e integrais de funções de uma variável real.

Conteúdo Programático
1. Limites e continuidade
2. Derivadas e regras de diferenciação
3. Integrais indefinidas e definidas
`.trim()

/** Texto com 3 códigos distintos → detectado como ementário (likelyMultiple=true). */
const PDF_TEXT_EMENTARIO = `
EMENTÁRIO DE DISCIPLINAS

Disciplina: Cálculo I — MAT101 — 60h
Conteúdo Programático
1. Limites

Disciplina: Álgebra Linear — MAT202 — 60h
Conteúdo Programático
1. Vetores

Disciplina: Física I — FIS101 — 60h
Conteúdo Programático
1. Mecânica
`.trim()

describe('parseSubjectFromPdf', () => {
  it('lança ScannedPdfError quando o PDF não contém texto extraível (vazio)', async () => {
    // given: pdf-parse típico de PDF escaneado — retorna texto em branco
    mockPdfParse.mockResolvedValueOnce({ text: '   \n\t  ' })
    // when / then
    await expect(parseSubjectFromPdf(Buffer.from('%PDF'))).rejects.toBeInstanceOf(ScannedPdfError)
  })

  it('lança ScannedPdfError quando texto extraído tem menos de 200 chars', async () => {
    // given: texto muito curto para extração confiável
    mockPdfParse.mockResolvedValueOnce({ text: 'Cálculo I — ementa breve.' })
    // when / then
    await expect(parseSubjectFromPdf(Buffer.from('%PDF'))).rejects.toThrow('PDF sem camada de texto detectada.')
  })

  it('retorna 1 ementa quando PDF tem texto suficiente (pipeline feliz)', async () => {
    // given
    mockPdfParse.mockResolvedValueOnce({ text: PDF_TEXT_SINGLE })
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    const result = await parseSubjectFromPdf(Buffer.from('%PDF'))
    // then
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('Cálculo I')
    expect(mockGenerate).toHaveBeenCalledTimes(1)
  })

  it('retorna múltiplas ementas quando PDF é ementário (3+ códigos)', async () => {
    // given: ementário com 3 disciplinas distintas
    mockPdfParse.mockResolvedValueOnce({ text: PDF_TEXT_EMENTARIO })
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject, parsedSubject2]))
    // when
    const result = await parseSubjectFromPdf(Buffer.from('%PDF'))
    // then
    expect(result).toHaveLength(2)
    expect(result[1].name).toBe('Álgebra Linear')
  })

  it('trunca texto longo antes do extractor e insere marcador no prompt', async () => {
    // given: texto muito longo (>50k chars)
    const longText = 'Cálculo Diferencial. '.repeat(3000) // ~63k chars
    mockPdfParse.mockResolvedValueOnce({ text: longText })
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    await parseSubjectFromPdf(Buffer.from('%PDF'))
    // then: o prompt enviado para a IA contém o marcador de truncamento
    const [, userPrompt] = mockGenerate.mock.calls[0]
    expect(userPrompt).toContain('[...trecho intermediário omitido...]')
  })

  it('não trunca quando texto está dentro do limite de 50k chars', async () => {
    // given: texto exatamente dentro do limite
    const normalText = PDF_TEXT_SINGLE + '\n' + 'Conteúdo extra. '.repeat(100)
    mockPdfParse.mockResolvedValueOnce({ text: normalText })
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    await parseSubjectFromPdf(Buffer.from('%PDF'))
    // then: nenhum marcador de truncamento no prompt
    const [, userPrompt] = mockGenerate.mock.calls[0]
    expect(userPrompt).not.toContain('[...trecho intermediário omitido...]')
  })

  it('normaliza arrays nulos (topics, bibliography, prerequisites) retornados pela IA', async () => {
    // given: IA retorna campos nulos
    const withNulls = { ...parsedSubject, topics: null, bibliography: null, prerequisites: null }
    mockPdfParse.mockResolvedValueOnce({ text: PDF_TEXT_SINGLE })
    mockGenerate.mockResolvedValueOnce(JSON.stringify([withNulls]))
    // when
    const result = await parseSubjectFromPdf(Buffer.from('%PDF'))
    // then
    expect(result[0].topics).toEqual([])
    expect(result[0].bibliography).toEqual([])
    expect(result[0].prerequisites).toEqual([])
  })

  it('lança erro quando a IA retorna array vazio', async () => {
    // given
    mockPdfParse.mockResolvedValueOnce({ text: PDF_TEXT_SINGLE })
    mockGenerate.mockResolvedValueOnce('[]')
    // when / then
    await expect(parseSubjectFromPdf(Buffer.from('%PDF'))).rejects.toThrow('IA retornou lista vazia de ementas')
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
