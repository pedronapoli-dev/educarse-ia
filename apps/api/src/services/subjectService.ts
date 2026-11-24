// ============================================================
// subjectService.ts
//
// Pipeline de parsing de ementas — arquitetura em dois estágios:
//
//   Estágio 1 — Extração determinística (gratuita, síncrona)
//     pdfjs (ou OCR) → ementaStructureExtractor → PartialParsedSubject
//     Extrai: código, carga horária, tópicos listados, bibliografia,
//             pré-requisitos, descrição — com _confidence por campo.
//
//   Estágio 2 — Completude semântica (IA com input ~2K tokens)
//     semanticCompletionPrompt(partial) → Claude → ParsedSubject[]
//     Faz: preencher gaps + difficulty_level + zdp_entry_point
//          + topic_dependencies
//
// Resultado: ~54× redução de custo vs pipeline anterior (PDF nativo).
// Sem risco de estouro de contexto — input da IA é sempre previsível.
// ============================================================

import { execFile } from 'child_process'
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { promisify } from 'util'
import path from 'path'
import os from 'os'
import { generate, parseJsonResponse } from '../lib/anthropic'
import { supabase } from '../lib/supabase'
import { SEMANTIC_COMPLETION_SYSTEM, semanticCompletionPrompt } from '../lib/prompts'
import { extractEmentaStructure } from '../lib/ementaStructureExtractor'
import { hasRepeatedSubjectHeaders, splitEmentario } from '../lib/ementario-splitter'
import { prepareImageForOcr } from '../lib/ocr-image'
import { isPdfTextItem, reconstructPageText } from '../lib/pdf-text-layout'
import type { EmentarioEntry, ParsedSubject, PartialParsedSubject } from '@educarseia/types'

const execFileAsync = promisify(execFile)

// ─── Limites ──────────────────────────────────────────────────────────────────

/** Máximo de caracteres enviados ao extractor (evita processar PDFs gigantes). */
const MAX_CHARS_FOR_EXTRACTOR = 50_000
/** Abaixo disso o PDF é tratado como sem camada de texto. */
const MIN_TEXT_LAYER_CHARS = 50
/** OCR a 300 DPI é caro e roda no processo da API: limita o trabalho por upload. */
export const MAX_OCR_PAGES = 20
const OCR_COMMAND_TIMEOUT_MS = 60_000

export type PdfProcessingErrorCode =
  | 'PDF_SCANNED'
  | 'PDF_INVALID'
  | 'PDF_OCR_TOO_LONG'
  | 'PDF_OCR_FAILED'
  | 'PDF_EMENTARIO_UNRECOGNIZED'

export class PdfProcessingError extends Error {
  constructor(readonly code: PdfProcessingErrorCode, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'PdfProcessingError'
  }
}

/** Erro lançado quando nem a camada de texto nem o OCR produzem conteúdo. */
export class ScannedPdfError extends PdfProcessingError {
  constructor() {
    super('PDF_SCANNED', 'PDF sem camada de texto detectada.')
    this.name = 'ScannedPdfError'
  }
}

const normalizeArrayFields = (subject: ParsedSubject): ParsedSubject => ({
  ...subject,
  topics:        subject.topics        ?? [],
  bibliography:  subject.bibliography  ?? [],
  prerequisites: subject.prerequisites ?? [],
})

// ─── Extração de texto ────────────────────────────────────────────────────────

// pdfjs-dist v3 legacy build — CJS/Node.js compatible, handles CIDFont + non-standard encodings.
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js'
pdfjsLib.GlobalWorkerOptions.workerSrc = ''

const UNREADABLE_PDF_ERROR_NAMES = new Set(['InvalidPDFException', 'PasswordException', 'MissingPDFException'])

const openPdfDocument = async (buffer: Buffer) => {
  try {
    return await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise
  } catch (error) {
    if (error instanceof Error && UNREADABLE_PDF_ERROR_NAMES.has(error.name)) {
      throw new PdfProcessingError('PDF_INVALID', 'PDF corrompido ou protegido por senha.', { cause: error })
    }
    throw error
  }
}

