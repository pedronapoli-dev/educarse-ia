// ============================================================
// subjectService.ts
//
// Pipeline de parsing de ementas — arquitetura em dois estágios:
//
//   Estágio 1 — Extração determinística (gratuita, síncrona)
//     pdf-parse → ementaStructureExtractor → PartialParsedSubject
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
import { writeFile, readdir, unlink } from 'fs/promises'
import { promisify } from 'util'
import path from 'path'
import os from 'os'
import { randomUUID } from 'crypto'
import { generate, parseJsonResponse } from '../lib/anthropic'
import { supabase } from '../lib/supabase'
import { SEMANTIC_COMPLETION_SYSTEM, semanticCompletionPrompt } from '../lib/prompts'
import { extractEmentaStructure } from '../lib/ementaStructureExtractor'
import type { ParsedSubject, PartialParsedSubject } from '@educarseia/types'

const execFileAsync = promisify(execFile)

// ─── Limites ──────────────────────────────────────────────────────────────────

/** Máximo de caracteres enviados ao extractor (evita processar PDFs gigantes). */
const MAX_CHARS_FOR_EXTRACTOR = 50_000

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

export const extractTextFromPdf = async (buffer: Buffer): Promise<string> => {
  const data = new Uint8Array(buffer)
  const doc = await pdfjsLib.getDocument({ data }).promise
  const parts: string[] = []
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum)
    const content = await page.getTextContent()
    parts.push((content.items as Array<{ str?: string }>).map(item => item.str ?? '').join(''))
  }
  await doc.cleanup()
  return parts.join('\n').trim()
}

// pdftoppm renders each page to PNG at 300 DPI; tesseract OCRs with the Portuguese model.
// Requires tesseract-ocr, tesseract-ocr-por and poppler-utils (installed via Dockerfile).
async function ocrPdf(buffer: Buffer): Promise<string> {
  const tmpDir = os.tmpdir()
  const id = randomUUID()
  const pdfPath = path.join(tmpDir, `${id}.pdf`)
  const pagesPrefix = path.join(tmpDir, id)

  try {
    await writeFile(pdfPath, buffer)
    await execFileAsync('pdftoppm', ['-r', '300', '-png', pdfPath, pagesPrefix])

    const pageFiles = (await readdir(tmpDir))
      .filter(f => f.startsWith(id) && f.endsWith('.png'))
      .sort()

    if (pageFiles.length === 0) throw new Error('pdftoppm não gerou imagens')

    const texts: string[] = []
    for (const fname of pageFiles) {
      const { stdout } = await execFileAsync('tesseract', [
        path.join(tmpDir, fname), 'stdout', '-l', 'por', '--psm', '1',
      ])
      texts.push(stdout.trim())
    }

    return texts.filter(Boolean).join('\n')
  } finally {
    const files = await readdir(tmpDir).catch(() => [] as string[])
    await Promise.all(
      files.filter(f => f.startsWith(id)).map(f => unlink(path.join(tmpDir, f)).catch(() => {}))
    )
  }
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
async function runSemanticCompletion(
  partial: PartialParsedSubject,
  expectedCount?: number
): Promise<ParsedSubject[]> {
  const userPrompt = semanticCompletionPrompt(partial, expectedCount ?? 1)
  const response   = await generate(SEMANTIC_COMPLETION_SYSTEM, userPrompt, 8192)
  const raw        = parseJsonResponse<ParsedSubject | ParsedSubject[]>(response, 'ementa')
  const arr        = Array.isArray(raw) ? raw : [raw]
  if (arr.length === 0) throw new Error('IA retornou lista vazia de ementas.')
  return arr.map(normalizeArrayFields)
}

// ─── Exports públicos ─────────────────────────────────────────────────────────

/**
 * Parse de ementa a partir de buffer PDF.
 * Pipeline: pdf-parse → extractor determinístico → IA (semântica + gaps).
 * Robusto a qualquer tamanho de PDF — input da IA é sempre ~2K tokens.
 */
/** Erro lançado quando o PDF não contém camada de texto (provavelmente escaneado). */
export class ScannedPdfError extends Error {
  readonly code = 'PDF_SCANNED' as const
  constructor() {
    super('PDF sem camada de texto detectada.')
    this.name = 'ScannedPdfError'
  }
}

export const parseSubjectFromPdf = async (buffer: Buffer): Promise<ParsedSubject[]> => {
  let rawText = await extractTextFromPdf(buffer)

  if (rawText.trim().length < 50) {
    // No text layer — attempt OCR (handles scanned/image-based PDFs).
    // ocrPdf throws if tesseract/poppler are unavailable (not installed in dev without Dockerfile).
    rawText = await ocrPdf(buffer)
  }

  if (rawText.trim().length < 50) throw new ScannedPdfError()

  const { partial, likelyMultiple } = extractEmentaStructure(smartTruncate(rawText))
  return runSemanticCompletion(partial, likelyMultiple ? undefined : 1)
}

/**
 * Parse de ementa a partir de texto bruto (rota /text).
 * Mesmo pipeline do PDF — o caller já extraiu o texto.
 */
export const parseSubjectFromText = async (rawText: string): Promise<ParsedSubject[]> => {
  const { partial, likelyMultiple } = extractEmentaStructure(smartTruncate(rawText))
  return runSemanticCompletion(partial, likelyMultiple ? undefined : 1)
}

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
