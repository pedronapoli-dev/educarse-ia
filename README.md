# educar-se-ia

> Você estuda. A IA organiza o caminho.

Plataforma de estudo assistido por IA para universitários brasileiros. Transforma ementas acadêmicas em planos de estudo personalizados — com progressão pedagógica real, repetição espaçada e acompanhamento semanal.

A IA não estuda por você. Ela dá o norte. O caminho é seu.

---

## O problema que resolve

Estudantes universitários sobrecarregados — que trabalham, que pegam condução, que têm 1h30 por dia — não sabem por onde começar. A IA generativa virou muleta cognitiva para muitos. O educar-se-ia vai na direção contrária: estrutura o estudo para que o aluno aprenda de verdade, não apenas "siga o fluxo".

---

## Como funciona

1. Faz upload da ementa da disciplina (PDF ou texto)
2. A IA extrai tópicos, pré-requisitos e nível de dificuldade
3. Gera um plano de estudos semana a semana, calibrado ao seu tempo disponível e nível de conhecimento
4. Acompanha progresso, aplica repetição espaçada (SM-2) e recalibra quando você trava

---

## Fundamentos pedagógicos

O plano não é gerado por chute. Cada decisão reflete:

- **Bloom** — progressão de níveis cognitivos por módulo
- **Vygotsky** — Zona de Desenvolvimento Proximal (ZDP) e scaffolding
- **Freire** — autonomia progressiva do aluno
- **Sweller** — controle de carga cognitiva por sessão
- **Ebbinghaus** — repetição espaçada com algoritmo SM-2
- **Piaget** — construtivismo: novo conhecimento ancora no que já existe
- **Darcy Ribeiro** — educação integral, não fragmentada

---

## Stack

```
apps/web/       Next.js 16 · React 18 · Tailwind 3.4 · Supabase Auth
apps/api/       Fastify 5.8 · Zod · JWT · Anthropic SDK (claude-sonnet-4-6)
packages/types/ Tipos compartilhados (@educarseia/types)
```

**Infra:** Vercel (web) · Railway (API) · Supabase (PostgreSQL + Auth + RLS) · Stripe (pagamentos)

---

## Desenvolvimento local

```bash
# Instalar dependências
npm install

# Rodar tudo em paralelo (web :3000, api :3001)
npm run dev

# Build completo (usa tsc --build com project references)
npm run build

# Type-check
npm run type-check
```

### Variáveis de ambiente

**`apps/api/.env`**
```
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
JWT_SECRET=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_ID_BASIC=
STRIPE_PRICE_ID_PRO=
STRIPE_PRICE_ID_MAX=
STRIPE_PRICE_ID_BETA=
FRONTEND_URL=http://localhost:3000
YOUTUBE_API_KEY=   # opcional
PORT=3001
```

**`apps/web/.env.local`**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## Produção

| Serviço | URL |
|---------|-----|
| Frontend | [educarse-ia.com.br](https://educarse-ia.com.br) |
| API | [api.educarse-ia.com.br](https://api.educarse-ia.com.br) |

Ver `DEPLOY.md` para instruções completas.

---

## Planos

| | Free | Básico | Pro | Max | Beta |
|-|------|--------|-----|-----|------|
| Preço | R$ 0 | R$ 19,90/mês | R$ 29,90/mês | R$ 249,90/ano | R$ 14,90/mês* |
| Planos de estudo | 2 | 10 | Ilimitado | Ilimitado | Ilimitado |
| Calls de IA/mês | 10 | 30 | 100 | Ilimitado | 100 |
| Upload de ementa | ✓ | ✓ | ✓ | ✓ | ✓ |
| Repetição espaçada | ✓ | ✓ | ✓ | ✓ | ✓ |
| Exercícios adaptativos | ✓ | ✓ | ✓ | ✓ | ✓ |
| Check-in semanal | ✓ | ✓ | ✓ | ✓ | ✓ |
| Recalibração de plano | ✓ | ✓ | ✓ | ✓ | ✓ |

\* Beta: oferta por tempo limitado (vagas limitadas).

---

## Licença

Proprietário. Todos os direitos reservados.
