# apps/api — Backend (Fastify)

- Plugin architecture: ecosystem → custom → decorators → hooks → routes
- Routes = HTTP, Services = logic, Lib = infra (SRP)
- Extend via plugins, not modification
- Depend on `@educarseia/types` abstractions
- `fastify-plugin` for shared decorators, scoped plugins for routes
- JSON Schema validation in route options
- `preHandler: [fastify.authenticate]` for protected routes
- Augment types: `declare module 'fastify'` for decorators
