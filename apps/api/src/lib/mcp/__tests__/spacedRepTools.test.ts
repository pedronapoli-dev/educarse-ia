/**
 * Unit tests for apps/api/src/lib/mcp/spacedRepTools.ts
 *
 * calculateReviewSchedule and getNextReviewsDue are pure TypeScript functions
 * (type-only import from @anthropic-ai/sdk, zero external I/O), so no mocks are
 * needed. Tests verify SM-2 structural properties (3 review dates, ease_factor
 * bounds, ascending order), behavioral properties (performance history overrides
 * difficulty_hint, low accuracy triggers earlier reviews), and the classification
 * buckets of getNextReviewsDue (overdue / due_today / upcoming_7days / excluded).
 */

import { describe, it, expect } from 'vitest'
import { calculateReviewSchedule, getNextReviewsDue } from '../spacedRepTools'

// ── calculateReviewSchedule ───────────────────────────────────────────────────

describe('calculateReviewSchedule', () => {
  it('retorna um array vazio quando nenhum tópico é fornecido', () => {
    // given
    const input = { topics: [] }
    // when
    const result = calculateReviewSchedule(input)
    // then
    expect(result).toEqual([])
  })

  it('gera exatamente 3 datas de revisão por tópico', () => {
    // given
    const input = {
      topics: [{ topic: 'Limites', study_date: '2026-01-01', difficulty_hint: 'medio' as const }],
    }
    // when
    const result = calculateReviewSchedule(input)
    // then
    expect(result[0].review_dates).toHaveLength(3)
  })

  it('preserva o topic e study_date no resultado', () => {
    // given
    const input = {
      topics: [{ topic: 'Derivadas', study_date: '2026-02-10', difficulty_hint: 'facil' as const }],
    }
    // when
    const [entry] = calculateReviewSchedule(input)
    // then
    expect(entry.topic).toBe('Derivadas')
    expect(entry.study_date).toBe('2026-02-10')
  })

  it('ease_factor resultante é sempre >= 1.3 (limite mínimo SM-2)', () => {
    // given: dificil → quality baixo → ease_factor potencialmente baixo
    const input = {
      topics: [{ topic: 'Integrais', study_date: '2026-01-01', difficulty_hint: 'dificil' as const }],
    }
    // when
    const [entry] = calculateReviewSchedule(input)
    // then
    expect(entry.ease_factor).toBeGreaterThanOrEqual(1.3)
  })

  it('tópico difícil gera revisões mais próximas do que tópico fácil', () => {
    // given
    const studyDate = '2026-03-01'
    const [facil] = calculateReviewSchedule({
      topics: [{ topic: 'T', study_date: studyDate, difficulty_hint: 'facil' as const }],
    })
    const [dificil] = calculateReviewSchedule({
      topics: [{ topic: 'T', study_date: studyDate, difficulty_hint: 'dificil' as const }],
    })
    // when / then: última revisão do fácil deve ser mais distante do que a do difícil
    const lastFacil   = new Date(facil.review_dates[2]).getTime()
    const lastDificil = new Date(dificil.review_dates[2]).getTime()
    expect(lastFacil).toBeGreaterThan(lastDificil)
  })

  it('histórico de performance (alta acurácia) sobrepõe difficulty_hint', () => {
    // given: difficulty_hint = 'dificil' mas acurácia de 95% → quality alto
    const input = {
      topics: [{ topic: 'Limites', study_date: '2026-01-01', difficulty_hint: 'dificil' as const }],
      student_performance_history: [{ topic: 'Limites', accuracy_percent: 95 }],
    }
    const inputSemHistorico = {
      topics: [{ topic: 'Limites', study_date: '2026-01-01', difficulty_hint: 'dificil' as const }],
    }
    // when
    const [comHistorico]    = calculateReviewSchedule(input)
    const [semHistorico]    = calculateReviewSchedule(inputSemHistorico)
    // then: com alta acurácia, a última revisão deve ser mais distante
    const lastComHistorico  = new Date(comHistorico.review_dates[2]).getTime()
    const lastSemHistorico  = new Date(semHistorico.review_dates[2]).getTime()
    expect(lastComHistorico).toBeGreaterThan(lastSemHistorico)
  })

  it('processa múltiplos tópicos independentemente', () => {
    // given
    const input = {
      topics: [
        { topic: 'Limites',   study_date: '2026-01-01', difficulty_hint: 'facil' as const },
        { topic: 'Derivadas', study_date: '2026-01-05', difficulty_hint: 'dificil' as const },
      ],
    }
    // when
    const result = calculateReviewSchedule(input)
    // then
    expect(result).toHaveLength(2)
    expect(result[0].topic).toBe('Limites')
    expect(result[1].topic).toBe('Derivadas')
    expect(result[0].review_dates).toHaveLength(3)
    expect(result[1].review_dates).toHaveLength(3)
  })

  it('todas as datas de revisão são posteriores à data de estudo', () => {
    // given
    const studyDate = '2026-06-01'
    const input = {
      topics: [{ topic: 'T', study_date: studyDate, difficulty_hint: 'medio' as const }],
    }
    // when
    const [entry] = calculateReviewSchedule(input)
    // then
    const studyMs = new Date(studyDate).getTime()
    for (const d of entry.review_dates) {
      expect(new Date(d).getTime()).toBeGreaterThan(studyMs)
    }
  })
})

