// Separa um ementário em disciplinas de forma determinística, sem IA.
// A IA só roda depois, nas disciplinas que o aluno escolher.

import { MAX_EMENTARIO_ENTRY_CHARS } from '@educarseia/types'
import type { EmentarioEntry } from '@educarseia/types'
import { extractEmentaStructure } from './ementaStructureExtractor'

const SUBJECT_START_RE = /^(?:disciplina|componente\s+curricular)(?:\s*:.*|[\s|]+c[óo]digo.*)?$/i
const SUBJECT_BODY_RE = /^\s*(?:ementa|conteúdo\s*programático)\s*:?\s*$/im
const EMENTA_HEADER_RE = /^\s*ementa\s*:?\s*$/gim
const TOPICS_HEADER_RE = /^\s*conteúdo\s*programático\s*:?\s*$/gim
const SECTION_LABEL_RE = /^(?:disciplina|componente|ementa|conteúdo|bibliografia|referências?|pré[- ]?requisito|có[- ]?requisito|objetivo|metodologia|avaliação|carga|código)/i
const NAME_CODE_SUFFIX_RE = /\s+[—–-]\s+[A-Z]{2,5}-?\d{3,6}\b.*$/

const PAGE_HEADER_LINES = 5
const MIN_PAGES_FOR_HEADER_DETECTION = 4
const PAGE_HEADER_FREQUENCY = 0.5
/** Rótulos curtos ("EMENTA", "CÓDIGO") repetem por natureza e não são cabeçalho de página. */
const MIN_PAGE_HEADER_LENGTH = 15

const removeRepeatedPageHeaders = (text: string): string => {
  const pages = text.split(/\n{2,}/)
  if (pages.length < MIN_PAGES_FOR_HEADER_DETECTION) return text

  const lineFrequency = new Map<string, number>()
  for (const page of pages) {
    const headerLines = new Set(page.split('\n').slice(0, PAGE_HEADER_LINES).map(line => line.trim()))
    for (const line of headerLines) lineFrequency.set(line, (lineFrequency.get(line) ?? 0) + 1)
  }

  const repeatedHeaders = new Set(
    [...lineFrequency]
      .filter(([line, count]) =>
        line.length >= MIN_PAGE_HEADER_LENGTH &&
        count / pages.length >= PAGE_HEADER_FREQUENCY &&
        !SECTION_LABEL_RE.test(line))
      .map(([line]) => line),
  )

  return text.split('\n').filter(line => !repeatedHeaders.has(line.trim())).join('\n')
}

const splitIntoSubjectBlocks = (text: string): string[] => {
  const blocks: string[] = []
  let currentLines: string[] | null = null

  for (const line of text.split('\n')) {
    if (SUBJECT_START_RE.test(line.trim())) {
      if (currentLines) blocks.push(currentLines.join('\n').trim())
      currentLines = []
    }
    currentLines?.push(line)
  }
  if (currentLines) blocks.push(currentLines.join('\n').trim())

  return blocks
}

/** Indica várias ementas no documento, mesmo quando não foi possível separá-las. */
// Conta cada cabeçalho separadamente: uma ementa única costuma ter os dois.
export const hasRepeatedSubjectHeaders = (text: string): boolean =>
  (text.match(EMENTA_HEADER_RE) ?? []).length >= 2 || (text.match(TOPICS_HEADER_RE) ?? []).length >= 2

/** Retorna as disciplinas do documento. Menos de 2 significa que não é um ementário separável. */
export const splitEmentario = (text: string): EmentarioEntry[] => {
  const entries: Omit<EmentarioEntry, 'index'>[] = []

  for (const block of splitIntoSubjectBlocks(removeRepeatedPageHeaders(text))) {
    const { partial } = extractEmentaStructure(block)
    const name = partial.name?.replace(NAME_CODE_SUFFIX_RE, '').trim()
    if (!name) continue

    const previousEntry = entries[entries.length - 1]
    const isContinuation = previousEntry?.name === name && previousEntry.code === (partial.code ?? null)
    if (isContinuation) {
      previousEntry.source_text = `${previousEntry.source_text}\n${block}`.slice(0, MAX_EMENTARIO_ENTRY_CHARS)
      continue
    }

    if (!SUBJECT_BODY_RE.test(block)) continue
    entries.push({
      name,
      code:           partial.code ?? null,
      workload_hours: partial.workload_hours ?? null,
      source_text:    block.slice(0, MAX_EMENTARIO_ENTRY_CHARS),
    })
  }

  return entries.map((entry, index) => ({ index, ...entry }))
}
