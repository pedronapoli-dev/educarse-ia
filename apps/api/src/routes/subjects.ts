import { FastifyPluginAsync } from 'fastify'
import { supabase } from '../lib/supabase'
import { getUserId } from '../plugins/auth'
import { parseSubjectFromText, parseSubjectFromPdf, saveSubject, ScannedPdfError } from '../services/subjectService'
import type { ParsedSubject } from '@educarseia/types'

export const subjectsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getUserId(request)
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })
    if (data.mimetype !== 'application/pdf') return reply.status(400).send({ error: 'Apenas PDF' })
    const buffer = await data.toBuffer()
    try {
      const parsed = await parseSubjectFromPdf(buffer)
      if (parsed.length === 1) {
        const subject = await saveSubject(userId, parsed[0], '', 'pdf')
        return reply.status(201).send({ subject })
      }
      return reply.status(200).send({ isEmentario: true, subjects: parsed })
    } catch (err) {
      if (err instanceof ScannedPdfError) {
        return reply.status(422).send({
          code: 'PDF_SCANNED',
          error: 'PDF escaneado não suportado',
          message: 'Este PDF parece ter sido gerado por foto ou scanner e não contém texto que possamos processar. Use um PDF criado digitalmente — a maioria dos sistemas acadêmicos exporta ementas nesse formato.',
          hint: 'Se você só tem o PDF escaneado, copie o texto da ementa manualmente e use a opção "Inserir texto".',
        })
      }
      throw err
    }
  })

  fastify.post('/text', {
    preHandler: [fastify.authenticate],
    schema: { body: { type: 'object', required: ['text'], properties: { text: { type: 'string', minLength: 50 } } } },
  }, async (request, reply) => {
    const userId = getUserId(request)
    const { text } = request.body as { text: string }
    const parsed = await parseSubjectFromText(text)
    if (parsed.length === 1) {
      const subject = await saveSubject(userId, parsed[0], text, 'text')
      return reply.status(201).send({ subject })
    }
    return reply.status(200).send({ isEmentario: true, subjects: parsed })
  })

  fastify.post('/batch', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['subjects'],
        properties: { subjects: { type: 'array', minItems: 1, items: { type: 'object' } } },
      },
    },
  }, async (request, reply) => {
    const userId = getUserId(request)
    const { subjects: parsedSubjects } = request.body as { subjects: ParsedSubject[] }
    const saved = await Promise.all(parsedSubjects.map(p => saveSubject(userId, p, '', 'pdf')))
    return reply.status(201).send({ subjects: saved })
  })

  fastify.get('/', { preHandler: [fastify.authenticate] }, async (request) => {
    const userId = getUserId(request)
    const { data, error } = await supabase.from('subjects')
      .select('id, name, code, workload_hours, credits, topics, created_at')
      .eq('user_id', userId).order('created_at', { ascending: false })
    if (error) throw error
    return { subjects: data }
  })

  fastify.get<{ Params: { id: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getUserId(request)
    const { data, error } = await supabase.from('subjects').select('*')
      .eq('id', request.params.id).eq('user_id', userId).single()
    if (error || !data) return reply.status(404).send({ error: 'Ementa não encontrada' })
    return { subject: data }
  })

  fastify.patch<{ Params: { id: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getUserId(request)
    const body = request.body as Partial<{ name: string; code: string | null; course: string | null; university: string | null; credits: number | null }>
    const allowed: Record<string, unknown> = {}
    for (const key of ['name', 'code', 'course', 'university', 'credits'] as const) {
      if (key in body) allowed[key] = body[key]
    }
    const { data, error } = await supabase.from('subjects')
      .update(allowed).eq('id', request.params.id).eq('user_id', userId).select().single()
    if (error || !data) return reply.status(404).send({ error: 'Ementa não encontrada' })
    return { subject: data }
  })

  fastify.delete<{ Params: { id: string } }>('/:id', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getUserId(request)
    const { error } = await supabase.from('subjects').delete().eq('id', request.params.id).eq('user_id', userId)
    if (error) throw error
    return reply.status(204).send()
  })
}
