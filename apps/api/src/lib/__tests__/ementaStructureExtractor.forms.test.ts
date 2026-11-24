import { describe, it, expect } from 'vitest'
import { extractEmentaStructure } from '../ementaStructureExtractor'

// Layouts de formulário institucional, como saem da reconstrução de linhas do PDF.

const TABLE_FORM = `
DISCIPLINA
OFICINA DE PROJETOS III
CÓDIGO
PRJ-306
CARGA HORÁRIA
SEMESTRAL
60 horas
NÚMERO DE
CRÉDITOS
04
PRÉ-REQUISITO (S) CÓDIGO (S)
OFICINA DE PROJETOS II PRJ-205
EMENTA
Planejamento e execução de projetos aplicados com documentação técnica completa.
BIBLIOGRAFIA BÁSICA
SILVA, Ana. Gestão de projetos. 2. ed. São Paulo: Editora Exemplo, 2020.
SOUZA, Bruno; LIMA, Carla. Métodos ágeis aplicados. Tradução da 3ª edição.
Rio de Janeiro: Editora Modelo, 2019.
BIBLIOGRAFIA COMPLEMENTAR
COSTA, Davi. Documentação técnica. Curitiba: Editora Teste, 2018.
`.trim()

const SCANNED_FORM = `
DISCIPLINA CÓDIGO
Introdução à Programação (preenchimento DGA)
CURSO (S) EM QUE É OFERECIDA
Curso Superior de Tecnologia em Sistemas
CARGA HORÁRIA NÚMERO CARGA HORÁRIA
SEMESTRAL DE SEMANAL
144 horas relógio CRÉDITOS 8 tempos
PRÉ-REQUISITO (S) CÓDIGO (S)
Não Há (preenchimento DGA)
EMENTA
Fundamentos de algoritmos, variáveis, condicionais, repetição e funções.
OBJETIVO GERAL
Compreender algoritmos como forma de solução de problemas.
`.trim()

describe('extractEmentaStructure — formulários institucionais', () => {
  it('reconhece código com hífen, carga, créditos e pré-requisito em tabela', () => {
    const { partial, likelyMultiple } = extractEmentaStructure(TABLE_FORM)
    expect(partial.name).toBe('OFICINA DE PROJETOS III')
    expect(partial.code).toBe('PRJ-306')
    expect(partial.workload_hours).toBe(60)
    expect(partial.credits).toBe(4)
    expect(partial.prerequisites).toEqual(['OFICINA DE PROJETOS II PRJ-205'])
    expect(likelyMultiple).toBe(false)
  })

  it('acumula bibliografia básica e complementar em entradas ABNT sem numeração', () => {
    const { partial } = extractEmentaStructure(TABLE_FORM)
    expect(partial.bibliography).toHaveLength(3)
    expect(partial.bibliography?.[1]).toContain('Rio de Janeiro: Editora Modelo')
    expect(partial.bibliography?.[2]).toMatch(/^COSTA, Davi/)
  })

  it('não confunde rótulos do formulário com nome, curso ou créditos', () => {
    const { partial } = extractEmentaStructure(SCANNED_FORM)
    expect(partial.name).toBe('Introdução à Programação')
    expect(partial.course).toBe('Curso Superior de Tecnologia em Sistemas')
    expect(partial.credits).toBeUndefined()
    expect(partial.workload_hours).toBe(144)
  })

  it('trata "Não há" como ausência de pré-requisito', () => {
    const { partial } = extractEmentaStructure(SCANNED_FORM)
    expect(partial.prerequisites).toBeUndefined()
  })

  it('mantém objetivos fora da descrição', () => {
    const { partial } = extractEmentaStructure(SCANNED_FORM)
    expect(partial.description).not.toContain('Compreender algoritmos')
    expect(partial._rawSections.objectives).toContain('Compreender algoritmos')
  })

  it('reconstrói código quebrado em duas linhas pela célula da tabela', () => {
    const text = 'DISCIPLINA\nExtensão VII\nCÓD NÚC CRÉD\nACE-\n701\nEXT 4\nPRÉ-REQUISITO(S) PARA ESTA DISCIPLINA\nACE-601\nEMENTA\nProjetos de extensão aplicados à comunidade local.'
    expect(extractEmentaStructure(text).partial.code).toBe('ACE-701')
  })

  it('detecta ementário por cabeçalhos EMENTA repetidos com códigos hifenizados', () => {
    const catalog = `${TABLE_FORM}\n\n${TABLE_FORM.replace('PRJ-306', 'PRJ-307')}`
    expect(extractEmentaStructure(catalog).likelyMultiple).toBe(true)
  })
})
