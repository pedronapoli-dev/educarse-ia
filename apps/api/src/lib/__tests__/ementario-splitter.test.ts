import { describe, it, expect, vi } from 'vitest'

vi.mock('../supabase', () => ({ supabase: {} }))

import { MAX_EMENTARIO_ENTRY_CHARS, MAX_EMENTARIO_SELECTION } from '@educarseia/types'
import { hasRepeatedSubjectHeaders, splitEmentario } from '../ementario-splitter'
import { getEmentarioSelectionLimit } from '../limits'

const PAGE_HEADER = 'Instituto Federal de Exemplo - Campus Central\nCoordenação do Curso de Engenharia'

const subjectBlock = (name: string, code: string, body = 'Conteúdo descritivo da disciplina com detalhes.') => `${PAGE_HEADER}
DISCIPLINA
${name}
CÓD NÚC CRÉD
${code} OBR 4
EMENTA
${body}
BIBLIOGRAFIA BÁSICA
SILVA, Ana. Livro de referência. São Paulo: Editora Exemplo, 2020.`

describe('splitEmentario', () => {
  it('separa cada disciplina com nome e código próprios', () => {
    const text = [subjectBlock('Cálculo I', 'MAT-101'), subjectBlock('Física I', 'FIS-101'), subjectBlock('Química Geral', 'QUI-101')].join('\n\n')
    const entries = splitEmentario(text)
    expect(entries.map(entry => [entry.index, entry.name, entry.code])).toEqual([
      [0, 'Cálculo I', 'MAT-101'],
      [1, 'Física I', 'FIS-101'],
      [2, 'Química Geral', 'QUI-101'],
    ])
  })

  it('remove cabeçalho repetido das páginas sem perder rótulos', () => {
    const text = ['A', 'B', 'C', 'D'].map(letter => subjectBlock(`Disciplina ${letter}`, `ABC-10${letter.charCodeAt(0) - 64}`)).join('\n\n')
    const [firstEntry] = splitEmentario(text)
    expect(firstEntry.source_text).not.toContain('Campus Central')
    expect(firstEntry.source_text).toContain('EMENTA')
  })

  it('une a continuação da mesma disciplina em outra página', () => {
    const continuation = 'DISCIPLINA\nCálculo I\nCÓD\nMAT-101\nBIBLIOGRAFIA COMPLEMENTAR\nSOUZA, Bruno. Outro livro. Rio: Modelo, 2019.'
    const text = [subjectBlock('Cálculo I', 'MAT-101'), continuation, subjectBlock('Física I', 'FIS-101')].join('\n\n')
    const entries = splitEmentario(text)
    expect(entries).toHaveLength(2)
    expect(entries[0].source_text).toContain('SOUZA, Bruno')
  })

  it('limita o tamanho do trecho enviado à IA', () => {
    const text = [subjectBlock('Cálculo I', 'MAT-101', 'x'.repeat(MAX_EMENTARIO_ENTRY_CHARS + 500)), subjectBlock('Física I', 'FIS-101')].join('\n\n')
    expect(splitEmentario(text)[0].source_text.length).toBe(MAX_EMENTARIO_ENTRY_CHARS)
  })

  it('não trata ementa única como ementário', () => {
    const text = subjectBlock('Cálculo I', 'MAT-101')
    expect(splitEmentario(text)).toHaveLength(1)
    expect(hasRepeatedSubjectHeaders(text)).toBe(false)
  })

  it('não confunde ementa única com "Ementa" e "Conteúdo Programático"', () => {
    const text = 'Cálculo I\nEMENTA\nLimites e derivadas.\nCONTEÚDO PROGRAMÁTICO\n1. Limites\n2. Derivadas'
    expect(hasRepeatedSubjectHeaders(text)).toBe(false)
  })

  it('sinaliza várias ementas que não têm rótulo de disciplina', () => {
    const text = 'Cálculo I\nEMENTA\nLimites e derivadas.\n\nFísica I\nEMENTA\nMecânica clássica.'
    expect(splitEmentario(text)).toHaveLength(0)
    expect(hasRepeatedSubjectHeaders(text)).toBe(true)
  })
})

describe('getEmentarioSelectionLimit', () => {
  it('usa o teto global em planos sem limite', () => {
    expect(getEmentarioSelectionLimit('pro', 40)).toBe(MAX_EMENTARIO_SELECTION)
  })

  it('reduz a escolha ao saldo de planos do tier', () => {
    expect(getEmentarioSelectionLimit('free', 1)).toBe(1)
    expect(getEmentarioSelectionLimit('basic', 8)).toBe(2)
  })

  it('retorna 0 quando não há saldo', () => {
    expect(getEmentarioSelectionLimit('free', 2)).toBe(0)
    expect(getEmentarioSelectionLimit('free', 5)).toBe(0)
  })
})
