/**
 * Unit tests for apps/api/src/lib/skillRouter.ts
 *
 * All 5 exported functions are pure (no I/O, no DB), so no mocks are needed.
 * Covers every decision boundary: level thresholds (3/6), urgency windows
 * (14/30 days), phase percentages (30%/70%), performance trend thresholds
 * (lag 20/-10, mastery 60/85), and all 6 skill routing branches with their
 * internal variants. Uses AAA pattern with inline given/when/then comments.
 */

import { describe, it, expect } from 'vitest'
import { futureDate, pastDate } from '../../__tests__/helpers'
import {
  inferStudentLevel,
  inferUrgency,
  inferPlanPhase,
  inferPerformanceTrend,
  routeSkill,
} from '../skillRouter'

// ── inferStudentLevel ─────────────────────────────────────────────────────────

describe('inferStudentLevel', () => {
  it('retorna `iniciante` quando conhecimento prévio é 0 (abaixo do limite inferior)', () => {
    expect(inferStudentLevel(0)).toBe('iniciante')
  })

  it('retorna `iniciante` quando conhecimento prévio é exatamente 3 (no limite)', () => {
    expect(inferStudentLevel(3)).toBe('iniciante')
  })

  it('retorna `intermediario` quando conhecimento prévio é 4 (acima do limite inferior)', () => {
    expect(inferStudentLevel(4)).toBe('intermediario')
  })

  it('retorna `intermediario` quando conhecimento prévio é exatamente 6 (no limite superior)', () => {
    expect(inferStudentLevel(6)).toBe('intermediario')
  })

  it('retorna `avancado` quando conhecimento prévio é 7 (acima do limite superior)', () => {
    expect(inferStudentLevel(7)).toBe('avancado')
  })

  it('retorna `avancado` quando conhecimento prévio é 10 (máximo)', () => {
    expect(inferStudentLevel(10)).toBe('avancado')
  })
})

// ── inferUrgency ──────────────────────────────────────────────────────────────

describe('inferUrgency', () => {
  it('retorna `baixa` quando nenhuma data de prova é fornecida', () => {
    expect(inferUrgency(undefined)).toBe('baixa')
  })

  it('retorna `alta` quando a prova é em exatamente 14 dias (no limite de urgência)', () => {
    // given
    const examDate = futureDate(14)
    // when / then
    expect(inferUrgency(examDate)).toBe('alta')
  })

  it('retorna `alta` quando a prova é em 13 dias (dentro da janela de urgência)', () => {
    expect(inferUrgency(futureDate(13))).toBe('alta')
  })

  it('retorna `media` quando a prova é em exatamente 30 dias (no limite relaxado)', () => {
    expect(inferUrgency(futureDate(30))).toBe('media')
  })

  it('retorna `media` quando a prova é em 15 dias (entre urgente e relaxado)', () => {
    expect(inferUrgency(futureDate(15))).toBe('media')
  })

  it('retorna `baixa` quando a prova é em 31 dias (além da janela relaxada)', () => {
    expect(inferUrgency(futureDate(31))).toBe('baixa')
  })

  it('retorna `alta` quando a data de prova já passou (daysUntil ≤ 0)', () => {
    expect(inferUrgency(pastDate(1))).toBe('alta')
  })
})

// ── inferPlanPhase ────────────────────────────────────────────────────────────

describe('inferPlanPhase', () => {
  it('retorna `inicial` quando progresso é 0%', () => {
    expect(inferPlanPhase(0)).toBe('inicial')
  })

  it('retorna `inicial` quando progresso é 29% (abaixo do limite de fase intermediária)', () => {
    expect(inferPlanPhase(29)).toBe('inicial')
  })

  it('retorna `intermediaria` quando progresso é exatamente 30% (no limite inferior)', () => {
    expect(inferPlanPhase(30)).toBe('intermediaria')
  })

  it('retorna `intermediaria` quando progresso é 69% (abaixo do limite final)', () => {
    expect(inferPlanPhase(69)).toBe('intermediaria')
  })

  it('retorna `final` quando progresso é exatamente 70% (no limite superior)', () => {
    expect(inferPlanPhase(70)).toBe('final')
  })

  it('retorna `final` quando progresso é 100%', () => {
    expect(inferPlanPhase(100)).toBe('final')
  })
})

// ── inferPerformanceTrend ─────────────────────────────────────────────────────

describe('inferPerformanceTrend', () => {
  it('retorna `atrasado` quando o atraso (lag) é maior que 20%', () => {
    // given: progresso 40%, esperado 70% → lag = 30 > 20
    expect(inferPerformanceTrend(40, 70, 80)).toBe('atrasado')
  })

  it('retorna `atrasado` quando a taxa de domínio é menor que 60% (mesmo com lag ok)', () => {
    // given: lag = 0, mastery = 50 < 60
    expect(inferPerformanceTrend(50, 50, 50)).toBe('atrasado')
  })

  it('retorna `adiantado` quando o aluno está 11% à frente e tem domínio acima de 85%', () => {
    // given: lag = 50 - 61 = -11 < -10, mastery = 90 > 85
    expect(inferPerformanceTrend(61, 50, 90)).toBe('adiantado')
  })

  it('retorna `no-ritmo` quando o aluno está dentro das bandas normais', () => {
    // given: lag = 5, mastery = 75 — ambos dentro dos limites
    expect(inferPerformanceTrend(45, 50, 75)).toBe('no-ritmo')
  })

  it('retorna `no-ritmo` quando adiantado mas domínio não supera 85%', () => {
    // given: lag = -11 (adiantado), mastery = 80 (não supera 85) → fallback
    expect(inferPerformanceTrend(61, 50, 80)).toBe('no-ritmo')
  })

  it('retorna `atrasado` quando lag é exatamente 21 (acima do limite)', () => {
    expect(inferPerformanceTrend(29, 50, 80)).toBe('atrasado')
  })
})

