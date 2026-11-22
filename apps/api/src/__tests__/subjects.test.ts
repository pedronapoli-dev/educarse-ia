import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import supertest from 'supertest'
import { buildTestApp } from './helpers/setup'
import { createTestUser, deleteTestUser } from './helpers/fixtures'
import { subjectsRoutes } from '../routes/subjects'
import type { FastifyInstance } from 'fastify'

// Mock das chamadas de IA — integração testa DB, não LLM
vi.mock('../services/subjectService', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../services/subjectService')>()
  return {
    ...mod,
    parseSubjectFromPdf: vi.fn().mockResolvedValue([
      {
        name: 'Cálculo II',
        code: 'MAT0122',
        course: 'Engenharia Civil',
        university: 'USP',
        credits: 4,
        workload_hours: 60,
        description: 'Ementa de teste para integração',
        topics: ['Limites', 'Derivadas', 'Integrais'],
        bibliography: ['Stewart, J. — Cálculo Vol. 2'],
        prerequisites: ['Cálculo I'],
      },
    ]),
    parseSubjectFromText: vi.fn().mockResolvedValue([
      {
        name: 'Cálculo II',
        code: 'MAT0122',
        course: 'Engenharia Civil',
        university: 'USP',
        credits: 4,
        workload_hours: 60,
        description: 'Ementa de teste para integração',
        topics: ['Limites', 'Derivadas', 'Integrais'],
        bibliography: ['Stewart, J. — Cálculo Vol. 2'],
        prerequisites: ['Cálculo I'],
      },
    ]),
  }
})

describe('subjects', () => {
  let app: FastifyInstance
  let userId: string
  let subjectId: string

  beforeAll(async () => {
    userId = await createTestUser()
    app = await buildTestApp(userId, async (fastify) => {
      await fastify.register(subjectsRoutes, { prefix: '/api/subjects' })
    })
  })

  afterAll(async () => {
    // Guarda contra beforeAll ter falhado (ex: Supabase offline)
    await app?.close()
    if (userId) await deleteTestUser(userId)
  })

  describe('POST /api/subjects/text', () => {
    it('cria ementa e retorna 201 com dados salvos', async () => {
      const res = await supertest(app.server)
        .post('/api/subjects/text')
        .send({
          text: 'Cálculo II — Ementa: limites, derivadas, integrais e séries. ' +
                'Pré-requisitos: Cálculo I. Carga horária: 60h.',
        })

      expect(res.status).toBe(201)
      expect(res.body.subject).toMatchObject({
        name: 'Cálculo II',
        code: 'MAT0122',
        user_id: userId,
      })
      subjectId = res.body.subject.id
    })

    it('rejeita texto com menos de 50 caracteres → 400', async () => {
      const res = await supertest(app.server)
        .post('/api/subjects/text')
        .send({ text: 'curto demais' })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/subjects/upload', () => {
    it('cria ementa a partir de PDF e retorna 201', async () => {
      const fakePdf = Buffer.from('%PDF-1.4 conteúdo de teste para integração de upload')

      const res = await supertest(app.server)
        .post('/api/subjects/upload')
        .attach('file', fakePdf, { filename: 'ementa.pdf', contentType: 'application/pdf' })

      expect(res.status).toBe(201)
      expect(res.body.subject).toMatchObject({ name: 'Cálculo II' })
    })

    it('rejeita arquivo que não é PDF → 400', async () => {
      const res = await supertest(app.server)
        .post('/api/subjects/upload')
        .attach('file', Buffer.from('conteúdo texto'), { filename: 'ementa.txt', contentType: 'text/plain' })

      expect(res.status).toBe(400)
    })
  })

  describe('POST /api/subjects/batch', () => {
    it('salva múltiplas ementas e retorna 201 com lista', async () => {
      const subjects = [
        {
          name: 'Física I', code: 'FIS101', course: 'Engenharia', university: 'USP',
          credits: 4, workload_hours: 60, description: 'Mecânica clássica.',
          topics: ['Cinemática', 'Dinâmica'], bibliography: [], prerequisites: [],
        },
        {
          name: 'Química Geral', code: 'QUI101', course: 'Engenharia', university: 'USP',
          credits: 4, workload_hours: 60, description: 'Fundamentos de química.',
          topics: ['Átomos', 'Ligações'], bibliography: [], prerequisites: [],
        },
      ]

      const res = await supertest(app.server)
        .post('/api/subjects/batch')
        .send({ subjects })

      expect(res.status).toBe(201)
      expect(res.body.subjects).toHaveLength(2)
      expect(res.body.subjects[0]).toMatchObject({ name: 'Física I', user_id: userId })
      expect(res.body.subjects[1]).toMatchObject({ name: 'Química Geral', user_id: userId })
    })

    it('rejeita array vazio → 400', async () => {
      const res = await supertest(app.server)
        .post('/api/subjects/batch')
        .send({ subjects: [] })

      expect(res.status).toBe(400)
    })
  })

  describe('GET /api/subjects/:id', () => {
    it('retorna ementa existente com todos os campos', async () => {
      const res = await supertest(app.server).get(`/api/subjects/${subjectId}`)

      expect(res.status).toBe(200)
      expect(res.body.subject).toMatchObject({
        id: subjectId,
        user_id: userId,
        name: 'Cálculo II',
      })
    })

    it('retorna 404 para UUID inexistente', async () => {
      const res = await supertest(app.server)
        .get('/api/subjects/00000000-0000-0000-0000-000000000000')

      expect(res.status).toBe(404)
    })
  })

  describe('PATCH /api/subjects/:id', () => {
    it('atualiza campos permitidos e retorna ementa atualizada', async () => {
      const res = await supertest(app.server)
        .patch(`/api/subjects/${subjectId}`)
        .send({ name: 'Cálculo II — Atualizado', credits: 6 })

      expect(res.status).toBe(200)
      expect(res.body.subject).toMatchObject({
        name: 'Cálculo II — Atualizado',
        credits: 6,
      })
    })

    it('retorna 404 para UUID inexistente', async () => {
      const res = await supertest(app.server)
        .patch('/api/subjects/00000000-0000-0000-0000-000000000000')
        .send({ name: 'Não existe' })

      expect(res.status).toBe(404)
    })
  })

  describe('DELETE /api/subjects/:id', () => {
    it('remove ementa e retorna 204', async () => {
      const res = await supertest(app.server).delete(`/api/subjects/${subjectId}`)
      expect(res.status).toBe(204)
    })

    it('ementa deletada não é encontrada → 404', async () => {
      const res = await supertest(app.server).get(`/api/subjects/${subjectId}`)
      expect(res.status).toBe(404)
    })
  })
})
