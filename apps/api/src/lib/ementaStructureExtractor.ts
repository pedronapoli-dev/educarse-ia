// ============================================================
// ementaStructureExtractor.ts
//
// Parser determinístico de ementas universitárias brasileiras.
// Usa regex + heurísticas para extrair campos estruturais sem IA.
//
// Princípio: regras fazem o trabalho mecânico (código, carga, tópicos
// listados, referências), IA faz apenas o semântico (ZDP, dificuldade,
// dependências entre tópicos).
//
// Saída: PartialParsedSubject com _confidence por campo e _rawSections
// para a IA completar os gaps.
// ============================================================

import type { PartialParsedSubject, ExtractionConfidence } from '@educarseia/types'

type ConfidenceMap = Partial<Record<string, ExtractionConfidence>>

// ─── Section header patterns ──────────────────────────────────────────────────
// Detectam os cabeçalhos de seção típicos de ementas brasileiras (MEC)

const SECTION_HEADERS: Array<{ key: string; re: RegExp }> = [
  { key: 'description',   re: /^(ementa|descrição\s*da\s*disciplina|objetivos?\s*(?:gerais?)?)\s*:?\s*$/i },
  { key: 'topics',        re: /^(conteúdo\s*programático|programa(?:\s*da\s*disciplina)?|conteúdo|tópicos?\s*(?:abordados?)?|unidades?\s*(?:curriculares?|temáticas?)?)\s*:?\s*$/i },
  { key: 'bibliography',  re: /^(bibliografia|referências?\s*(?:bibliográficas?|básicas?|complementares?)?|leitura\s*(?:básica|complementar)?)\s*:?\s*$/i },
  { key: 'prerequisites', re: /^(pré[- ]?requisitos?|requisitos?\s*(?:prévios?|necessários?)?)\s*:?\s*$/i },
  { key: 'methodology',   re: /^(metodologia|métodos?\s*(?:de\s*ensino)?|procedimentos?)\s*:?\s*$/i },
  { key: 'evaluation',    re: /^(avaliação|critérios?\s*de\s*avaliação|forma\s*de\s*avaliação)\s*:?\s*$/i },
]

// ─── Field-level regex patterns ───────────────────────────────────────────────

// Código de disciplina — padrão MEC: 2-5 letras + 3-6 dígitos
const CODE_RE = /\b([A-Z]{2,5}\d{3,6})\b/g

// Créditos — "4 créditos", "Créditos: 4", "4 cr", "04 cr."
const CREDITS_RE = /(?:créditos?\s*:?\s*(\d+)|(\d+)\s*créditos?|(\d+)\s*cr\.?\b)/i

// Carga horária — "60h", "60 horas", "Carga Horária: 60", "Horas Aula: 60"
const WORKLOAD_RE = /(?:carga\s*horária\s*:?\s*(\d+)|horas?\s*(?:aula|totais?|semanais?)?\s*:?\s*(\d+)|(\d+)\s*h(?:oras?)?\b(?!\s*de))/i

// Prefixos de nome de disciplina
const NAME_LABEL_RE = /(?:disciplina|componente\s*curricular|nome\s*da\s*disciplina|matéria)\s*:?\s*([^\n\r]{5,100})/i

// Curso
const COURSE_RE = /(?:curso|graduação|bacharelado|licenciatura|tecnologia\s*em)\s*(?:em|de)?\s*:?\s*([^\n\r,;]{5,80})/i

// Instituição
const UNIV_RE = /\b(universidade\s+(?:federal|estadual|municipal|privada)?\s*[\wÀ-ú\s]{3,40}|instituto\s+federal[^\n\r]{0,50}|faculdade\s+[\wÀ-ú\s]{3,40}|centro\s+universitário[^\n\r]{0,40})/i

// Item de lista — numerado, romano, ou com bullet
const LIST_ITEM_RE = /^\s*(?:(\d+|[IVXivx]+)[\.\-\)]\s+|[•·\*\-]\s+)(.{4,})/

// Referência bibliográfica — número + inicial maiúscula (padrão ABNT)
const REF_START_RE = /^\s*\d+[\.\-\)]\s+[A-ZÁÉÍÓÚÂÊÎÔÛÃÕÇ]/

// ─── Helpers ──────────────────────────────────────────────────────────────────

const clean = (s: string): string => s.replace(/\s+/g, ' ').trim()
const splitLines = (s: string): string[] => s.split(/\r?\n/)

// ─── Field extractors ─────────────────────────────────────────────────────────

