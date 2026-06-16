/**
 * Integration tests for apps/api/src/routes/skills.ts
 *
 * checkin/recalibrate: testa a ordem de verificação (cooldown 429 → limite
 * 402 → execução 200) e os shapes exatos de CooldownResponse / LimitedResponse.
 * diagnose: testa o wiring com checkAndIncrementApiCall (402 + LimitedResponse,
 * 200 com/sem warning de 80%). Mocka supabase, lib/cooldowns, lib/limits e os
 * services de diagnose/checkin/recalibrate.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'

// ── Mocks ──────────────────────────────────────────────────────────────────

const {
  mockSingle, mockFrom,
  mockCheckSkillCooldown, mockRecordSkillUsage,
  mockCheckAndIncrementApiCall,
  mockRunCheckin, mockRunRecalibration, mockRunDiagnosis,
} = vi.hoisted(() => {
  const mockSingle = vi.fn()
  const mockEq     = vi.fn(() => ({ single: mockSingle }))
  const mockSelect = vi.fn(() => ({ eq: mockEq }))
  const mockFrom   = vi.fn(() => ({ select: mockSelect }))
  return {
    mockSingle, mockEq, mockSelect, mockFrom,
    mockCheckSkillCooldown:       vi.fn(),
    mockRecordSkillUsage:         vi.fn(),
    mockCheckAndIncrementApiCall: vi.fn(),
    mockRunCheckin:               vi.fn(),
    mockRunRecalibration:         vi.fn(),
    mockRunDiagnosis:             vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: { from: mockFrom },
}))

vi.mock('../../lib/cooldowns', () => ({
  checkSkillCooldown: mockCheckSkillCooldown,
  recordSkillUsage:   mockRecordSkillUsage,
}))

vi.mock('../../lib/limits', () => ({
  checkAndIncrementApiCall: mockCheckAndIncrementApiCall,
}))

vi.mock('../../services/checkinService', () => ({
  runCheckin: mockRunCheckin,
}))

vi.mock('../../services/recalibrateService', () => ({
  runRecalibration: mockRunRecalibration,
}))

vi.mock('../../services/diagnoseService', () => ({
  runDiagnosis: mockRunDiagnosis,
}))

// ── Imports após mock ─────────────────────────────────────────────────────

import { skillsRoutes } from '../skills'

const TEST_USER_ID = 'user-1'
const TEST_PLAN_ID = 'plan-1'

const buildApp = async () => {
  const app = Fastify()
  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.user = { sub: TEST_USER_ID }
  })
  await app.register(skillsRoutes, { prefix: '/api/skills' })
  await app.ready()
  return app
}

const CHECKIN_BODY = {
  plan_id:                 TEST_PLAN_ID,
  week:                    2,
  topics_covered:          ['Limites'],
  mastery_criteria_results: [{ topic: 'Limites', achieved: true }],
  spaced_reviews_done:     true,
  difficulties:            'Nenhuma',
  hours_studied_this_week: 5,
  hours_planned_this_week: 6,
  application_context:     'Engenharia',
}

const RECALIBRATE_BODY = {
  plan_id:             TEST_PLAN_ID,
  blocked_topic:       'Derivadas',
  block_type:          'compreensão' as const,
  weeks_current:       3,
  weeks_remaining:     5,
  topics_remaining:    ['Integrais'],
  topics_done:         ['Limites'],
  application_context: 'Engenharia',
  current_scaffolding: 'alto' as const,
}

const DIAGNOSE_BODY = {
  subject_name:           'Cálculo I',
  topics:                 ['Limites', 'Derivadas'],
  prior_knowledge_level:  3,
  learning_formats:       ['video', 'texto'],
  application_context:    'Engenharia',
  weekly_hours:           6,
}

beforeEach(() => {
  vi.clearAllMocks()
  mockSingle.mockResolvedValue({ data: { plan: 'free' }, error: null })
})

describe('POST /api/skills/checkin', () => {
  it('retorna 429 com CooldownResponse quando em cooldown', async () => {
    mockCheckSkillCooldown.mockResolvedValueOnce({
      allowed: false,
      cooldown: { cooldown: true, retry_at: '2026-06-11T00:00:00.000Z', message: 'Você já fez check-in recentemente. Tente novamente mais tarde.' },
    })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/skills/checkin', payload: CHECKIN_BODY })

    expect(res.statusCode).toBe(429)
    expect(res.json()).toEqual({
      cooldown: true,
      retry_at: '2026-06-11T00:00:00.000Z',
      message: 'Você já fez check-in recentemente. Tente novamente mais tarde.',
    })
    expect(mockRunCheckin).not.toHaveBeenCalled()
    expect(mockRecordSkillUsage).not.toHaveBeenCalled()
  })

  it('retorna 402 com LimitedResponse quando cooldown ok mas limite de calls atingido', async () => {
    mockCheckSkillCooldown.mockResolvedValueOnce({ allowed: true })
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({
      allowed: false,
      limited: { limited: true, upgrade_url: '/planos', usage: { used: 10, max: 10, percent: 100 } },
    })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/skills/checkin', payload: CHECKIN_BODY })

    expect(res.statusCode).toBe(402)
    expect(res.json()).toEqual({
      limited: true,
      upgrade_url: '/planos',
      usage: { used: 10, max: 10, percent: 100 },
    })
    expect(mockRunCheckin).not.toHaveBeenCalled()
  })

  it('retorna 200 e registra o uso quando permitido', async () => {
    mockCheckSkillCooldown.mockResolvedValueOnce({ allowed: true })
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({ allowed: true })
    mockRunCheckin.mockResolvedValueOnce({ trend: 'on-track' })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/skills/checkin', payload: CHECKIN_BODY })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ checkin: { trend: 'on-track' } })
    expect(mockRecordSkillUsage).toHaveBeenCalledWith(TEST_USER_ID, TEST_PLAN_ID, 'checkin')
  })
})

describe('POST /api/skills/recalibrate', () => {
  it('retorna 429 com CooldownResponse quando em cooldown', async () => {
    mockCheckSkillCooldown.mockResolvedValueOnce({
      allowed: false,
      cooldown: { cooldown: true, retry_at: '2026-06-17T00:00:00.000Z', message: 'Você já recalibrou o plano recentemente. Tente novamente na próxima semana.' },
    })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/skills/recalibrate', payload: RECALIBRATE_BODY })

    expect(res.statusCode).toBe(429)
    expect(res.json()).toEqual({
      cooldown: true,
      retry_at: '2026-06-17T00:00:00.000Z',
      message: 'Você já recalibrou o plano recentemente. Tente novamente na próxima semana.',
    })
    expect(mockRunRecalibration).not.toHaveBeenCalled()
    expect(mockRecordSkillUsage).not.toHaveBeenCalled()
  })

  it('retorna 402 com LimitedResponse quando cooldown ok mas limite de calls atingido', async () => {
    mockCheckSkillCooldown.mockResolvedValueOnce({ allowed: true })
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({
      allowed: false,
      limited: { limited: true, upgrade_url: '/planos', usage: { used: 10, max: 10, percent: 100 } },
    })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/skills/recalibrate', payload: RECALIBRATE_BODY })

    expect(res.statusCode).toBe(402)
    expect(res.json()).toEqual({
      limited: true,
      upgrade_url: '/planos',
      usage: { used: 10, max: 10, percent: 100 },
    })
    expect(mockRunRecalibration).not.toHaveBeenCalled()
  })

  it('retorna 200 e registra o uso quando permitido', async () => {
    mockCheckSkillCooldown.mockResolvedValueOnce({ allowed: true })
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({ allowed: true })
    mockRunRecalibration.mockResolvedValueOnce({ newScaffolding: 'alto' })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/skills/recalibrate', payload: RECALIBRATE_BODY })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recalibration: { newScaffolding: 'alto' } })
    expect(mockRecordSkillUsage).toHaveBeenCalledWith(TEST_USER_ID, TEST_PLAN_ID, 'recalibrate')
  })
})

describe('POST /api/skills/diagnose', () => {
  it('retorna 402 com LimitedResponse quando o limite de calls foi atingido', async () => {
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({
      allowed: false,
      limited: { limited: true, upgrade_url: '/planos', usage: { used: 10, max: 10, percent: 100 } },
    })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/skills/diagnose', payload: DIAGNOSE_BODY })

    expect(res.statusCode).toBe(402)
    expect(res.json()).toEqual({
      limited: true,
      upgrade_url: '/planos',
      usage: { used: 10, max: 10, percent: 100 },
    })
    expect(mockRunDiagnosis).not.toHaveBeenCalled()
  })

  it('retorna 200 com o diagnóstico quando dentro do limite', async () => {
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({ allowed: true })
    mockRunDiagnosis.mockResolvedValueOnce({ zdpLevel: 'foundation' })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/skills/diagnose', payload: DIAGNOSE_BODY })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ diagnostic: { zdpLevel: 'foundation' } })
  })

  it('retorna 200 com warning quando uso atinge 80%', async () => {
    mockCheckAndIncrementApiCall.mockResolvedValueOnce({
      allowed: true,
      warning: { warning: true, usage: { used: 8, max: 10, percent: 80 } },
    })
    mockRunDiagnosis.mockResolvedValueOnce({ zdpLevel: 'foundation' })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/skills/diagnose', payload: DIAGNOSE_BODY })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      diagnostic: { zdpLevel: 'foundation' },
      warning: true,
      usage: { used: 8, max: 10, percent: 80 },
    })
  })
})
