// ============================================================
// ementaStructureExtractor.test.ts
//
// Testes unitários do parser determinístico de ementas.
// Fixtures baseadas em padrões reais de ementas brasileiras (MEC).
// ============================================================

import { describe, it, expect } from 'vitest'
import { extractEmentaStructure } from '../ementaStructureExtractor'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const EMENTA_COMPLETA = `
UNIVERSIDADE FEDERAL DE SÃO PAULO
Departamento de Ciência da Computação

Disciplina: Algoritmos e Estruturas de Dados II
Código: SCC0221
Curso: Bacharelado em Ciência da Computação
Créditos: 4
Carga Horária: 60h

Ementa
Análise de algoritmos. Algoritmos de ordenação avançados. Árvores balanceadas.
Grafos: representação e algoritmos clássicos.

Conteúdo Programático
1. Análise assintótica de algoritmos
2. Algoritmos de ordenação: Mergesort, Heapsort, Quicksort
3. Árvores AVL e Árvores Rubro-Negras
4. Tabelas Hash
5. Grafos: BFS, DFS, Dijkstra, Prim, Kruskal
6. Programação dinâmica

Pré-requisitos
SCC0202 - Algoritmos e Estruturas de Dados I

Bibliografia
1. CORMEN, T. H. et al. Introduction to Algorithms. 3. ed. MIT Press, 2009.
2. SEDGEWICK, R.; WAYNE, K. Algorithms. 4. ed. Addison-Wesley, 2011.
3. KNUTH, D. E. The Art of Computer Programming. Vol. 1-3. Addison-Wesley.
`

const EMENTA_SEM_MARCADORES = `
Cálculo Diferencial e Integral I
MAT0101 | 4 créditos | 60 horas

Ementa
Funções de uma variável real: limites, continuidade, derivadas e integrais.

Conteúdo Programático
Limites e continuidade de funções reais
Derivadas e regras de diferenciação
Teorema do Valor Médio
Integrais indefinidas e definidas
Técnicas de integração
`

const EMENTA_MINIMA = `
Fundamentos de Programação
FLP0101
60h

Introdução à lógica de programação e algoritmos.
Variáveis, tipos de dados, estruturas de controle.
`

const EMENTARIO = `
EMENTÁRIO DE DISCIPLINAS — ENGENHARIA ELÉTRICA

Circuitos Elétricos I
ELE0101 | 4 cr | 60h
Circuitos de corrente contínua. Leis de Kirchhoff.
Conteúdo Programático
1. Conceitos básicos: tensão, corrente, potência
2. Leis de Ohm e Kirchhoff

Circuitos Elétricos II
ELE0102 | 4 cr | 60h
Circuitos de corrente alternada. Fasores.
Conteúdo Programático
1. Corrente alternada senoidal
2. Fasores e impedância
3. Circuitos RLC

Sinais e Sistemas
ELE0201 | 4 cr | 60h
Sistemas lineares e invariantes no tempo.
Transformada de Laplace.
`

// ─── Testes: ementa completa ──────────────────────────────────────────────────

describe('extractEmentaStructure — ementa completa', () => {
  const result = extractEmentaStructure(EMENTA_COMPLETA)

  it('extrai o código da disciplina', () => {
    expect(result.partial.code).toBe('SCC0221')
    expect(result.partial._confidence.code).toBe('high')
  })

  it('extrai os créditos', () => {
    expect(result.partial.credits).toBe(4)
    expect(result.partial._confidence.credits).toBe('high')
  })

  it('extrai a carga horária', () => {
    expect(result.partial.workload_hours).toBe(60)
    expect(result.partial._confidence.workload_hours).toBe('high')
  })

  it('extrai o nome da disciplina', () => {
    expect(result.partial.name).toBeTruthy()
    expect(result.partial._confidence.name).toBeTruthy()
  })

  it('extrai os tópicos com confiança alta', () => {
    expect(result.partial.topics).toBeDefined()
    expect(result.partial.topics!.length).toBeGreaterThanOrEqual(4)
    expect(result.partial._confidence.topics).toBe('high')
  })

  it('tópicos não contêm marcadores numéricos residuais', () => {
    for (const topic of result.partial.topics ?? []) {
      expect(topic).not.toMatch(/^\d+[\.\-\)]/)
    }
  })

  it('extrai a bibliografia', () => {
    expect(result.partial.bibliography).toBeDefined()
    expect(result.partial.bibliography!.length).toBeGreaterThanOrEqual(2)
    expect(result.partial._confidence.bibliography).toBe('high')
  })

  it('extrai os pré-requisitos', () => {
    expect(result.partial.prerequisites).toBeDefined()
    expect(result.partial.prerequisites!.length).toBeGreaterThanOrEqual(1)
    expect(result.partial._confidence.prerequisites).toBe('high')
  })

  it('extrai a descrição da seção ementa', () => {
    expect(result.partial.description).toBeDefined()
    expect(result.partial.description!.length).toBeGreaterThan(20)
    expect(result.partial._confidence.description).toBe('high')
  })

  it('detecta como disciplina única (não ementário)', () => {
    expect(result.likelyMultiple).toBe(false)
  })

  it('inclui seções brutas em _rawSections', () => {
    expect(result.partial._rawSections).toBeDefined()
    expect(result.partial._rawSections.topics).toBeTruthy()
  })
})