function extractCode(text: string): { value: string | undefined; confidence: ExtractionConfidence } {
  // Prioriza header (primeiros 600 chars) — código costuma aparecer no topo
  const headerMatches = [...text.slice(0, 600).matchAll(CODE_RE)].map(m => m[1])
  if (headerMatches.length > 0) return { value: headerMatches[0], confidence: 'high' }

  const allMatches = [...text.matchAll(CODE_RE)].map(m => m[1])
  if (allMatches.length > 0) return { value: allMatches[0], confidence: 'medium' }
  return { value: undefined, confidence: 'missing' }
}

function extractCredits(text: string): { value: number | undefined; confidence: ExtractionConfidence } {
  const m = text.match(CREDITS_RE)
  if (!m) return { value: undefined, confidence: 'missing' }
  const raw = m[1] ?? m[2] ?? m[3]
  const val = parseInt(raw ?? '', 10)
  // Sanity: créditos universitários raramente passam de 16
  if (isNaN(val) || val < 1 || val > 20) return { value: undefined, confidence: 'low' }
  return { value: val, confidence: 'high' }
}

function extractWorkload(text: string): { value: number | undefined; confidence: ExtractionConfidence } {
  const m = text.match(WORKLOAD_RE)
  if (!m) return { value: undefined, confidence: 'missing' }
  const raw = m[1] ?? m[2] ?? m[3]
  const val = parseInt(raw ?? '', 10)
  // Sanity: carga horária de 15h a 480h é razoável
  if (isNaN(val) || val < 15 || val > 480) return { value: undefined, confidence: 'low' }
  return { value: val, confidence: 'high' }
}

function extractUniversity(headerText: string): { value: string | undefined; confidence: ExtractionConfidence } {
  const m = headerText.match(UNIV_RE)
  if (!m) return { value: undefined, confidence: 'missing' }
  return { value: clean(m[1]), confidence: 'medium' }
}

function extractCourse(headerText: string): { value: string | undefined; confidence: ExtractionConfidence } {
  const m = headerText.match(COURSE_RE)
  if (!m) return { value: undefined, confidence: 'missing' }
  return { value: clean(m[1]), confidence: 'medium' }
}

function extractName(
  text: string,
  sections: Record<string, string>
): { value: string | undefined; confidence: ExtractionConfidence } {
  // 1. Rótulo explícito
  const labeled = text.slice(0, 1200).match(NAME_LABEL_RE)
  if (labeled) return { value: clean(labeled[1]), confidence: 'high' }

  // 2. Primeira linha não-vazia que não seja código, instituição ou número
  const candidates = splitLines(text.slice(0, 600))
    .map(clean)
    .filter(l => l.length >= 5 && l.length <= 120)

  for (const line of candidates) {
    if (/^[A-Z]{2,5}\d{3,6}$/.test(line)) continue                     // É um código
    if (/universidade|instituto|faculdade|centro/i.test(line)) continue  // É instituição
    if (/^\d/.test(line)) continue                                        // Começa com número
    if (/^\s*(?:ementa|conteúdo|bibliografia)/i.test(line)) continue     // É cabeçalho de seção
    // Linha com palavras (candidata a nome da disciplina)
    if (/\w{4,}/.test(line)) return { value: line, confidence: 'medium' }
  }

  return { value: undefined, confidence: 'missing' }
}

/**
 * Extrai itens de lista de um bloco de texto.
 * Suporta: numerados (1., 1-, 1)), romanos (I., II.), bullets (•, -, *)
 * e referências bibliográficas (ABNT-style).
 */
function extractListItems(sectionText: string, isReference = false): string[] {
  const result: string[] = []
  let current = ''

  // Se a seção não tiver nenhum marcador de lista, cada linha é um item distinto
  const hasMarkers = LIST_ITEM_RE.test(sectionText) || REF_START_RE.test(sectionText)

  for (const line of splitLines(sectionText)) {
    const trimmed = line.trim()

    // Linha vazia: flush do item atual
    if (!trimmed) {
      if (current) { result.push(clean(current)); current = '' }
      continue
    }

    if (isReference) {
      if (REF_START_RE.test(line)) {
        if (current) result.push(clean(current))
        current = trimmed.replace(/^\d+[\.\-\)]\s*/, '')
      } else if (current) {
        current += ' ' + trimmed
      }
    } else if (!hasMarkers) {
      // Seção sem marcadores: cada linha com conteúdo é um item próprio
      if (trimmed.length >= 4 && !/^[A-Z]{2,5}\d{3,6}$/.test(trimmed)) {
        result.push(clean(trimmed))
      }
    } else {
      const m = LIST_ITEM_RE.exec(line)
      if (m) {
        if (current) result.push(clean(current))
        current = (m[2] ?? '').trim()
      } else if (current && trimmed.length > 0) {
        // Continuação de item (linha quebrada)
        current += ' ' + trimmed
      } else if (!current && trimmed.length > 4 && !/^[A-Z]{2,5}\d{3,6}$/.test(trimmed)) {
        current = trimmed
      }
    }
  }
  if (current) result.push(clean(current))

  return result.filter(i => i.length >= 3 && i.length <= 300)
}

