# Test Next Steps

## Status atual

- [x] Infraestrutura de testes de integração (Vitest + Supertest + Supabase local)
- [x] `src/__tests__/helpers/fixtures.ts` — createTestUser / deleteTestUser
- [x] `src/__tests__/helpers/setup.ts` — buildTestApp factory (JWT mockado, DB real)
- [x] `src/__tests__/subjects.test.ts` — 10 testes, todos passando

## Próximos contextos

### 1. `plans.test.ts`

Depende de: usuário + subject (usar `createTestUser` + POST `/api/subjects/text` ou inserir via service role direto).

Rotas a cobrir:
- `POST /api/plans` — mockar chamada AI (`planService.generatePlan`), testar save no DB
- `GET /api/plans` — lista planos do usuário
- `GET /api/plans/:id` — detalhe com join de subjects
- `PATCH /api/plans/:id/session` — marcar dia como completo, verificar que `study_sessions` é inserido e `schedule` JSONB atualizado
- `DELETE /api/plans/:id`

Casos de borda importantes:
- `POST /api/plans` com usuário no tier `free` que já atingiu `maxPlans: 2` → deve retornar 402 com `LimitedResponse`

### 2. `exercises.test.ts`

Depende de: usuário + subject + plan.

Rotas a cobrir:
- `POST /api/exercises/generate` — mockar AI, testar save; verificar 402 ao atingir `maxApiCallsPerMonth`
- `GET /api/exercises?plan_id=` — lista por plano
- `PATCH /api/exercises/:id/answer` — registra resposta do usuário

### 3. `skills.test.ts`

Depende de: usuário + subject + plan com schedule populado (JSONB).

Rotas a cobrir:
- `POST /api/skills/diagnose` — mockar AI, verificar save
- `POST /api/skills/checkin` — mockar AI, verificar 429 na segunda chamada dentro de 24h (cooldown real no DB)
- `POST /api/skills/recalibrate` — mockar AI, verificar 429 dentro de 168h

Atenção: checkin e recalibrate testam o `skill_usage_log` real — não mockar o cooldown, é exatamente o que queremos validar.

### 4. `payments.test.ts`

Mais mock do que integração real (Stripe não tem sandbox local).

- `POST /api/checkout` — mockar `stripe.checkout.sessions.create`, verificar que retorna `{ url }`
- `POST /api/webhook` — enviar payload simulado de `checkout.session.completed`, verificar que `users.plan` é atualizado no DB

## CI — GitHub Actions

Após todos os contextos estarem passando localmente, adicionar ao `.github/workflows/ci.yml`:

```yaml
- name: Start Supabase local
  run: supabase start
  working-directory: .   # raiz do monorepo onde está supabase/

- name: Run tests (unit + integration)
  run: npm run test
  working-directory: apps/api
```

O `supabase start` no CI baixa as imagens Docker e aplica todas as migrations automaticamente (incluindo `20260101000007_grant_permissions.sql`). Não requer secrets — as credenciais locais são hardcoded e conhecidas.

## Fixture helper sugerida

Para evitar repetição nos próximos contextos, adicionar em `helpers/fixtures.ts`:

```typescript
export async function createTestSubject(userId: string): Promise<string>
export async function createTestPlan(userId: string, subjectId: string): Promise<string>
```

Inserir diretamente via service role (sem passar pela rota) para manter o setup rápido e independente das rotas sendo testadas.
