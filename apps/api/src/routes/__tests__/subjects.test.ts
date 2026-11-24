/**
 * Unit tests for apps/api/src/routes/subjects.ts
 *
 * Cobre os 7 endpoints (upload, text, batch, list, get, patch, delete), mockando
 * supabase com um builder encadeável genérico e services/subjectService.
 * Upload usa FormData/Blob globais — light-my-request 6.x envia como multipart real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'
import multipart from '@fastify/multipart'

// ── Mocks ──────────────────────────────────────────────────────────────────

const {
  supabaseMock,
  mockParseSubjectFromText, mockParseSubjectFromPdf, mockSaveSubject, mockCompleteEmentarioEntries,
  MockPdfProcessingError,
} = vi.hoisted(() => {
  type Result = { data: unknown; error: unknown }
  const queue: Result[] = []
  const next = (): Result => queue.shift() ?? { data: null, error: null }

  const raw: Record<string, unknown> = {}
  for (const name of ['select', 'insert', 'update', 'delete', 'eq', 'order']) {
    raw[name] = vi.fn(() => raw)
  }
  raw.single = vi.fn(() => Promise.resolve(next()))
  raw.then = (onFulfilled?: (v: Result) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(onFulfilled, onRejected)

  const from       = vi.fn(() => raw)
  const deleteUser = vi.fn()

  // Espelha PdfProcessingError — a rota faz `instanceof` com o valor importado
  // do módulo mockado, então este construtor precisa ser registrado no mock.
  class MockPdfProcessingError extends Error {
    constructor(readonly code: string) {
      super(code)
      this.name = 'PdfProcessingError'
    }
  }

  return {
    supabaseMock: {
      from,
      deleteUser,
      supabase: { from, auth: { admin: { deleteUser } } },
      queueResult: (result: Result) => { queue.push(result) },
    },
    mockParseSubjectFromText: vi.fn(),
    mockParseSubjectFromPdf:  vi.fn(),
    mockSaveSubject:          vi.fn(),
    mockCompleteEmentarioEntries: vi.fn(),
    MockPdfProcessingError,
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: supabaseMock.supabase,
}))

vi.mock('../../services/subjectService', () => ({
  parseSubjectFromText: mockParseSubjectFromText,
  parseSubjectFromPdf:  mockParseSubjectFromPdf,
  saveSubject:          mockSaveSubject,
  completeEmentarioEntries: mockCompleteEmentarioEntries,
  PdfProcessingError:   MockPdfProcessingError,
  MAX_OCR_PAGES:        20,
}))

// ── Imports após mock ─────────────────────────────────────────────────────

import { subjectsRoutes } from '../subjects'

const TEST_USER_ID = 'user-1'

const buildApp = async () => {
  const app = Fastify()
  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    request.user = { sub: TEST_USER_ID }
  })
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })
  await app.register(subjectsRoutes, { prefix: '/api/subjects' })
  await app.ready()
  return app
}

const parsedSubject = { name: 'Cálculo I', topics: [], bibliography: [], prerequisites: [] }
const parsedSubject2 = { name: 'Álgebra Linear', topics: [], bibliography: [], prerequisites: [] }
const ementarioEntries = [
  { index: 0, name: 'Cálculo I', code: 'MAT-101', workload_hours: 60, source_text: 'DISCIPLINA\nCálculo I\nEMENTA\nLimites.' },
  { index: 1, name: 'Álgebra Linear', code: 'MAT-202', workload_hours: 60, source_text: 'DISCIPLINA\nÁlgebra Linear\nEMENTA\nVetores.' },
]
const validSourceText = 'DISCIPLINA\nCálculo I\nEMENTA\nLimites, derivadas e integrais de funções reais.'

beforeEach(() => {
  vi.clearAllMocks()
})

// ── POST /upload ─────────────────────────────────────────────────────────────

describe('POST /api/subjects/upload', () => {
  it('retorna 201 com a ementa salva quando PDF tem 1 disciplina', async () => {
    mockParseSubjectFromPdf.mockResolvedValueOnce({ kind: 'single', subject: parsedSubject })
    mockSaveSubject.mockResolvedValueOnce({ id: 'subject-1', name: 'Cálculo I' })

    const form = new FormData()
    form.append('file', new Blob([Buffer.from('%PDF-1.4')], { type: 'application/pdf' }), 'ementa.pdf')

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/upload', payload: form })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ subject: { id: 'subject-1', name: 'Cálculo I' } })
    expect(mockSaveSubject).toHaveBeenCalledWith(TEST_USER_ID, parsedSubject, '', 'pdf')
  })

  it('retorna a lista de disciplinas e o teto do usuário quando PDF é ementário', async () => {
    mockParseSubjectFromPdf.mockResolvedValueOnce({ kind: 'ementario', entries: ementarioEntries })
    supabaseMock.queueResult({ data: { plan: 'free', plans_count: 1 }, error: null })

    const form = new FormData()
    form.append('file', new Blob([Buffer.from('%PDF-1.4')], { type: 'application/pdf' }), 'ementario.pdf')

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/upload', payload: form })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ isEmentario: true, entries: ementarioEntries, selection_limit: 1 })
    expect(mockSaveSubject).not.toHaveBeenCalled()
    expect(mockCompleteEmentarioEntries).not.toHaveBeenCalled()
  })

  it('retorna 400 quando nenhum arquivo é enviado', async () => {
    const form = new FormData()
    form.append('note', 'sem arquivo')

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/upload', payload: form })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Nenhum arquivo enviado' })
    expect(mockParseSubjectFromPdf).not.toHaveBeenCalled()
  })

  it('retorna 400 quando o arquivo enviado não é PDF', async () => {
    const form = new FormData()
    form.append('file', new Blob([Buffer.from('conteúdo')], { type: 'text/plain' }), 'ementa.txt')

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/upload', payload: form })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Apenas PDF' })
    expect(mockParseSubjectFromPdf).not.toHaveBeenCalled()
  })

  it.each([
    ['PDF_SCANNED', 422, 'reconhecer texto'],
    ['PDF_INVALID', 422, 'corrompido ou protegido'],
    ['PDF_OCR_TOO_LONG', 422, 'até 20 páginas'],
    ['PDF_OCR_FAILED', 503, 'Tente novamente'],
    ['PDF_EMENTARIO_UNRECOGNIZED', 422, 'separar as disciplinas'],
  ])('traduz %s para status %i com mensagem acionável', async (code, status, messageExcerpt) => {
    // given
    mockParseSubjectFromPdf.mockRejectedValueOnce(new MockPdfProcessingError(code))

    const form = new FormData()
    form.append('file', new Blob([Buffer.from('%PDF-1.4')], { type: 'application/pdf' }), 'scanned.pdf')

    // when
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/upload', payload: form })

    // then
    expect(res.statusCode).toBe(status)
    const body = res.json()
    expect(body.code).toBe(code)
    expect(body.error).toEqual(expect.any(String))
    expect(body.message).toContain(messageExcerpt)
    expect(body.hint).toContain('Inserir texto')
    expect(mockSaveSubject).not.toHaveBeenCalled()
  })
})

// ── POST /text ────────────────────────────────────────────────────────────────

describe('POST /api/subjects/text', () => {
  it('retorna 201 com a ementa salva quando há 1 disciplina', async () => {
    const text = 'texto da ementa enviado manualmente pelo usuário '.repeat(2)
    mockParseSubjectFromText.mockResolvedValueOnce({ kind: 'single', subject: { name: 'Física I', topics: [] } })
    mockSaveSubject.mockResolvedValueOnce({ id: 'subject-2', name: 'Física I' })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/text', payload: { text } })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ subject: { id: 'subject-2', name: 'Física I' } })
    expect(mockSaveSubject).toHaveBeenCalledWith(TEST_USER_ID, { name: 'Física I', topics: [] }, text, 'text')
  })

  it('retorna a lista de disciplinas quando texto é ementário', async () => {
    const text = 'ementário com 2 disciplinas detalhadas '.repeat(3)
    mockParseSubjectFromText.mockResolvedValueOnce({ kind: 'ementario', entries: ementarioEntries })
    supabaseMock.queueResult({ data: { plan: 'pro', plans_count: 30 }, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/text', payload: { text } })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ isEmentario: true, entries: ementarioEntries, selection_limit: 5 })
    expect(mockSaveSubject).not.toHaveBeenCalled()
  })

  it('retorna 400 quando o texto tem menos de 50 caracteres', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/text', payload: { text: 'muito curto' } })

    expect(res.statusCode).toBe(400)
    expect(mockParseSubjectFromText).not.toHaveBeenCalled()
  })
})

// ── POST /ementario/complete ──────────────────────────────────────────────────

describe('POST /api/subjects/ementario/complete', () => {
  const completeUrl = '/api/subjects/ementario/complete'

  it('completa com IA apenas as disciplinas escolhidas', async () => {
    supabaseMock.queueResult({ data: { plan: 'pro', plans_count: 3 }, error: null })
    mockCompleteEmentarioEntries.mockResolvedValueOnce([parsedSubject])

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: completeUrl, payload: { entries: [{ source_text: validSourceText }] } })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ subjects: [parsedSubject] })
    expect(mockCompleteEmentarioEntries).toHaveBeenCalledWith([validSourceText])
  })

  it('retorna 402 sem chamar a IA quando a escolha excede o saldo de planos', async () => {
    supabaseMock.queueResult({ data: { plan: 'free', plans_count: 1 }, error: null })
    const entries = [{ source_text: validSourceText }, { source_text: validSourceText }]

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: completeUrl, payload: { entries } })

    expect(res.statusCode).toBe(402)
    expect(res.json()).toMatchObject({ limited: true, upgrade_url: '/planos' })
    expect(mockCompleteEmentarioEntries).not.toHaveBeenCalled()
  })

  it('retorna 400 acima do teto de disciplinas', async () => {
    const entries = Array.from({ length: 6 }, () => ({ source_text: validSourceText }))

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: completeUrl, payload: { entries } })

    expect(res.statusCode).toBe(400)
    expect(mockCompleteEmentarioEntries).not.toHaveBeenCalled()
  })
})

// ── POST /batch ───────────────────────────────────────────────────────────────

describe('POST /api/subjects/batch', () => {
  it('salva todas as ementas selecionadas e retorna 201 com lista', async () => {
    mockSaveSubject
      .mockResolvedValueOnce({ id: 'subject-1', name: 'Cálculo I' })
      .mockResolvedValueOnce({ id: 'subject-2', name: 'Álgebra Linear' })

    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/subjects/batch',
      payload: { subjects: [parsedSubject, parsedSubject2] },
    })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({
      subjects: [
        { id: 'subject-1', name: 'Cálculo I' },
        { id: 'subject-2', name: 'Álgebra Linear' },
      ],
    })
    expect(mockSaveSubject).toHaveBeenCalledTimes(2)
    expect(mockSaveSubject).toHaveBeenCalledWith(TEST_USER_ID, parsedSubject, '', 'pdf')
    expect(mockSaveSubject).toHaveBeenCalledWith(TEST_USER_ID, parsedSubject2, '', 'pdf')
  })

  it('retorna 400 quando array de ementas está vazio', async () => {
    const app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/api/subjects/batch',
      payload: { subjects: [] },
    })

    expect(res.statusCode).toBe(400)
    expect(mockSaveSubject).not.toHaveBeenCalled()
  })
})

// ── GET /api/subjects ─────────────────────────────────────────────────────────

describe('GET /api/subjects', () => {
  it('retorna 200 com a lista de ementas do usuário', async () => {
    supabaseMock.queueResult({ data: [{ id: 'subject-1', name: 'Cálculo I' }], error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/subjects' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ subjects: [{ id: 'subject-1', name: 'Cálculo I' }] })
    expect(supabaseMock.from).toHaveBeenCalledWith('subjects')
  })
})

// ── GET /api/subjects/:id ─────────────────────────────────────────────────────

describe('GET /api/subjects/:id', () => {
  it('retorna 200 com a ementa quando encontrada', async () => {
    supabaseMock.queueResult({ data: { id: 'subject-1', name: 'Cálculo I' }, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/subjects/subject-1' })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ subject: { id: 'subject-1', name: 'Cálculo I' } })
  })

  it('retorna 404 quando a ementa não existe ou não pertence ao usuário', async () => {
    supabaseMock.queueResult({ data: null, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/api/subjects/outro-id' })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Ementa não encontrada' })
  })
})

// ── PATCH /api/subjects/:id ───────────────────────────────────────────────────

describe('PATCH /api/subjects/:id', () => {
  it('retorna 200 com os campos atualizados', async () => {
    supabaseMock.queueResult({ data: { id: 'subject-1', name: 'Cálculo I — Atualizado' }, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/subjects/subject-1', payload: { name: 'Cálculo I — Atualizado' } })

    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ subject: { id: 'subject-1', name: 'Cálculo I — Atualizado' } })
  })

  it('retorna 404 quando a ementa não existe ou não pertence ao usuário', async () => {
    supabaseMock.queueResult({ data: null, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'PATCH', url: '/api/subjects/outro-id', payload: { name: 'X' } })

    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: 'Ementa não encontrada' })
  })
})

// ── DELETE /api/subjects/:id ──────────────────────────────────────────────────

describe('DELETE /api/subjects/:id', () => {
  it('retorna 204 ao excluir a ementa do usuário', async () => {
    supabaseMock.queueResult({ data: null, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/subjects/subject-1' })

    expect(res.statusCode).toBe(204)
    expect(supabaseMock.from).toHaveBeenCalledWith('subjects')
  })
})
