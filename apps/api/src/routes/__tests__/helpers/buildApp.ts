/**
 * buildApp — instância Fastify isolada para integration tests.
 *
 * Diferenças em relação ao server.ts de produção:
 *  - JWT: HS256 com JWT_SECRET do .env.test (sem JWKS fetch remoto)
 *  - Rate-limit: 1000 req/min (evita flapping nos testes)
 *  - Logger: desligado (output limpo no terminal de testes)
 */

import Fastify, { type FastifyInstance } from 'fastify'
import cors        from '@fastify/cors'
import multipart   from '@fastify/multipart'
import jwt         from '@fastify/jwt'
import rateLimit   from '@fastify/rate-limit'
import rawBody     from 'fastify-raw-body'

import { authPlugin }      from '../../../plugins/auth'
import { plansRoutes }     from '../../plans'
import { subjectsRoutes }  from '../../subjects'
import { exercisesRoutes } from '../../exercises'
import { webhookRoutes }   from '../../webhook'
import { skillsRoutes }    from '../../skills'
import { checkoutRoutes }  from '../../checkout'
import { accountRoutes }   from '../../account'

/** Mesmo segredo usado em `createTestUser.ts` para assinar tokens HS256. */
export const TEST_JWT_SECRET =
  process.env.JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(cors, {
    origin:      '*',
    credentials: true,
    methods:     ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })

  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

  await app.register(rawBody, {
    field:     'rawBody',
    global:    false,
    encoding:  false,
    runFirst:  true,
  })

  // HS256 simétrico — elimina a dependência de JWKS do Supabase nos testes
  await app.register(jwt, { secret: TEST_JWT_SECRET })

  // Limite alto para não travar testes paralelos
  await app.register(rateLimit, { max: 1000, timeWindow: '1 minute' })

  await app.register(authPlugin)
  await app.register(plansRoutes,     { prefix: '/api/plans' })
  await app.register(subjectsRoutes,  { prefix: '/api/subjects' })
  await app.register(exercisesRoutes, { prefix: '/api/exercises' })
  await app.register(webhookRoutes,   { prefix: '/api/webhooks' })
  await app.register(skillsRoutes,    { prefix: '/api/skills' })
  await app.register(checkoutRoutes,  { prefix: '/api' })
  await app.register(accountRoutes,   { prefix: '/api' })

  app.get('/health', async () => ({ status: 'ok', env: 'test' }))

  await app.ready()
  return app
}
