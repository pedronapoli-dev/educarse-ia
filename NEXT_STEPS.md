# Próximos Passos — educar-se-ia

> Estado em: 2026-06-11 | Último commit: `c973705 apply tests missing`

---

## ✅ O que foi feito (não refazer)

- Stripe integrado: 4 produtos/preços, checkout, webhook, mapeamento tier → plano
- Limites por tier: `checkPlansLimit` + `checkAndIncrementApiCall` em `lib/limits.ts` (18 testes passando)
- Degradação graciosa: 402 → `ApiLimitError` → `limitError` em `useAsyncAction` → `LimitReachedBlock`
- ExerciseModal, RecalibrateModal, CheckinCard todos tratando 402 separado de erro genérico
- Página `/planos` com pricing cards e `/planos/sucesso`
- Banner de aviso 80% no dashboard
- Link "Planos" no header da landing
- Migration 004 aplicada no Supabase
- CLAUDE.md atualizado

---

## ✅ Concluído nesta sessão

- **Migration 005**: `increment_api_calls` RPC aplicada (SECURITY DEFINER, EXECUTE restrito a `service_role`); `limits.ts` atualizado para chamar via fire-and-forget em planos `max`
- **Migration 006**: tabela `skill_usage_log` criada (RLS habilitado)
- **Cooldowns**: `lib/cooldowns.ts` (24h checkin / 168h recalibrate, por plan_id ou por usuário) wired em `routes/skills.ts`; 429 + `CooldownResponse` → `ApiCooldownError` → `cooldownError` → `CooldownNotice` (CheckinCard + RecalibrateModal)
- Bug fix: `runRecalibration` não recebia `plan_id` (Phase 2 MCP nunca ativava) — corrigido
- **packages/prompts removido**: pacote deletado, lockfile limpo, referências em CLAUDE.md/AGENTS.md/copilot-instructions.md removidas
- 31/31 testes passando (apps/api), `tsc --noEmit` limpo em apps/api e apps/web

## ✅ Concluído nesta sessão (2)

- **Bug fix crítico**: webhook do Stripe esperava `request.rawBody` (`config: { rawBody: true }`) mas nenhum plugin o populava — `constructEvent` sempre lançava "assinatura inválida" e o webhook nunca funcionava em produção. Corrigido registrando `fastify-raw-body` em `server.ts`. Isso desbloqueia o item 2 abaixo.
- **Testes de integração** (item 4): `routes/__tests__/{plans,exercises,skills,webhook}.test.ts` cobrindo 402/`LimitedResponse`, 429/`CooldownResponse` e o webhook do Stripe (assinatura real via `Stripe.webhooks.generateTestHeaderString`)
- 47/47 testes passando (apps/api), `tsc --noEmit` limpo em apps/api e apps/web
- README.md: tabela de planos atualizada para os 5 tiers (free/básico/pro/max/beta) + `.env` e `.env.example` com todas as `STRIPE_PRICE_ID_*`

## ✅ Concluído nesta sessão (3)

- **Os 4 itens de UI/UX do ciclo anterior** (ver seção "Melhorias de produto"
  abaixo) foram implementados:
  - `apps/web/src/components/DashboardSkeleton.tsx` — skeleton animado (3
    cards de stat + 3 linhas de plano) renderizado em `dashboard/page.tsx`
    enquanto `state === 'loading'`, junto do header real "Meus Planos"
  - Toast de confirmação (`sonner`, configurado em `app/layout.tsx`) em
    `plan/[id]/page.tsx` → `handleComplete`: sucesso = "Sessão concluída! Mais
    um passo na sua jornada.", erro = "Não foi possível registrar a sessão.
    Tente novamente."
  - `apps/web/src/app/not-found.tsx` — 404 customizada (ícone `SearchX`,
    "Página não encontrada", link "Voltar para o início" → `/`)
  - Empty state em `plan/[id]/page.tsx` quando `schedule.length === 0` —
    ícone `CalendarX`, "Nenhuma semana de estudos ainda", link "Voltar para o
    painel" → `/dashboard` (tabs de semana/barra de progresso ficam ocultos)
- **Ambiente de testes criado para `apps/web`** (antes só `apps/api` tinha
  testes): Vitest 4 + React Testing Library + jsdom, `vite-tsconfig-paths`
  resolve `@/*` e `@educarseia/types` direto do source (sem build). Config em
  `apps/web/vitest.config.ts` / `vitest.setup.ts`. Script `"test": "vitest
  run"` em `apps/web/package.json`.
- **`turbo.json`** ganhou task `"test": {}`; raiz tem `"test": "turbo run
  test"`. `packages/config` e `packages/types` ganharam `"test": "echo skip"`
  (mesmo padrão já usado para `type-check`) para o turbo não falhar nesses
  workspaces sem suíte própria.
