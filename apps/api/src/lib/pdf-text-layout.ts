// Reconstrói linhas a partir dos itens posicionados do pdfjs.
// Mantém a ordem do content stream (não ordena por coordenada): em tabelas e
// páginas com colunas, é ela que deixa cada rótulo ao lado do próprio valor.

import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api'

export type PdfTextItem = Pick<TextItem, 'str' | 'transform' | 'width' | 'height'>

/** Deslocamento vertical, relativo à fonte, a partir do qual começa outra linha. */
const LINE_BREAK_FONT_RATIO = 0.5
/** Distância horizontal, relativa à fonte, a partir da qual há separação de palavras. */
const WORD_GAP_FONT_RATIO = 0.15

export const isPdfTextItem = (item: TextItem | TextMarkedContent): item is TextItem =>
  'str' in item

const getFontSize = (item: PdfTextItem): number =>
  Math.abs(item.transform[3] ?? 0) || item.height || 1

export const reconstructPageText = (items: readonly PdfTextItem[]): string => {
  const lines: string[] = []
  let currentLine = ''
  let previousItem: PdfTextItem | null = null

  for (const item of items) {
    // Espaços vazios são redundantes: a separação real vem das coordenadas.
    if (!item.str.trim()) continue

    if (previousItem) {
      const fontSize = Math.max(getFontSize(item), getFontSize(previousItem))
      const verticalDistance = Math.abs(item.transform[5] - previousItem.transform[5])
      const previousEndX = previousItem.transform[4] + previousItem.width
      const horizontalGap = item.transform[4] - previousEndX

      if (verticalDistance > fontSize * LINE_BREAK_FONT_RATIO || horizontalGap < -fontSize) {
        lines.push(currentLine.trim())
        currentLine = ''
      } else if (horizontalGap > fontSize * WORD_GAP_FONT_RATIO) {
        currentLine += ' '
      }
    }

    currentLine += item.str
    previousItem = item
  }

  if (currentLine.trim()) lines.push(currentLine.trim())
  return lines.join('\n')
}