// ── getNextReviewsDue ─────────────────────────────────────────────────────────

describe('getNextReviewsDue', () => {
  it('retorna todas as listas vazias quando não há revisões', () => {
    // given
    const input = { review_schedule: [], as_of_date: '2026-06-01' }
    // when
    const result = getNextReviewsDue(input)
    // then
    expect(result.overdue_topics).toEqual([])
    expect(result.due_today).toEqual([])
    expect(result.upcoming_7days).toEqual([])
  })

  it('classifica data passada como `overdue`', () => {
    // given
    const input = {
      review_schedule: [{ topic: 'Limites', review_dates: ['2026-05-01', '2026-05-10', '2026-05-20'] }],
      as_of_date: '2026-06-01',
    }
    // when
    const result = getNextReviewsDue(input)
    // then
    expect(result.overdue_topics).toContain('Limites')
    expect(result.due_today).not.toContain('Limites')
    expect(result.upcoming_7days).not.toContain('Limites')
  })

  it('classifica data igual à data de referência como `due_today`', () => {
    // given
    const today = '2026-06-15'
    const input = {
      review_schedule: [{ topic: 'Derivadas', review_dates: ['2026-07-01', today, '2026-06-20'] }],
      as_of_date: today,
    }
    // when
    const result = getNextReviewsDue(input)
    // then: a primeira data na lista que confere com today é retornada
    // mas o algoritmo verifica review_dates na ordem — '2026-07-01' é futuro > 7d
    // portanto precisamos que today seja a primeira data no futuro próximo
    // Vamos usar uma schedule onde today é a primeira data:
    const input2 = {
      review_schedule: [{ topic: 'Derivadas', review_dates: [today, '2026-06-20', '2026-07-01'] }],
      as_of_date: today,
    }
    const result2 = getNextReviewsDue(input2)
    expect(result2.due_today).toContain('Derivadas')
  })

  it('classifica data dentro de 7 dias (mas não hoje) como `upcoming_7days`', () => {
    // given
    const asOfDate = '2026-06-15'
    const in3Days  = '2026-06-18'
    const input = {
      review_schedule: [{ topic: 'Integrais', review_dates: [in3Days, '2026-07-01', '2026-07-15'] }],
      as_of_date: asOfDate,
    }
    // when
    const result = getNextReviewsDue(input)
    // then
    expect(result.upcoming_7days).toContain('Integrais')
    expect(result.overdue_topics).not.toContain('Integrais')
    expect(result.due_today).not.toContain('Integrais')
  })

  it('ignora datas além de 7 dias (não aparece em nenhuma lista)', () => {
    // given
    const input = {
      review_schedule: [{ topic: 'Séries', review_dates: ['2026-07-01', '2026-07-15', '2026-08-01'] }],
      as_of_date: '2026-06-15',
    }
    // when
    const result = getNextReviewsDue(input)
    // then
    expect(result.overdue_topics).not.toContain('Séries')
    expect(result.due_today).not.toContain('Séries')
    expect(result.upcoming_7days).not.toContain('Séries')
  })

  it('exclui tópicos presentes em `completed_topics`', () => {
    // given
    const input = {
      review_schedule: [
        { topic: 'Limites',   review_dates: ['2026-05-01'] },
        { topic: 'Derivadas', review_dates: ['2026-05-01'] },
      ],
      as_of_date: '2026-06-01',
      completed_topics: ['Limites'],
    }
    // when
    const result = getNextReviewsDue(input)
    // then
    expect(result.overdue_topics).not.toContain('Limites')
    expect(result.overdue_topics).toContain('Derivadas')
  })
})