type PdfPageContent = { pageNumber: number; text: string; needsOcr: boolean }

const IMAGE_OPERATORS = new Set<number>([
  pdfjsLib.OPS.paintImageXObject,
  pdfjsLib.OPS.paintImageXObjectRepeat,
  pdfjsLib.OPS.paintInlineImageXObject,
  pdfjsLib.OPS.paintImageMaskXObject,
])

// A decisão é por página: apps de scanner gravam uma marca d'água de texto em cada
// página, o que faria um PDF de fotos parecer digital se o texto fosse somado.
const readPdfPages = async (buffer: Buffer): Promise<PdfPageContent[]> => {
  const doc = await openPdfDocument(buffer)
  try {
    const pages: PdfPageContent[] = []
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber)
      const content = await page.getTextContent()
      const text = reconstructPageText(content.items.filter(isPdfTextItem))
      let needsOcr = false
      if (text.length < MIN_TEXT_LAYER_CHARS) {
        const operators = await page.getOperatorList()
        needsOcr = !text || operators.fnArray.some(operator => IMAGE_OPERATORS.has(operator))
      }
      pages.push({ pageNumber, text, needsOcr })
    }
    return pages
  } finally {
    await doc.destroy()
  }
}

// pdftoppm renders each page to PNG at 300 DPI; tesseract OCRs with the Portuguese model.
// Requires tesseract-ocr, tesseract-ocr-por and poppler-utils (installed via Dockerfile).
const ocrPdfPages = async (buffer: Buffer, pageNumbers: number[]): Promise<Map<number, string>> => {
  const workDirectory = await mkdtemp(path.join(os.tmpdir(), 'ementa-ocr-'))
  const pdfPath = path.join(workDirectory, 'source.pdf')

  try {
    await writeFile(pdfPath, buffer)
    const pageTexts = new Map<number, string>()
    for (const pageNumber of pageNumbers) {
      const pagePrefix = path.join(workDirectory, `page-${pageNumber}`)
      const preparedImagePath = `${pagePrefix}-prepared.png`
      await execFileAsync(
        'pdftoppm',
        ['-r', '300', '-png', '-singlefile', '-f', String(pageNumber), '-l', String(pageNumber), pdfPath, pagePrefix],
        { timeout: OCR_COMMAND_TIMEOUT_MS },
      )
      await prepareImageForOcr(`${pagePrefix}.png`, preparedImagePath)
      const { stdout } = await execFileAsync(
        'tesseract',
        [preparedImagePath, 'stdout', '-l', 'por', '--psm', '1'],
        { timeout: OCR_COMMAND_TIMEOUT_MS },
      )
      pageTexts.set(pageNumber, stdout.trim())
    }
    return pageTexts
  } catch (error) {
    throw new PdfProcessingError('PDF_OCR_FAILED', 'Falha ao executar OCR no PDF.', { cause: error })
  } finally {
    await rm(workDirectory, { recursive: true, force: true })
  }
}

/** Lê a camada de texto do PDF e recorre ao OCR quando ela não existe. */
export const extractPdfContent = async (buffer: Buffer): Promise<string> => {
  const pages = await readPdfPages(buffer)
  const pageNumbersToOcr = pages.filter(page => page.needsOcr).map(page => page.pageNumber)

  if (pageNumbersToOcr.length > MAX_OCR_PAGES) {
    throw new PdfProcessingError('PDF_OCR_TOO_LONG', `PDF escaneado com mais de ${MAX_OCR_PAGES} páginas.`)
  }

  const ocrTexts = pageNumbersToOcr.length > 0
    ? await ocrPdfPages(buffer, pageNumbersToOcr)
    : new Map<number, string>()

  const content = pages
    .map(page => (page.needsOcr ? ocrTexts.get(page.pageNumber) ?? page.text : page.text))
    .filter(Boolean)
    .join('\n\n')
    .trim()

  if (content.length < MIN_TEXT_LAYER_CHARS) throw new ScannedPdfError()
  return content
}

