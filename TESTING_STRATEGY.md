# Estratégia de Testes — educar-se-ia

> Documento de follow-up criado em 2026-06-16.  
> Objetivo: garantir qualidade e estabilidade para lançamento público + registro no INPI.

---

## 1. Contexto do projeto

**Stack:** Turborepo monorepo — Next.js 16 (web, porta 3000) + Fastify 5.8 (api, porta 3001) + Supabase (PostgreSQL + Auth + RLS) + Stripe (pagamentos) + Anthropic Claude (`claude-sonnet-4-6`).

**Rotas da API:**

| Rota | Método | Protegida | Crítica |
|---|---|---|---|
| `/api/subjects/upload` | POST | ✅ | ✅ |
| `/api/subjects/text` | POST | ✅ | ✅ |
| `/api/subjects/batch` | POST | ✅ | — |
| `/api/subjects/:id` | GET / PATCH / DELETE | ✅ | — |
| `/api/plans` | POST | ✅ | ✅ |
| `/api/plans` | GET | ✅ | — |
| `/api/plans/:id` | GET / DELETE | ✅ | — |
| `/api/plans/:id/session` | PATCH | ✅ | ✅ |
| `/api/exercises/generate` | POST | ✅ | ✅ |
| `/api/exercises` | GET | ✅ | — |
| `/api/exercises/:id/answer` | PATCH | ✅ | — |
| `/api/skills/diagnose` | POST | ✅ | ✅ |
| `/api/skills/checkin` | POST | ✅ | ✅ |
| `/api/skills/recalibrate` | POST | ✅ | ✅ |
| `/api/checkout` | POST | ✅ | ✅ |
| `/api/webhook` | POST (Stripe) | ❌ (assinatura) | ✅ |
| `/api/account` | DELETE | ✅ | — |

**Tiers e limites:**

```
free:  maxPlans: 2,    maxApiCallsPerMonth: 10
basic: maxPlans: 10,   maxApiCallsPerMonth: 30
pro:   maxPlans: null, maxApiCallsPerMonth: 100
max:   maxPlans: null, maxApiCallsPerMonth: null
beta:  maxPlans: null, maxApiCallsPerMonth: 100
```

**Cooldowns de skill:**

```
checkin:     24h por (user_id + plan_id)
recalibrate: 168h (1 semana) por (user_id + plan_id)
```

**Shape de erro padronizado:**

- `402` → `LimitedResponse` (com `upgrade_url` + `usage`)
- `429` → `CooldownResponse` (com `retry_at`)
- `4xx` genérico → `{ error: string }`

---

## 2. Estado atual dos testes

### O que existe

| Arquivo | Tipo | Cobertura |
|---|---|---|
| `lib/__tests__/limits.test.ts` | Unit | `checkPlansLimit` + `checkAndIncrementApiCall` — todos os tiers, reset mensal, warning 80%, fail-open |
| `lib/__tests__/cooldowns.test.ts` | Unit | `checkSkillCooldown` + `recordSkillUsage` — 24h/168h, escopo plan_id/user |
| `lib/__tests__/skillRouter.test.ts` | Unit | `routeSkill` — variantes por nível/urgência/fase/trend |
| `lib/__tests__/anthropic.test.ts` | Unit | `generate` + `generateWithTools` — mockado |
| `lib/__tests__/ementaStructureExtractor.test.ts` | Unit | Parser de ementas — casos reais e edge cases |

**Total: ~1086 linhas, 5 arquivos, zero cobertura de rotas, zero cobertura de frontend.**

### O que está instalado mas não usado

- `supertest@^7.2.2` — para testes de rotas HTTP
- `@types/supertest` — tipagem
- `vitest.config.ts` — já aponta para `.env.test`, timeout 30s

---

## 3. Pirâmide de testes

```
         ┌──────────────────────┐
         │   E2E (Playwright)   │  ← 3 jornadas críticas
         │     lento, frágil    │
         ├──────────────────────┤
         │  Integration Tests   │  ← MAIOR GAP e MAIOR ROI
         │  (Supertest + real   │    todos os routes, auth,
         │   Supabase local)    │    limits, cooldowns, shapes
         ├──────────────────────┤
         │    Unit Tests        │  ← JÁ BOA — não priorizar
         │  (Vitest, mocks)     │    limits, cooldowns,
         │                      │    skillRouter, anthropic
         └──────────────────────┘
```

**Sequência de implementação:**