- **21 testes novos em `apps/web`** cobrindo os 4 itens de UI/UX acima +
  `DashboardSkeleton`, `not-found`, `lib/constants.ts`, `useAsyncAction`,
  `dashboard/page.tsx` (loading/empty/lista/banner 80%) e `plan/[id]/page.tsx`
  (empty schedule, conclusão de sessão com toast de sucesso/erro).
- **Fix**: `vitest.setup.ts` não tinha `afterEach(cleanup)` do RTL — sem
  `globals: true` no Vitest, o cleanup automático não é registrado, e renders
  de testes anteriores ficavam acumulados no DOM (causando falsos negativos
  por elementos duplicados). Agora todo `__tests__/` futuro em `apps/web`
  já herda o cleanup correto.
- `npm run test` na raiz → **68/68 testes passando** (47 `apps/api` + 21
  `apps/web`); `npm run type-check` em `apps/web` limpo.

---

## 🔴 Pendências técnicas (por prioridade)

### 1. ~~Migration 005 — tracking de calls em planos ilimitados~~ ✅ Feito

Planos `max` nunca bloqueiam, mas o contador `api_calls_this_month` não é incrementado.
Precisa de uma stored procedure para incremento atômico (evita race condition).

**Rodar no Supabase SQL Editor:**
```sql
-- Migration 005: incremento atômico de api_calls para planos ilimitados
CREATE OR REPLACE FUNCTION increment_api_calls(user_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.users
  SET api_calls_this_month = api_calls_this_month + 1
  WHERE id = user_id;
$$;
```

**Depois, atualizar `apps/api/src/lib/limits.ts`** — substituir o bloco de planos ilimitados:
```typescript
if (maxApiCallsPerMonth === null) {
  // fire-and-forget: não bloqueia, só registra
  supabase.rpc('increment_api_calls', { user_id: userId }).then(() => {})
  return { allowed: true }
}
```

---

### 2. ~~Testar o fluxo Stripe end-to-end~~ ✅ Feito

Pipeline completo (checkout → assinatura Stripe → webhook → upgrade de tier)
verificado via script novo **`apps/api/scripts/verify-stripe-e2e.mjs`**
(`npm run verify:stripe`, dentro de `apps/api/`). Não roda no `npm run test`
(vitest) — usa Stripe test mode + Supabase reais e cria/limpa um usuário
descartável a cada execução. Útil para revalidar após qualquer mudança de
config do Stripe.

Bugs encontrados e corrigidos no caminho:
- `STRIPE_SECRET_KEY` em `.env` era um placeholder (`sk_test_...`) — usuário
  substituiu pela chave real de test mode.
- `STRIPE_PRICE_ID_BASIC/PRO/MAX/BETA` apontavam para **preços de live mode**
  (a conta de test mode não tinha nenhum produto/preço). Catálogo espelhado
  para test mode (mesmos nomes/descrições/valores) e `.env` atualizado com os
  novos `price_...` de test mode.

Resultado da última execução: `POST /api/checkout` → 200 + url de checkout;
assinatura de teste criada na Basic; `POST /api/webhooks/stripe` → 200
`{received:true}`; `users.plan` virou `'basic'` e `stripe_customer_id` foi
persistido.

- [x] `npm run dev` (web :3000, api :3001)
- [x] Checkout (`/api/checkout`) cria sessão Stripe válida
- [x] Assinatura Stripe (cartão teste) → webhook `checkout.session.completed`
- [x] `users.plan = 'basic'` + `stripe_customer_id` atualizados via webhook
- [ ] Banner de 80% some no dashboard (lógica client-side, não coberta pelo script — `api_calls_this_month / maxApiCallsPerMonth`)
- [ ] Geração de exercícios libera 30 calls/mês no tier basic (coberto por `limits.test.ts`, mas não exercitado via chamada real à IA)

---

### 3. ~~Cooldown de checkin/recalibrate~~ ✅ Feito

Hoje o usuário pode fazer check-in/recalibrar infinitas vezes no mesmo dia.
A intenção (comentada no código) era limitar a 1x por semana.

**Arquivo:** `apps/api/src/routes/skills.ts`

Implementar verificação simples antes de chamar `checkAndIncrementApiCall`:
```typescript
// Verificar última vez que fez checkin para este plan+week
const { data: lastCheckin } = await supabase
  .from('study_sessions') // ou uma tabela dedicada
  .select('created_at')
  .eq('plan_id', planId)
  .eq('type', 'checkin')
  .order('created_at', { ascending: false })
  .limit(1)
  .single()

const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
if (lastCheckin && new Date(lastCheckin.created_at) > oneDayAgo) {
  return reply.status(429).send({ error: 'Já fez check-in hoje. Volte amanhã.' })
}
```