// ─── Testes: ementa sem marcadores de lista ───────────────────────────────────

describe('extractEmentaStructure — ementa sem marcadores', () => {
  const result = extractEmentaStructure(EMENTA_SEM_MARCADORES)

  it('extrai código do header compacto (MAT0101)', () => {
    expect(result.partial.code).toBe('MAT0101')
  })

  it('extrai créditos do formato compacto "4 créditos"', () => {
    expect(result.partial.credits).toBe(4)
  })

  it('extrai carga horária do formato "60 horas"', () => {
    expect(result.partial.workload_hours).toBe(60)
  })

  it('captura tópicos mesmo sem marcadores numéricos', () => {
    expect(result.partial.topics).toBeDefined()
    expect(result.partial.topics!.length).toBeGreaterThanOrEqual(3)
  })
})

// ─── Testes: ementa mínima ────────────────────────────────────────────────────

describe('extractEmentaStructure — ementa com dados mínimos', () => {
  const result = extractEmentaStructure(EMENTA_MINIMA)

  it('extrai código quando presente', () => {
    expect(result.partial.code).toBe('FLP0101')
  })

  it('extrai carga horária no formato simples "60h"', () => {
    expect(result.partial.workload_hours).toBe(60)
  })

  it('marca campos ausentes como missing', () => {
    expect(result.partial._confidence.bibliography).toBe('missing')
    expect(result.partial._confidence.prerequisites).toBe('missing')
  })

  it('não cria arrays vazios — campos ausentes ficam undefined', () => {
    expect(result.partial.bibliography).toBeUndefined()
    expect(result.partial.prerequisites).toBeUndefined()
  })

  it('inclui _rawSections mesmo sem seções estruturadas', () => {
    expect(result.partial._rawSections).toBeDefined()
    expect(typeof result.partial._rawSections._header).toBe('string')
  })
})

// ─── Testes: ementário (múltiplas disciplinas) ────────────────────────────────

describe('extractEmentaStructure — ementário', () => {
  const result = extractEmentaStructure(EMENTARIO)

  it('detecta múltiplas disciplinas (likelyMultiple = true)', () => {
    expect(result.likelyMultiple).toBe(true)
  })
})

// ─── Testes: sanidade de dados ───────────────────────────────────────────────

describe('extractEmentaStructure — sanidade de valores', () => {
  it('rejeita créditos absurdos (ex: 99)', () => {
    const text = 'Disciplina Teste\nCódigo: TST0001\n99 créditos\nCarga: 60h'
    const { partial } = extractEmentaStructure(text)
    expect(partial.credits).toBeUndefined()
    expect(partial._confidence.credits).toMatch(/low|missing/)
  })

  it('rejeita carga horária absurda (ex: 5h)', () => {
    const text = 'Disciplina Teste\nCódigo: TST0001\n4 créditos\n5h'
    const { partial } = extractEmentaStructure(text)
    expect(partial.workload_hours).toBeUndefined()
  })

  it('tópicos individuais não excedem 300 chars', () => {
    const { partial } = extractEmentaStructure(EMENTA_COMPLETA)
    for (const topic of partial.topics ?? []) {
      expect(topic.length).toBeLessThanOrEqual(300)
    }
  })

  it('tópicos individuais têm pelo menos 3 chars', () => {
    const { partial } = extractEmentaStructure(EMENTA_COMPLETA)
    for (const topic of partial.topics ?? []) {
      expect(topic.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('_confidence está presente para todos os campos tentados', () => {
    const { partial } = extractEmentaStructure(EMENTA_COMPLETA)
    const expectedFields = ['code', 'credits', 'workload_hours', 'university', 'course', 'name', 'topics', 'bibliography', 'prerequisites', 'description']
    for (const field of expectedFields) {
      expect(partial._confidence[field]).toBeDefined()
    }
  })
})
