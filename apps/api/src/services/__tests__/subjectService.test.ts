/**
 * Unit tests for apps/api/src/services/subjectService.ts
 *
 * Pipeline: pdfjs (ou OCR) → smartTruncate → extractEmentaStructure → generate (IA)
 *
 * parseSubjectFromText: mocks generate() — verifica retorno em array, wrap de objeto,
 *   normalização de campos nulos, truncamento em 50k chars e erros da IA.
 * parseSubjectFromPdf: mocks pdfjs e os binários de OCR — verifica fallback para OCR,
 *   erros de PDF, pipeline feliz com 1 ementa, ementário e truncamento de texto longo.
 *   extractEmentaStructure roda de verdade (sem mock) — é determinístico e puro.
 * saveSubject: mocks supabase.from('subjects') e verifica campos do insert.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { baseSubject } from '../../__tests__/helpers'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const { mockGenerate, mockGetDocument, mockExecFile, mockFrom, mockChain } = vi.hoisted(() => {
  const mockGenerate = vi.fn()
  const mockGetDocument = vi.fn()
  const mockExecFile = vi.fn()
  const chain: Record<string, unknown> = {}
  for (const m of ['select', 'insert', 'update', 'delete', 'eq', 'order', 'gte', 'is', 'limit', 'filter']) {
    chain[m] = vi.fn(() => chain)
  }
  chain.single = vi.fn()
  chain.maybeSingle = vi.fn()
  chain.then = vi.fn()
  const mockFrom = vi.fn(() => chain)
  return { mockGenerate, mockGetDocument, mockExecFile, mockFrom, mockChain: chain }
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

vi.mock('pdfjs-dist/legacy/build/pdf.js', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  OPS: { paintImageXObject: 85, paintImageXObjectRepeat: 88, paintInlineImageXObject: 86, paintImageMaskXObject: 83 },
  getDocument: mockGetDocument,
}))

vi.mock('../../lib/ocr-image', () => ({
  prepareImageForOcr: vi.fn(async () => undefined),
}))

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}))

// ── Imports após mock ─────────────────────────────────────────────────────────

import {
  completeEmentarioEntries,
  MAX_OCR_PAGES,
  parseSubjectFromText,
  parseSubjectFromPdf,
  PdfProcessingError,
  saveSubject,
  ScannedPdfError,
} from '../subjectService'
import type { SubjectParseOutcome } from '../subjectService'
import type { ParsedSubject } from '@educarseia/types'

const expectSingle = (outcome: SubjectParseOutcome): ParsedSubject => {
  if (outcome.kind !== 'single') throw new Error(`Esperava ementa única, recebeu ${outcome.kind}`)
  return outcome.subject
}

// ── Helpers de PDF ────────────────────────────────────────────────────────────

type MockPdfPage = { text: string; hasImage?: boolean }

const IMAGE_OPERATOR = 85

const toTextItems = (text: string) => text.split('\n').map((line, lineIndex) => ({
  str: line,
  transform: [1, 0, 0, 12, 72, 720 - lineIndex * 14],
  width: line.length * 6,
  height: 12,
}))

const mockPdfPages = (pages: MockPdfPage[]): void => {
  mockGetDocument.mockReturnValueOnce({
    promise: Promise.resolve({
      numPages: pages.length,
      getPage: async (pageNumber: number) => ({
        getTextContent: async () => ({ items: toTextItems(pages[pageNumber - 1].text) }),
        getOperatorList: async () => ({ fnArray: pages[pageNumber - 1].hasImage ? [IMAGE_OPERATOR] : [] }),
      }),
      destroy: async () => undefined,
    }),
  })
}

const mockPdfText = (text: string, pageCount = 1): void => {
  mockPdfPages(Array.from({ length: pageCount }, (_, pageIndex) => ({ text: pageIndex === 0 ? text : '' })))
}

type ExecFileCallback = (error: Error | null, result?: { stdout: string; stderr: string }) => void

/** Simula pdftoppm e tesseract; este último devolve o texto informado. */
const mockOcrOutput = (ocrText: string): void => {
  mockExecFile.mockImplementation((command: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
    callback(null, { stdout: command === 'tesseract' ? ocrText : '', stderr: '' })
  })
}

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
    const result = expectSingle(await parseSubjectFromText('texto da ementa'))
    // then
    expect(result.name).toBe('Cálculo I')
  })

  it('retorna array com 1 elemento quando a IA já retorna array de 1', async () => {
    // given
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    const result = expectSingle(await parseSubjectFromText('texto da ementa'))
    // then
    expect(result.name).toBe('Cálculo I')
  })

  it('separa ementário colado como texto sem chamar a IA', async () => {
    // when
    const outcome = await parseSubjectFromText(PDF_TEXT_EMENTARIO)
    // then
    expect(outcome.kind).toBe('ementario')
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('recusa várias ementas que não podem ser separadas', async () => {
    // given
    const text = 'Cálculo I\nEMENTA\nLimites e derivadas.\n\nFísica I\nEMENTA\nMecânica clássica.'
    // when / then
    await expect(parseSubjectFromText(text)).rejects.toMatchObject({ code: 'PDF_EMENTARIO_UNRECOGNIZED' })
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('normaliza arrays nulos (topics, bibliography, prerequisites) para []', async () => {
    // given: IA retorna campos nulos
    const withNulls = { ...parsedSubject, topics: null, bibliography: null, prerequisites: null }
    mockGenerate.mockResolvedValueOnce(JSON.stringify([withNulls]))
    // when
    const result = expectSingle(await parseSubjectFromText('texto'))
    // then
    expect(result.topics).toEqual([])
    expect(result.bibliography).toEqual([])
    expect(result.prerequisites).toEqual([])
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
  it('lança ScannedPdfError quando nem a camada de texto nem o OCR têm conteúdo', async () => {
    // given: PDF escaneado cuja imagem também não tem texto reconhecível
    mockPdfText('   \n\t  ')
    mockOcrOutput('')
    // when / then
    await expect(parseSubjectFromPdf(Buffer.from('%PDF'))).rejects.toBeInstanceOf(ScannedPdfError)
  })

  it('lança ScannedPdfError quando texto e OCR têm menos de 50 chars', async () => {
    // given: texto muito curto para extração confiável
    mockPdfText('Cálculo I — ementa breve.')
    mockOcrOutput('Cálculo I')
    // when / then
    await expect(parseSubjectFromPdf(Buffer.from('%PDF'))).rejects.toThrow('PDF sem camada de texto detectada.')
  })

  it('usa o texto do OCR quando o PDF não tem camada de texto', async () => {
    // given
    mockPdfText('')
    mockOcrOutput(PDF_TEXT_SINGLE)
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    const result = expectSingle(await parseSubjectFromPdf(Buffer.from('%PDF')))
    // then
    expect(result.name).toBe('Cálculo I')
    expect(mockExecFile.mock.calls.map(([command]) => command)).toEqual(['pdftoppm', 'tesseract'])
    expect(mockGenerate.mock.calls[0][1]).toContain('MAT101')
  })

  it('não executa OCR quando o PDF escaneado passa do limite de páginas', async () => {
    // given
    mockPdfText('', MAX_OCR_PAGES + 1)
    // when / then
    await expect(parseSubjectFromPdf(Buffer.from('%PDF'))).rejects.toMatchObject({ code: 'PDF_OCR_TOO_LONG' })
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  it('classifica falha dos binários de OCR como PDF_OCR_FAILED', async () => {
    // given: tesseract/poppler não instalados
    mockPdfText('')
    mockExecFile.mockImplementation((_command: string, _args: string[], _options: unknown, callback: ExecFileCallback) => {
      callback(Object.assign(new Error('spawn pdftoppm ENOENT'), { code: 'ENOENT' }))
    })
    // when / then
    await expect(parseSubjectFromPdf(Buffer.from('%PDF'))).rejects.toMatchObject({ code: 'PDF_OCR_FAILED' })
  })

  it('classifica PDF corrompido como PDF_INVALID', async () => {
    // given
    const invalidPdfError = Object.assign(new Error('Invalid PDF structure.'), { name: 'InvalidPDFException' })
    mockGetDocument.mockReturnValueOnce({ promise: Promise.reject(invalidPdfError) })
    // when
    const parsing = parseSubjectFromPdf(Buffer.from('nope'))
    // then
    await expect(parsing).rejects.toBeInstanceOf(PdfProcessingError)
    await expect(parsing).rejects.toMatchObject({ code: 'PDF_INVALID' })
  })

  it('retorna 1 ementa quando PDF tem texto suficiente (pipeline feliz)', async () => {
    // given
    mockPdfText(PDF_TEXT_SINGLE)
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    const result = expectSingle(await parseSubjectFromPdf(Buffer.from('%PDF')))
    // then
    expect(result.name).toBe('Cálculo I')
    expect(mockGenerate).toHaveBeenCalledTimes(1)
  })

  it('retorna as disciplinas do ementário sem gastar IA', async () => {
    // given: ementário com 3 disciplinas distintas
    mockPdfText(PDF_TEXT_EMENTARIO)
    // when
    const outcome = await parseSubjectFromPdf(Buffer.from('%PDF'))
    // then
    if (outcome.kind !== 'ementario') throw new Error('Esperava ementário')
    expect(outcome.entries.map(entry => entry.name)).toEqual(['Cálculo I', 'Álgebra Linear', 'Física I'])
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('completa com IA somente as disciplinas escolhidas', async () => {
    // given
    mockGenerate
      .mockResolvedValueOnce(JSON.stringify([parsedSubject]))
      .mockResolvedValueOnce(JSON.stringify([parsedSubject2]))
    // when
    const subjects = await completeEmentarioEntries(['Disciplina: Cálculo I\nEMENTA\nLimites.', 'Disciplina: Álgebra Linear\nEMENTA\nVetores.'])
    // then
    expect(subjects.map(subject => subject.name)).toEqual(['Cálculo I', 'Álgebra Linear'])
    expect(mockGenerate).toHaveBeenCalledTimes(2)
  })

  it('faz OCR da página de foto mesmo com marca d\'água de scanner nas outras', async () => {
    // given: texto somado passaria do mínimo, mas nenhuma página tem conteúdo real
    const watermark = 'Digitalizado com aplicativo'
    mockPdfPages([
      { text: watermark, hasImage: true },
      { text: watermark, hasImage: true },
      { text: watermark, hasImage: true },
    ])
    mockOcrOutput('Cálculo I: limites, derivadas e integrais de funções de uma variável real.')
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    await parseSubjectFromPdf(Buffer.from('%PDF'))
    // then
    const commands = mockExecFile.mock.calls.map(([command]) => command)
    expect(commands.filter(command => command === 'tesseract')).toHaveLength(3)
  })

  it('não faz OCR em página digital curta sem imagem', async () => {
    // given
    mockPdfPages([{ text: PDF_TEXT_SINGLE }, { text: 'Página 2' }])
    mockGenerate.mockResolvedValueOnce(JSON.stringify([parsedSubject]))
    // when
    await parseSubjectFromPdf(Buffer.from('%PDF'))
    // then
    expect(mockExecFile).not.toHaveBeenCalled()
  })

  it('trunca texto longo antes do extractor e insere marcador no prompt', async () => {
    // given: texto muito longo (>50k chars)
    const longText = 'Cálculo Diferencial. '.repeat(3000) // ~63k chars
    mockPdfText(longText)
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
    mockPdfText(normalText)
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
    mockPdfText(PDF_TEXT_SINGLE)
    mockGenerate.mockResolvedValueOnce(JSON.stringify([withNulls]))
    // when
    const result = expectSingle(await parseSubjectFromPdf(Buffer.from('%PDF')))
    // then
    expect(result.topics).toEqual([])
    expect(result.bibliography).toEqual([])
    expect(result.prerequisites).toEqual([])
  })

  it('lança erro quando a IA retorna array vazio', async () => {
    // given
    mockPdfText(PDF_TEXT_SINGLE)
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