> Nota: pode precisar de coluna `type` na tabela `study_sessions` ou tabela separada `checkins`.

---

### 4. ~~Testes E2E básicos~~ ✅ Feito

`routes/__tests__/{plans,exercises,skills,webhook}.test.ts` cobrem 402/429 e o
webhook Stripe (assinatura real, `Fastify.inject`).

---

### 5. ~~packages/prompts — limpar ou remover~~ ✅ Feito (pacote removido)

---

### 6. ~~`npm run type-check` (raiz) está quebrado~~ ✅ Feito

Descoberto ao verificar a sessão de testes de integração — `tsc --noEmit -p
apps/api/tsconfig.json` e `tsc --noEmit -p apps/web/tsconfig.json` (rodados
diretamente) passavam limpos, mas o script da raiz falhava com 3 erros
independentes (TS6310 em `apps/api` por usar `tsc --build --noEmit` contra
referenced project `composite: true`, e scripts `type-check` ausentes em
`packages/types`/`packages/config`).

**Fix aplicado**: `apps/api/package.json` → `type-check` agora é `tsc --noEmit`
(sem `--build`); `packages/types/package.json` ganhou `"type-check": "tsc
--noEmit"`; `packages/config/package.json` ganhou `"type-check": "echo skip"`
(não tem `.ts` próprio, só presets de tsconfig). `npm run type-check` na raiz
agora passa limpo nos 4 workspaces; 47/47 testes de `apps/api` continuam
passando.

---

## 🟡 Melhorias de produto (próximo ciclo)

### UI/UX
- [x] Loading skeleton no dashboard ✅ Feito (ver "Concluído nesta sessão (3)")
- [x] Toast de confirmação ao completar sessão de estudo ✅ Feito
- [x] Página de erro 404 customizada ✅ Feito
- [x] Empty state melhor no `/plan/[id]` quando não há semanas ✅ Feito

### Funcionalidades
- [ ] Export do plano em PDF (mencionado no roadmap, adiado)
- [ ] Compartilhar plano (link público read-only)
- [ ] Notificações de revisão espaçada (email ou push)
- [ ] Diagnóstico pedagógico acessível da landing (preview sem login)

---

## 🔧 Setup no VS Code / Claude Code

```bash
# Abrir projeto
cd /Users/pedro/Developer/funcionaria/funcionaria

# Rodar tudo
npm run dev

# Checar tipos (todos os workspaces)
npm run type-check

# Rodar testes (apps/api + apps/web via Turbo, 68 testes)
npm run test

# Commitar o que ficou pendente desta sessão
git add -A && git commit -m "feat: testes apps/web + UI/UX (skeleton, toast, 404, empty state)"
```

### Variáveis de ambiente necessárias

| Arquivo | Variável | Onde pegar |
|---|---|---|
| `apps/api/.env` | `STRIPE_PRICE_ID_BASIC` | Dashboard Stripe → Products |
| `apps/api/.env` | `STRIPE_PRICE_ID_PRO` | Dashboard Stripe → Products |
| `apps/api/.env` | `STRIPE_PRICE_ID_MAX` | Dashboard Stripe → Products |
| `apps/api/.env` | `STRIPE_PRICE_ID_BETA` | Dashboard Stripe → Products |
| `apps/api/.env` | `STRIPE_WEBHOOK_SECRET` | Dashboard Stripe → Webhooks |
| `apps/web/.env.local` | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Dashboard Stripe → API Keys |

---

## 📁 Arquivos-chave para orientação rápida

```
.claude/CLAUDE.md                          ← contexto completo do projeto
apps/api/src/lib/limits.ts                 ← lógica de limites por tier
apps/api/src/lib/__tests__/limits.test.ts  ← testes (vitest)
apps/api/src/routes/checkout.ts            ← POST /api/checkout
apps/api/src/routes/webhook.ts             ← Stripe webhook
apps/web/src/app/planos/page.tsx           ← página de pricing
apps/web/src/app/not-found.tsx             ← 404 customizada
apps/web/src/app/dashboard/page.tsx        ← dashboard (loading skeleton, banner 80%)
apps/web/src/app/plan/[id]/page.tsx        ← detalhe do plano (toast, empty state)
apps/web/src/components/DashboardSkeleton.tsx  ← skeleton de loading
apps/web/src/components/LimitReachedBlock.tsx  ← CTA de upgrade
apps/web/src/hooks/useAsyncAction.ts       ← hook com limitError
apps/web/vitest.config.ts                  ← config Vitest + RTL (apps/web)
packages/types/src/index.ts               ← PLAN_LIMITS e todos os tipos
```
