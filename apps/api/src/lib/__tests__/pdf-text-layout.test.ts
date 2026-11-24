import { describe, it, expect } from 'vitest'
import { isPdfTextItem, reconstructPageText } from '../pdf-text-layout'
import type { PdfTextItem } from '../pdf-text-layout'

const textItem = (str: string, x: number, y: number, width = str.length * 6, fontSize = 12): PdfTextItem => ({
  str,
  transform: [fontSize, 0, 0, fontSize, x, y],
  width,
  height: fontSize,
})

describe('reconstructPageText', () => {
  it('quebra a linha quando a coordenada vertical muda', () => {
    const items = [textItem('Disciplina: Cálculo I', 72, 720), textItem('Código: MAT101', 72, 700)]
    expect(reconstructPageText(items)).toBe('Disciplina: Cálculo I\nCódigo: MAT101')
  })

  it('não insere espaço entre fragmentos contíguos da mesma palavra', () => {
    const items = [textItem('Lauro de Freita', 280, 716, 72), textItem('s', 352, 716, 6)]
    expect(reconstructPageText(items)).toBe('Lauro de Freitas')
  })

  it('insere espaço quando há distância horizontal entre itens', () => {
    const items = [textItem('SEMESTRE', 184, 691, 60), textItem('CLASSIFICAÇÃO', 424, 691, 91)]
    expect(reconstructPageText(items)).toBe('SEMESTRE CLASSIFICAÇÃO')
  })

  it('mantém a ordem do stream para preservar rótulo e valor de tabelas', () => {
    const items = [
      textItem('DISCIPLINA', 179, 722),
      textItem('OFICINA DE JOGOS IV', 93, 708),
      textItem('CÓDIGO', 444, 722),
      textItem('JOG-406', 447, 708),
    ]
    expect(reconstructPageText(items)).toBe('DISCIPLINA\nOFICINA DE JOGOS IV\nCÓDIGO\nJOG-406')
  })

  it('ignora itens vazios sem criar linhas em branco', () => {
    const items = [textItem('Ementa', 72, 720), textItem('', 72, 700, 0), textItem(' ', 72, 700, 3), textItem('Limites', 72, 680)]
    expect(reconstructPageText(items)).toBe('Ementa\nLimites')
  })

  it('mantém sobrescrito na mesma linha', () => {
    const items = [textItem('4', 72, 720, 6), textItem('º', 78, 724, 4, 8)]
    expect(reconstructPageText(items)).toBe('4º')
  })

  it('retorna string vazia para página sem texto', () => {
    expect(reconstructPageText([])).toBe('')
  })
})

describe('isPdfTextItem', () => {
  it('descarta marcadores de conteúdo', () => {
    expect(isPdfTextItem({ type: 'beginMarkedContent', id: 'mc0' })).toBe(false)
    expect(isPdfTextItem({ ...textItem('Ementa', 72, 720), dir: 'ltr', fontName: 'F1', hasEOL: false })).toBe(true)
  })
})
