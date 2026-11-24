# educar-se-ia — Project Instructions

> Frontend and design system rules live in `apps/web/CLAUDE.md`, loaded when working under `apps/web/`.

## Project

**educar-se-ia** — AI-powered study plan generator that transforms academic syllabi (ementas) into personalized study plans. Turborepo monorepo: Next.js 16 frontend + Fastify 5.8 API + Supabase (PostgreSQL, Auth, RLS) + Stripe payments + Anthropic Claude AI.

**Pedagogical foundation:** Freire (autonomy), Piaget (constructivism), Vygotsky (ZDP/scaffolding), Bloom (taxonomy + mastery learning), Darcy Ribeiro (integral education), Sweller (cognitive load), Ebbinghaus (spaced repetition). These are not decorative — every prompt, schedule field, and UI element reflects them.

**Planned, not built:** PDF export.

## Design Decisions to Preserve

- **SkillRouter:** Always route through routeSkill() — never hardcode prompts in routes.
- **MCP = internal tools:** TypeScript functions exposed via Anthropic tool_use, not external MCP servers.
- **SM-2 is pre-computed:** Injected into prompt context BEFORE generation, not called by Claude during.
- **Phase 1 vs Phase 2:** checkin/recalibrate support manual data (no plan_id) AND MCP-backed (with plan_id).
- **Schedule is denormalized JSONB:** Full plan schedule in plans.schedule. Completions tracked in BOTH study_sessions table AND JSONB.
- **Limit enforcement:** Always use `checkPlansLimit()` / `checkAndIncrementApiCall()` from `lib/limits.ts`. Return 402 with `LimitedResponse` shape. Never hard-block without upgrade URL.
- **Cooldown enforcement:** Always use `checkSkillCooldown()` / `recordSkillUsage()` from `lib/cooldowns.ts` for checkin/recalibrate. Return 429 with `CooldownResponse` shape. Check cooldown BEFORE `checkAndIncrementApiCall`, record usage AFTER a successful skill run.
- **Graceful degradation:** 402 → `ApiLimitError` on frontend → `limitError` in `useAsyncAction` → `LimitReachedBlock` component. 429 cooldown → `ApiCooldownError` → `cooldownError` → `CooldownNotice` component. Generic errors stay in `error` state. Never mix these.
- **NUNCA UTILIZE GAMBIARRAS TÉCNICAS** — Always find root cause, apply structurally correct solution.

## Rules

### TypeScript
- `strict: true`, no `any` — use `unknown` + narrowing
- `import type` for type-only imports
- Shared types in `packages/types/src/index.ts` only — never duplicate
- Frontend: `import type { Plan } from '@/types'`
- Backend: `import type { Plan } from '@educarseia/types'`
- Union types over enums
- Always prefer arrow functions

### Naming
- Files: `kebab-case.ts`
- Components: `PascalCase`
- Functions/vars: `camelCase`
- Types: `PascalCase`, no `I` prefix
- Constants: `UPPER_SNAKE_CASE`
- API routes: `/api/plural-nouns`
- DB tables/columns: `snake_case`

### Supabase
- Frontend: `createBrowserClient` from `@supabase/ssr`
- Backend: `createClient` with `SUPABASE_SERVICE_ROLE_KEY`
- Always filter by `user_id` in backend queries

### Errors
- Return `{ error: string }` consistently
- Proper HTTP codes (201 create, 204 delete, 402 limit)
- Never swallow errors

### Language
- Code: English
- User-facing strings: Portuguese (pt-BR)

## Environment Variables

Full lists: `apps/api/.env.example` and `apps/web/.env.example`. `YOUTUBE_API_KEY` and `NEXT_PUBLIC_DISCORD_INVITE_URL` are optional.

Stripe prices:
```
STRIPE_PRICE_ID_BASIC    # price_1TgcXJLt6PKI7uHGsGd5CMqI — R$19.90/mês
STRIPE_PRICE_ID_PRO      # price_1TgcXKLt6PKI7uHGJsP6kaLS — R$29.90/mês
STRIPE_PRICE_ID_MAX      # price_1TgcXLLt6PKI7uHG5cYbDeo9 — R$249.90/ano
STRIPE_PRICE_ID_BETA     # price_1TgcXMLt6PKI7uHGLO3N1x6B — R$14.90/mês
```

## Deploy Targets
See `DEPLOY.md`.

## CI/CD

- **CI:** `.github/workflows/ci.yaml` runs on every push to `main` and on every
  PR targeting `main` — `type-check`, `lint`, `test`, `build` across all
  workspaces (Node 20, matches API Dockerfile).
- **Workflow:** non-trivial changes go through a feature branch + PR. CI runs
  automatically on the PR, and Vercel auto-generates a preview deployment URL
  for it (project already connected to GitHub) — use that preview for
  browser verification.
  Trivial fixes can still be pushed directly to `main` — CI still runs on push.
- **CD:** unchanged — Vercel (apps/web) and Railway (apps/api) auto-deploy
  from `main` on every push/merge, as documented in DEPLOY.md.
- **Branch protection:** `main` requires the `ci` status check to pass before
  merging (configured in GitHub repo settings, not in code).
