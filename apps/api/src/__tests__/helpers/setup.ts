import Fastify, { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify'
import multipart from '@fastify/multipart'

// Garante que a augmentação de tipo `FastifyInstance.authenticate` seja reconhecida pelo TS
import type {} from '../../plugins/auth'

export async function buildTestApp(
  userId: string,
  registerRoutes: (app: FastifyInstance) => Promise<void>
): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } })

  // Substitui JWT por um decorator que injeta o userId de teste diretamente
  app.decorate('authenticate', async (request: FastifyRequest, _reply: FastifyReply) => {
    ;(request as unknown as { user: { sub: string } }).user = { sub: userId }
  })

  await registerRoutes(app)
  await app.ready()
  return app
}