1. **Fase 1 (Semana 1):** Integration tests de rotas — `plans`, `skills`, `subjects`, `exercises`, `webhook`
2. **Fase 2 (Semana 2):** E2E com Playwright — 3 jornadas críticas
3. **Antes do INPI:** Rodar suíte completa em ambiente de produção (Railway + Vercel), não apenas local

---

## 4. Fase 1 — Integration tests de rotas (Supertest)

### Ambiente de teste

```bash
# Iniciar Supabase local (espelha produção, sem custo)
supabase start

# Aplicar todas as migrations ao DB local
supabase db reset
```

**`.env.test`** (já suportado pelo `vitest.config.ts`):

```env
SUPABASE_URL=http://localhost:54321
SUPABASE_SERVICE_ROLE_KEY=<local service role key>
SUPABASE_ANON_KEY=<local anon key>
ANTHROPIC_API_KEY=sk-test-mock   # nunca chamará a API real (mockado)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_test_...
STRIPE_PRICE_ID_BASIC=price_test_basic
STRIPE_PRICE_ID_PRO=price_test_pro
STRIPE_PRICE_ID_MAX=price_test_max
STRIPE_PRICE_ID_BETA=price_test_beta
FRONTEND_URL=http://localhost:3000
```

### Estrutura de arquivos

```
apps/api/src/routes/__tests__/
├── helpers/
│   ├── buildApp.ts       ← instancia o server Fastify para testes
│   ├── createTestUser.ts ← cria user no Supabase local e gera JWT
│   └── fixtures/
│       └── ementa.txt    ← texto de ementa real para usar nos testes
├── subjects.test.ts
├── plans.test.ts
├── exercises.test.ts
├── skills.test.ts
├── webhook.test.ts
└── account.test.ts
```

### Mock obrigatório: Anthropic

```typescript
// No topo de cada arquivo de teste de rota que usa geração de IA:
vi.mock('../../lib/anthropic', () => ({
  generate: vi.fn().mockResolvedValue({
    weeks: [
      {
        week: 1,
        theme: 'Introdução',
        days: [
          {
            day: 1,
            topic: 'Conceitos básicos',
            type: 'concept',
            estimated_hours: 2,
            bloom_level: 'Compreender',
            mastery_criteria: 'Consegue explicar com palavras próprias',
            tip: 'Leia o capítulo 1',
          },
        ],
      },
    ],
  }),
  generateWithTools: vi.fn().mockResolvedValue({ weeks: [] }),
}))
```

### Mock obrigatório: YouTube

```typescript
vi.mock('../../lib/mcp/resourceTools', () => ({
  searchYoutubeEducation: vi.fn().mockResolvedValue(null),
}))
```

---

### `plans.test.ts` — Cenários prioritários

| # | Cenário | Input | Esperado |
|---|---|---|---|
| 1 | Criar plano com dados válidos | subject válido, tier free | 201 + shape `Plan` |
| 2 | Tier free no limite (plans_count = 2) | qualquer subject | 402 + `LimitedResponse` |
| 3 | Body inválido (sem subject_id) | `{}` | 400 |
| 4 | Sem autenticação | sem header JWT | 401 |
| 5 | JWT expirado | token expirado | 401 |
| 6 | Marcar sessão como completa | week=1, day=1 | 200 + session registrada em `study_sessions` |
| 7 | Marcar sessão de plano de outro usuário | plan_id alheio | 404 (RLS) |
| 8 | Listar planos — retorna só os do usuário | 2 usuários com planos | isolamento por user_id |
| 9 | Deletar plano | plan_id próprio | 204 |
| 10 | Deletar plano de outro usuário | plan_id alheio | 404 |

### `skills.test.ts` — Cenários prioritários

| # | Cenário | Input | Esperado |
|---|---|---|---|
| 1 | Diagnóstico com dados válidos | campos obrigatórios | 200 + `DiagnosticResult` |
| 2 | Checkin primeira vez | plan_id, dados de progresso | 200 + `PlanCheckin` |
| 3 | Checkin segunda vez < 24h | mesmo plan_id | 429 + `CooldownResponse` com `retry_at` |
| 4 | Checkin após 24h | mock do timestamp | 200 (cooldown respeitado) |
| 5 | Recalibrate primeira vez | plan_id, bloco | 200 + `RecalibrateResult` |
| 6 | Recalibrate segunda vez < 168h | mesmo plan_id | 429 + `CooldownResponse` |
| 7 | Qualquer skill com api_calls esgotado (free = 10) | user com 10 calls | 402 + `LimitedResponse` |
| 8 | Warning 80% (free = 8/10 calls) | user com 8 calls | 200 + header/body com warning |
| 9 | Checkin sem plan_id (modo manual) | sem plan_id | 200 (cooldown por user_id) |
| 10 | Diagnóstico sem autenticação | — | 401 |