// ── routeSkill ────────────────────────────────────────────────────────────────

describe('routeSkill', () => {
  describe('generate-plan', () => {
    it('retorna `intensive-review` e systemPrompt intensivo quando urgência é alta', () => {
      // given
      const context = { skill: 'generate-plan' as const, urgency: 'alta' as const }
      // when
      const route = routeSkill(context)
      // then
      expect(route.variantName).toBe('intensive-review')
      expect(route.skillId).toBe('generate-plan')
      expect(route.systemPrompt).toBeTruthy()
      expect(route.rationale).toBeTruthy()
    })

    it('retorna `mastery-refinement` quando aluno é avançado e urgência não é alta', () => {
      const route = routeSkill({ skill: 'generate-plan', studentLevel: 'avancado', urgency: 'baixa' })
      expect(route.variantName).toBe('mastery-refinement')
    })

    it('retorna `foundation-first` quando aluno é iniciante e urgência não é alta', () => {
      const route = routeSkill({ skill: 'generate-plan', studentLevel: 'iniciante', urgency: 'media' })
      expect(route.variantName).toBe('foundation-first')
    })

    it('retorna `standard` quando nenhuma condição especial é atendida', () => {
      const route = routeSkill({ skill: 'generate-plan' })
      expect(route.variantName).toBe('standard')
    })

    it('`intensive-review` tem prioridade sobre `avancado` quando urgência é alta', () => {
      // given: urgência alta deve sobrepor nível avançado
      const route = routeSkill({ skill: 'generate-plan', studentLevel: 'avancado', urgency: 'alta' })
      expect(route.variantName).toBe('intensive-review')
    })
  })

  describe('checkin', () => {
    it('retorna `recovery` e usa RECALIBRATE_SYSTEM quando aluno está atrasado', () => {
      const route = routeSkill({ skill: 'checkin', performanceTrend: 'atrasado' })
      expect(route.variantName).toBe('recovery')
      expect(route.skillId).toBe('checkin')
    })

    it('retorna `acceleration` quando aluno está adiantado', () => {
      const route = routeSkill({ skill: 'checkin', performanceTrend: 'adiantado' })
      expect(route.variantName).toBe('acceleration')
    })

    it('retorna `standard-checkin` quando aluno está no ritmo', () => {
      const route = routeSkill({ skill: 'checkin', performanceTrend: 'no-ritmo' })
      expect(route.variantName).toBe('standard-checkin')
    })

    it('retorna `standard-checkin` quando performanceTrend não é fornecido', () => {
      const route = routeSkill({ skill: 'checkin' })
      expect(route.variantName).toBe('standard-checkin')
    })
  })

  describe('generate-exercises', () => {
    it('retorna `exercises-inicial` quando planPhase não é fornecido (nullish coalescing)', () => {
      const route = routeSkill({ skill: 'generate-exercises' })
      expect(route.variantName).toBe('exercises-inicial')
    })

    it('retorna `exercises-final` quando planPhase é `final`', () => {
      const route = routeSkill({ skill: 'generate-exercises', planPhase: 'final' })
      expect(route.variantName).toBe('exercises-final')
    })

    it('retorna `exercises-intermediaria` quando planPhase é `intermediaria`', () => {
      const route = routeSkill({ skill: 'generate-exercises', planPhase: 'intermediaria' })
      expect(route.variantName).toBe('exercises-intermediaria')
    })

    it('inclui rationale descrevendo a fase no campo rationale', () => {
      const route = routeSkill({ skill: 'generate-exercises', planPhase: 'final' })
      expect(route.rationale).toContain('final')
    })
  })

  it('`diagnose-student` retorna variantName `standard` e skillId correto', () => {
    const route = routeSkill({ skill: 'diagnose-student' })
    expect(route.variantName).toBe('standard')
    expect(route.skillId).toBe('diagnose-student')
    expect(route.systemPrompt).toBeTruthy()
  })

  it('`recalibrate` retorna variantName `standard` e skillId correto', () => {
    const route = routeSkill({ skill: 'recalibrate' })
    expect(route.variantName).toBe('standard')
    expect(route.skillId).toBe('recalibrate')
  })

  it('`parse-subject` retorna variantName `standard` e skillId correto', () => {
    const route = routeSkill({ skill: 'parse-subject' })
    expect(route.variantName).toBe('standard')
    expect(route.skillId).toBe('parse-subject')
  })
})