/**
 * Trunca preservando cabeçalho (nome, código, carga) e final (tópicos, biblio).
 * Ementas colocam conteúdo programático no meio/fim — slice simples no início perde isso.
 */
function smartTruncate(text: string, maxChars = MAX_CHARS_FOR_EXTRACTOR): string {
  if (text.length <= maxChars) return text
  const head = text.slice(0, Math.floor(maxChars * 0.35))
  const tail  = text.slice(-(Math.ceil(maxChars * 0.65)))
  return head + '\n\n[...trecho intermediário omitido...]\n\n' + tail
}

// ─── Pipeline principal ───────────────────────────────────────────────────────

/**
 * Estágio 2: completude semântica via IA.
 * Input: PartialParsedSubject (~2K tokens) em vez do texto completo.
 */
const runSemanticCompletion = async (partial: PartialParsedSubject): Promise<ParsedSubject> => {
  const userPrompt = semanticCompletionPrompt(partial, 1)
  const response   = await generate(SEMANTIC_COMPLETION_SYSTEM, userPrompt, 8192)
  const raw        = parseJsonResponse<ParsedSubject | ParsedSubject[]>(response, 'ementa')
  const [subject]  = Array.isArray(raw) ? raw : [raw]
  if (!subject) throw new Error('IA retornou lista vazia de ementas.')
  return normalizeArrayFields(subject)
}

export type SubjectParseOutcome =
  | { kind: 'single'; subject: ParsedSubject }
  | { kind: 'ementario'; entries: EmentarioEntry[] }

// Ementários param aqui, antes de qualquer chamada de IA: o aluno escolhe as disciplinas.
const parseSubjectContent = async (rawText: string): Promise<SubjectParseOutcome> => {
  const entries = splitEmentario(rawText)
  if (entries.length >= 2) return { kind: 'ementario', entries }

  if (hasRepeatedSubjectHeaders(rawText)) {
    throw new PdfProcessingError('PDF_EMENTARIO_UNRECOGNIZED', 'Várias ementas sem separação identificável.')
  }

  const { partial } = extractEmentaStructure(smartTruncate(rawText))
  return { kind: 'single', subject: await runSemanticCompletion(partial) }
}

/** Completa com IA apenas as disciplinas escolhidas pelo aluno. */
export const completeEmentarioEntries = async (sourceTexts: string[]): Promise<ParsedSubject[]> =>
  Promise.all(sourceTexts.map(sourceText => runSemanticCompletion(extractEmentaStructure(sourceText).partial)))

// ─── Exports públicos ─────────────────────────────────────────────────────────

/**
 * Parse de ementa a partir de buffer PDF.
 * Pipeline: pdfjs (ou OCR) → extractor determinístico → IA (semântica + gaps).
 */
export const parseSubjectFromPdf = async (buffer: Buffer): Promise<SubjectParseOutcome> =>
  parseSubjectContent(await extractPdfContent(buffer))

/**
 * Parse de ementa a partir de texto bruto (rota /text).
 * Mesmo pipeline do PDF — o caller já extraiu o texto.
 */
export const parseSubjectFromText = async (rawText: string): Promise<SubjectParseOutcome> =>
  parseSubjectContent(rawText)

// ─── Persistência ─────────────────────────────────────────────────────────────

export const saveSubject = async (
  userId: string,
  parsed: ParsedSubject,
  rawText: string,
  sourceType: 'pdf' | 'text' | 'manual' = 'pdf'
) => {
  const { data, error } = await supabase
    .from('subjects')
    .insert({
      user_id:        userId,
      name:           parsed.name,
      code:           parsed.code           ?? null,
      course:         parsed.course         ?? null,
      university:     parsed.university     ?? null,
      credits:        parsed.credits        ?? null,
      workload_hours: parsed.workload_hours  ?? null,
      description:    parsed.description    ?? '',
      topics:         parsed.topics         ?? [],
      bibliography:   parsed.bibliography   ?? [],
      prerequisites:  parsed.prerequisites  ?? [],
      raw_text:       rawText,
      source_type:    sourceType,
    })
    .select()
    .single()
  if (error) throw error
  return data
}