### `subjects.test.ts` — Cenários prioritários

| # | Cenário | Input | Esperado |
|---|---|---|---|
| 1 | Upload de texto válido (>50 chars) | ementa de fixture | 201 + `Subject` |
| 2 | Upload de texto curto (<50 chars) | texto mínimo | 400 |
| 3 | Upload de PDF digital | buffer PDF | 201 + `Subject` |
| 4 | Upload de PDF escaneado/corrompido | PDF sem texto | 422 + `code: 'PDF_SCANNED'` |
| 5 | Upload de arquivo não-PDF | `.docx` | 400 |
| 6 | GET subject de outro usuário | id alheio | 404 (RLS) |
| 7 | PATCH subject próprio | campos parciais | 200 + dados atualizados |
| 8 | DELETE subject | id próprio | 204 |

### `exercises.test.ts` — Cenários prioritários

| # | Cenário | Input | Esperado |
|---|---|---|---|
| 1 | Gerar exercício com plan_id válido | topic, bloom_level | 201 + `Exercise` |
| 2 | Gerar com api_calls esgotado | user com 10 calls (free) | 402 + `LimitedResponse` |
| 3 | Responder exercício | answer string | 200 + feedback |
| 4 | Responder exercício de outro usuário | exercise_id alheio | 404 |
| 5 | Listar exercícios por plan_id | query param | 200 + array isolado por user |

### `webhook.test.ts` — Cenários prioritários

| # | Cenário | Input | Esperado |
|---|---|---|---|
| 1 | `checkout.session.completed` válido (basic) | evento Stripe assinado | 200 + `plan = 'basic'` na tabela users |
| 2 | `checkout.session.completed` válido (pro) | evento Stripe assinado | 200 + `plan = 'pro'` |
| 3 | Assinatura inválida | header `stripe-signature` adulterado | 400 |
| 4 | Evento duplicado (idempotência) | mesmo evento 2x | 200 + tier não rebaixado |
| 5 | `customer.subscription.deleted` | evento de cancelamento | 200 + `plan = 'free'` |

---

## 5. Fase 2 — E2E com Playwright

### Instalação

```bash
# Na raiz do monorepo ou em apps/web
npm install -D @playwright/test
npx playwright install chromium
```

