import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify'
import { supabase } from '../lib/supabase'
import { getUserId } from '../plugins/auth'
import { checkPlansLimit, getEmentarioSelectionLimit } from '../lib/limits'
import {
  completeEmentarioEntries,
  MAX_OCR_PAGES,
  parseSubjectFromText,
  parseSubjectFromPdf,
  PdfProcessingError,
  saveSubject,
} from '../services/subjectService'
import type { PdfProcessingErrorCode, SubjectParseOutcome } from '../services/subjectService'
import { MAX_EMENTARIO_ENTRY_CHARS, MAX_EMENTARIO_SELECTION } from '@educarseia/types'
import type { ParsedSubject, SubjectSourceType, UserPlan } from '@educarseia/types'

const MANUAL_TEXT_HINT = 'Você pode copiar o texto da ementa e usar a opção "Inserir texto".'

const PDF_ERROR_RESPONSES: Record<PdfProcessingErrorCode, { status: number; error: string; message: string; hint: string }> = {
  PDF_SCANNED: {
    status: 422,
    error: 'Texto não reconhecido no PDF',
    message: 'Não conseguimos reconhecer texto neste PDF, mesmo analisando a imagem das páginas. Tente um arquivo mais nítido ou criado digitalmente.',
    hint: MANUAL_TEXT_HINT,
  },
  PDF_INVALID: {
    status: 422,
    error: 'PDF inválido',
    message: 'Não foi possível abrir este PDF. Ele pode estar corrompido ou protegido por senha.',
    hint: 'Remova a senha ou exporte o arquivo novamente. ' + MANUAL_TEXT_HINT,
  },
  PDF_OCR_TOO_LONG: {
    status: 422,
    error: 'PDF escaneado muito longo',
    message: `Conseguimos ler PDFs escaneados de até ${MAX_OCR_PAGES} páginas. Envie apenas as páginas da disciplina.`,
    hint: MANUAL_TEXT_HINT,
  },
  PDF_OCR_FAILED: {
    status: 503,
    error: 'Leitura de PDF escaneado indisponível',
    message: 'Não conseguimos analisar este PDF escaneado agora. Tente novamente em alguns minutos.',
    hint: MANUAL_TEXT_HINT,
  },
  PDF_EMENTARIO_UNRECOGNIZED: {
    status: 422,
    error: 'Ementário não reconhecido',
    message: 'Encontramos várias ementas neste documento, mas não conseguimos separar as disciplinas. Envie apenas as páginas da disciplina que você quer estudar.',
    hint: MANUAL_TEXT_HINT,
  },
}

const getUserPlanUsage = async (userId: string): Promise<{ plan: UserPlan; plansCount: number }> => {
  const { data } = await supabase.from('users').select('plan, plans_count').eq('id', userId).single()
  return { plan: (data?.plan ?? 'free') as UserPlan, plansCount: data?.plans_count ?? 0 }
}

const sendParseOutcome = async (
  reply: FastifyReply,
  userId: string,
  outcome: SubjectParseOutcome,
  rawText: string,
  sourceType: SubjectSourceType,
) => {
  if (outcome.kind === 'single') {
    const subject = await saveSubject(userId, outcome.subject, rawText, sourceType)
    return reply.status(201).send({ subject })
  }
  const { plan, plansCount } = await getUserPlanUsage(userId)
  return reply.status(200).send({
    isEmentario: true,
    entries: outcome.entries,
    selection_limit: getEmentarioSelectionLimit(plan, plansCount),
  })
}

const sendPdfProcessingError = (request: FastifyRequest, reply: FastifyReply, error: PdfProcessingError) => {
  request.log.warn({ err: error, code: error.code }, 'Subject document could not be processed')
  const { status, ...body } = PDF_ERROR_RESPONSES[error.code]
  return reply.status(status).send({ code: error.code, ...body })
}

export const subjectsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/upload', { preHandler: [fastify.authenticate] }, async (request, reply) => {
    const userId = getUserId(request)
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'Nenhum arquivo enviado' })
    if (data.mimetype !== 'application/pdf') return reply.status(400).send({ error: 'Apenas PDF' })
    const buffer = await data.toBuffer()
    try {
      const outcome = await parseSubjectFromPdf(buffer)
      return await sendParseOutcome(reply, userId, outcome, '', 'pdf')
    } catch (err) {
      if (err instanceof PdfProcessingError) return sendPdfProcessingError(request, reply, err)
      throw err
    }
  })

  fastify.post('/text', {
    preHandler: [fastify.authenticate],
    schema: { body: { type: 'object', required: ['text'], properties: { text: { type: 'string', minLength: 50 } } } },
  }, async (request, reply) => {
    const userId = getUserId(request)
    const { text } = request.body as { text: string }
    try {
      const outcome = await parseSubjectFromText(text)
      return await sendParseOutcome(reply, userId, outcome, text, 'text')
    } catch (err) {
      if (err instanceof PdfProcessingError) return sendPdfProcessingError(request, reply, err)
      throw err
    }
  })

  fastify.post('/ementario/complete', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['entries'],
        properties: {
          entries: {
            type: 'array',
            minItems: 1,
            maxItems: MAX_EMENTARIO_SELECTION,
            items: {
              type: 'object',
              required: ['source_text'],
              properties: {
                source_text: { type: 'string', minLength: 50, maxLength: MAX_EMENTARIO_ENTRY_CHARS },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const userId = getUserId(request)
    const { entries } = request.body as { entries: Array<{ source_text: string }> }
    const { plan, plansCount } = await getUserPlanUsage(userId)
    // Cada disciplina vira um plano: a última escolhida ainda precisa caber no saldo.
    const limitResult = await checkPlansLimit(userId, plan, plansCount + entries.length - 1)
    if (!limitResult.allowed) return reply.status(402).send(limitResult.limited)

    const subjects = await completeEmentarioEntries(entries.map(entry => entry.source_text))
    return { subjects }
  })

  fastify.post('/batch', {
    preHandler: [fastify.authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['subjects'],
        properties: {
          subjects: { type: 'array', minItems: 1, maxItems: MAX_EMENTARIO_SELECTION, items: { type: 'object' } },
        },
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
