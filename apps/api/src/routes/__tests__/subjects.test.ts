/**
 * Integration tests for apps/api/src/routes/subjects.ts
 *
 * Cobre os 6 endpoints (upload, text, list, get, patch, delete), mockando
 * supabase com um builder encadeável genérico (select/insert/update/delete/
 * eq/order, com single() e await resolvendo a fila de resultados) e
 * services/subjectService. Upload usa FormData/Blob globais — light-my-request
 * 6.x envia como multipart real.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify, { type FastifyRequest, type FastifyReply } from 'fastify'
import multipart from '@fastify/multipart'

// ── Mocks ──────────────────────────────────────────────────────────────────

const {
  supabaseMock,
  mockExtractTextFromPdf, mockParseSubjectFromText, mockSaveSubject,
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

  return {
    supabaseMock: {
      from,
      deleteUser,
      supabase: { from, auth: { admin: { deleteUser } } },
      queueResult: (result: Result) => { queue.push(result) },
    },
    mockExtractTextFromPdf:   vi.fn(),
    mockParseSubjectFromText: vi.fn(),
    mockSaveSubject:          vi.fn(),
  }
})

vi.mock('../../lib/supabase', () => ({
  supabase: supabaseMock.supabase,
}))

vi.mock('../../services/subjectService', () => ({
  extractTextFromPdf:   mockExtractTextFromPdf,
  parseSubjectFromText: mockParseSubjectFromText,
  saveSubject:          mockSaveSubject,
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

beforeEach(() => {
  vi.clearAllMocks()
})

describe('POST /api/subjects/upload', () => {
  it('retorna 201 com a ementa salva quando o PDF é válido', async () => {
    mockExtractTextFromPdf.mockResolvedValueOnce('texto extraído da ementa '.repeat(5))
    mockParseSubjectFromText.mockResolvedValueOnce({ name: 'Cálculo I', topics: [] })
    mockSaveSubject.mockResolvedValueOnce({ id: 'subject-1', name: 'Cálculo I' })

    const form = new FormData()
    form.append('file', new Blob([Buffer.from('%PDF-1.4 conteúdo de teste')], { type: 'application/pdf' }), 'ementa.pdf')

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/upload', payload: form })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ subject: { id: 'subject-1', name: 'Cálculo I' } })
    expect(mockSaveSubject).toHaveBeenCalledWith(TEST_USER_ID, { name: 'Cálculo I', topics: [] }, expect.any(String), 'pdf')
  })

  it('retorna 400 quando nenhum arquivo é enviado', async () => {
    const form = new FormData()
    form.append('note', 'sem arquivo')

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/upload', payload: form })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Nenhum arquivo enviado' })
    expect(mockExtractTextFromPdf).not.toHaveBeenCalled()
  })

  it('retorna 400 quando o arquivo enviado não é PDF', async () => {
    const form = new FormData()
    form.append('file', new Blob([Buffer.from('conteúdo')], { type: 'text/plain' }), 'ementa.txt')

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/upload', payload: form })

    expect(res.statusCode).toBe(400)
    expect(res.json()).toEqual({ error: 'Apenas PDF' })
    expect(mockExtractTextFromPdf).not.toHaveBeenCalled()
  })

  it('retorna 422 quando o PDF não tem texto suficiente', async () => {
    mockExtractTextFromPdf.mockResolvedValueOnce('texto curto')

    const form = new FormData()
    form.append('file', new Blob([Buffer.from('%PDF-1.4')], { type: 'application/pdf' }), 'ementa.pdf')

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/upload', payload: form })

    expect(res.statusCode).toBe(422)
    expect(res.json()).toEqual({ error: 'PDF sem texto suficiente' })
    expect(mockParseSubjectFromText).not.toHaveBeenCalled()
  })
})

describe('POST /api/subjects/text', () => {
  it('retorna 201 com a ementa salva', async () => {
    const text = 'texto da ementa enviado manualmente pelo usuário '.repeat(2)
    mockParseSubjectFromText.mockResolvedValueOnce({ name: 'Física I', topics: [] })
    mockSaveSubject.mockResolvedValueOnce({ id: 'subject-2', name: 'Física I' })

    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/text', payload: { text } })

    expect(res.statusCode).toBe(201)
    expect(res.json()).toEqual({ subject: { id: 'subject-2', name: 'Física I' } })
    expect(mockSaveSubject).toHaveBeenCalledWith(TEST_USER_ID, { name: 'Física I', topics: [] }, text, 'text')
  })

  it('retorna 400 quando o texto tem menos de 50 caracteres', async () => {
    const app = await buildApp()
    const res = await app.inject({ method: 'POST', url: '/api/subjects/text', payload: { text: 'muito curto' } })

    expect(res.statusCode).toBe(400)
    expect(mockParseSubjectFromText).not.toHaveBeenCalled()
  })
})

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

describe('DELETE /api/subjects/:id', () => {
  it('retorna 204 ao excluir a ementa do usuário', async () => {
    supabaseMock.queueResult({ data: null, error: null })

    const app = await buildApp()
    const res = await app.inject({ method: 'DELETE', url: '/api/subjects/subject-1' })

    expect(res.statusCode).toBe(204)
    expect(supabaseMock.from).toHaveBeenCalledWith('subjects')
  })
})