**`playwright.config.ts`:**

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  use: {
    baseURL: 'http://localhost:3000',
    video: 'on',        // grava todos os testes — útil para evidência INPI
    screenshot: 'only-on-failure',
  },
  webServer: [
    { command: 'npm run dev --workspace=apps/api', port: 3001 },
    { command: 'npm run dev --workspace=apps/web', port: 3000 },
  ],
})
```

### As 3 jornadas E2E obrigatórias

#### Jornada 1 — Onboarding de novo usuário

```
/ → "Começar grátis" → /login → preencher email + senha → signup
→ (se email confirmation ativo) → tela de confirmação
→ /dashboard → empty state visível (nenhum plano)
```

**O que valida:** auth end-to-end, redirecionamento, empty state do dashboard.

#### Jornada 2 — Criação e uso do plano (core value)

```
/dashboard → "Novo plano" → /plan/new
→ Step 1 (Upload): inserir texto da ementa (fixture)
→ Step 2 (Confirmar): verificar dados extraídos, editar se necessário
→ Step 3 (Perfil): selecionar nível de conhecimento + formatos
→ Step 4 (Configurar): 2h/dia, 5 dias/semana, sem data de prova
→ Step 5 (Gerando): aguardar plano gerado
→ /plan/[id]: semanas e sessões visíveis
→ Marcar sessão do Dia 1 como completa
→ F5 (reload): sessão permanece marcada
```

**O que valida:** fluxo wizard completo, integração AI (ou mock), persistência de estado.

#### Jornada 3 — Limite de tier e upgrade

```
Usuário free com 2 planos já criados
→ Tentar criar 3º plano → ver LimitReachedBlock (card de upgrade)
→ Clicar "Ver planos" → /planos
→ Clicar "Assinar Pro" → redirecionado ao Stripe Checkout (test mode)
→ Preencher dados de cartão de teste (4242 4242 4242 4242)
→ /planos/sucesso → badge de tier atualizado no dashboard
```

**O que valida:** enforcement de limite no frontend, fluxo Stripe completo, webhook atualizando tier.

---

## 6. Cenários de edge case adicionais

Estes devem ser cobertos nos integration tests — são os mais prováveis de causar incidentes em produção:

| Cenário | Arquivo | Detalhe |
|---|---|---|
| Reset mensal de `api_calls` | `skills.test.ts` | Usuário com `api_calls_this_month = 10` mas `api_calls_reset_at` no passado → deve permitir |
| `exam_date` passada | `plans.test.ts` | Deve retornar plano com 1 semana mínima, não erro |
| Cooldown sem `plan_id` | `skills.test.ts` | Escopo muda para user_id — testar isolamento entre usuários |
| Anthropic timeout simulado | `plans.test.ts` | `generate` rejeita com timeout → API retorna 503, servidor não quebra |
| PDF com múltiplas ementas | `subjects.test.ts` | Retorna `{ isEmentario: true, subjects: [] }` ao invés de 201 |
| Stripe Price ID desconhecido | `webhook.test.ts` | Evento com price_id não mapeado → ignora silenciosamente, retorna 200 |
| Request acima do rate limit (60/min) | `plans.test.ts` | 61ª request → 429 (rate limit, diferente de cooldown) |

---

## 7. O que mockar vs o que deixar real

| Dependência | Abordagem | Motivo |
|---|---|---|
| **Anthropic** | `vi.mock('../../lib/anthropic')` | Custo + latência (>10s por chamada) |
| **Supabase** | Local via `supabase start` | Real, gratuito, idêntico ao de produção |
| **Stripe webhooks** | `stripe trigger` CLI + `stripe-signature` gerado | Real sem cobrar, Stripe CLI disponível |
| **YouTube Data API** | `vi.mock('../../lib/mcp/resourceTools')` | Quota diária limitada |
| **JWT** | `createTestUser.ts` cria user real no Supabase local + gera token via `@fastify/jwt` | Token real garante que o middleware de auth está funcionando |

---

## 8. Critérios de aceite para lançamento

Antes de abrir ao público, a suíte deve passar com:

- [ ] **100%** dos integration tests de rotas (Supertest)
- [ ] **100%** das 3 jornadas E2E (Playwright)
- [ ] **Zero** regressões nos unit tests existentes
- [ ] Suíte completa rodando em ambiente Railway + Vercel (não apenas local)
- [ ] Playwright gravou vídeos das 3 jornadas (evidência para INPI)
- [ ] CI passando no GitHub Actions com a suíte completa integrada

### Integração ao CI (`ci.yml`)

```yaml
# Adicionar ao workflow existente:
- name: Run integration tests
  run: npm run test --workspace=apps/api
  env:
    SUPABASE_URL: ${{ secrets.SUPABASE_TEST_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_TEST_SERVICE_ROLE_KEY }}
    # ... demais vars de test

- name: Run E2E tests
  run: npx playwright test
  working-directory: apps/web
```

---

## 9. Sequência de implementação

### Semana 1 — Integration tests (Supertest)

**Dia 1-2:** Setup do ambiente
- `helpers/buildApp.ts` + `helpers/createTestUser.ts`
- `.env.test` apontando para Supabase local
- Confirmar que `supabase start` + `supabase db reset` funcionam

**Dia 3-4:** `plans.test.ts` + `skills.test.ts`
- São os mais críticos: cobrem o core value + os limites de monetização
- Incluir todos os cenários de limit/cooldown/shape

**Dia 5:** `subjects.test.ts` + `exercises.test.ts` + `webhook.test.ts`

### Semana 2 — E2E (Playwright)

**Dia 1:** Setup do Playwright + `playwright.config.ts`

**Dia 2-3:** Jornada 2 (criação de plano) — a mais complexa, começar por ela

**Dia 4:** Jornada 1 (onboarding) + Jornada 3 (upgrade)

**Dia 5:** Rodar suíte completa no ambiente de produção, corrigir quaisquer diferenças de ambiente

---

## 10. Referências rápidas

```bash
# Rodar unit tests (existentes)
cd apps/api && npm run test

# Rodar integration tests (após implementar)
cd apps/api && npm run test -- src/routes/__tests__/

# Rodar E2E (após implementar)
cd apps/web && npx playwright test

# Stripe CLI — simular webhook
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted

# Supabase local
supabase start
supabase db reset   # aplica todas as migrations
supabase stop
```

---

*Próxima etapa: implementar `helpers/buildApp.ts`, `helpers/createTestUser.ts` e `plans.test.ts` — os 3 blocos que desbloqueiam toda a Fase 1.*