// ─── Section splitter ─────────────────────────────────────────────────────────

function splitIntoSections(text: string): Record<string, string> {
  const sections: Record<string, string> = { _header: '' }
  let currentKey = '_header'
  const buffer: string[] = []

  const flush = (): void => {
    sections[currentKey] = buffer.join('\n')
    buffer.length = 0
  }

  for (const line of splitLines(text)) {
    const trimmed = line.trim()
    let matched = false

    for (const { key, re } of SECTION_HEADERS) {
      if (re.test(trimmed)) {
        flush()
        currentKey = key
        matched = true
        break
      }
    }
    if (!matched) buffer.push(line)
  }
  flush()

  return sections
}

// ─── Ementário detection (múltiplas disciplinas) ──────────────────────────────

function detectMultipleSubjects(text: string): boolean {
  const codes = [...text.matchAll(CODE_RE)]
  // 3+ códigos distintos → provável ementário
  const distinct = new Set(codes.map(m => m[1]))
  if (distinct.size >= 3) return true
  // Múltiplas ocorrências de "Conteúdo Programático" → múltiplas ementas
  const topicsHeaders = (text.match(/conteúdo\s*programático/gi) ?? []).length
  return topicsHeaders >= 2
}

// ─── Main function ────────────────────────────────────────────────────────────

export interface ExtractionResult {
  partial: PartialParsedSubject
  /** true quando o documento provavelmente é um ementário (N disciplinas) */
  likelyMultiple: boolean
}

/**
 * Extrai estrutura de uma ementa universitária brasileira de forma determinística.
 * Retorna campos com alta confiança preenchidos e seções brutas para completude pela IA.
 *
 * @example
 * const { partial, likelyMultiple } = extractEmentaStructure(rawText)
 * // partial._confidence['topics'] === 'high' → Claude não precisa re-extrair tópicos
 * // partial._confidence['name'] === 'missing' → Claude deve inferir do texto
 */
export function extractEmentaStructure(text: string): ExtractionResult {
  const sections = splitIntoSections(text)
  const confidence: ConfidenceMap = {}

  // Campos escalares
  const codeR     = extractCode(text)
  const creditsR  = extractCredits(text)
  const workloadR = extractWorkload(text)
  const univR     = extractUniversity(sections._header ?? text.slice(0, 800))
  const courseR   = extractCourse(sections._header ?? text.slice(0, 800))
  const nameR     = extractName(text, sections)

  confidence.code           = codeR.confidence
  confidence.credits        = creditsR.confidence
  confidence.workload_hours = workloadR.confidence
  confidence.university     = univR.confidence
  confidence.course         = courseR.confidence
  confidence.name           = nameR.confidence

  // Tópicos
  const topics    = sections.topics ? extractListItems(sections.topics) : []
  confidence.topics = topics.length >= 2 ? 'high' : topics.length === 1 ? 'medium' : 'missing'

  // Bibliografia
  const bibliography = sections.bibliography ? extractListItems(sections.bibliography, true) : []
  confidence.bibliography = bibliography.length >= 2 ? 'high' : bibliography.length === 1 ? 'medium' : 'missing'

  // Pré-requisitos (simples — lista curta)
  const prerequisites = sections.prerequisites
    ? splitLines(sections.prerequisites).map(clean).filter(l => l.length >= 3 && l.length <= 120)
    : []
  confidence.prerequisites = prerequisites.length > 0 ? 'high' : 'missing'

  // Descrição / ementa descritiva
  const descRaw   = sections.description ?? ''
  const description = clean(descRaw.replace(/\n+/g, ' '))
  confidence.description = description.length >= 30 ? 'high' : description.length >= 10 ? 'medium' : 'missing'

  // Compõe o PartialParsedSubject — omite campos undefined (mais limpo para JSON)
  const partial: PartialParsedSubject = {
    ...(nameR.value                    && { name:           nameR.value }),
    ...(codeR.value                    && { code:           codeR.value }),
    ...(courseR.value                  && { course:         courseR.value }),
    ...(univR.value                    && { university:     univR.value }),
    ...(creditsR.value !== undefined   && { credits:        creditsR.value }),
    ...(workloadR.value !== undefined  && { workload_hours: workloadR.value }),
    ...(description.length >= 30       && { description }),
    ...(topics.length > 0              && { topics }),
    ...(bibliography.length > 0        && { bibliography }),
    ...(prerequisites.length > 0       && { prerequisites }),
    _confidence:  confidence,
    _rawSections: sections,
  }

  return {
    partial,
    likelyMultiple: detectMultipleSubjects(text),
  }
}
