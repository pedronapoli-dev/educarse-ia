# Componentização — educar-se-ia

> Catálogo vivo de UI organizado por Atomic Design (Brad Frost). Tokens
> canônicos (cor, tipografia, espaçamento, raio, sombra, motion) vivem em
> `.claude/CLAUDE.md` §"Design System" + `apps/web/src/app/globals.css` +
> `apps/web/tailwind.config.ts` — **fonte de verdade**, este documento só
> referencia.
>
> Histórico de migração por tela ("antes → depois" + lastro de cada decisão):
> `DESIGN_SYSTEM.md`.
>
> Atualizado em: 2026-06-15

---

**Lastro de abertura** — Brad Frost, *Atomic Design* (2016): átomos compõem
moléculas, moléculas compõem organismos, organismos compõem templates/páginas.
Documentar a composição (não cada página) evita redecidir hierarquia visual a
cada tela nova e garante que toda UI nova reutilize o mesmo vocabulário visual.

## Índice

1. [Átomos](#1-átomos)
2. [Moléculas](#2-moléculas)
3. [Organismos](#3-organismos)
4. [Templates / Páginas (fora deste catálogo)](#4-templates--páginas-fora-deste-catálogo)

---

## 1. Átomos

Primitivas CSS em `@layer components` (`apps/web/src/app/globals.css`).
**Closed set** — Refactoring UI (Wathan/Schoger): conjunto fechado de
variantes pré-definidas, nunca combinações ad hoc de cor/raio/sombra.

### Botões

| Classe | Composição (tokens) | Estados | Contraste | Uso |
|---|---|---|---|---|
| `.btn` (base) | `inline-flex gap-2 px-4 py-2 text-sm font-semibold`, `radius-md`, transições `motion-fast`/`ease-standard` | `disabled:opacity-50 disabled:cursor-not-allowed` | — | base das 4 variantes abaixo |
| `.btn-primary` | `bg-primary` / `text-on-primary`, `shadow-xs` | hover → `primary-hover` + `shadow-sm` · active → `primary-active` · focus-visible → anel `focus-ring` | 9.03:1 ✅ AAA | ação principal (forms, navegação, app) |
| `.btn-accent` | `bg-accent` / `text-on-accent`, `shadow-xs` | hover → `accent-hover` · active → `accent-active` · focus-visible → anel `accent` | 5.92:1 ✅ AA (texto grande AAA) | **a única CTA de conversão por tela** |
| `.btn-secondary` | `bg-surface` / `text-text`, anel `border-strong` | hover → `surface-muted` + anel `border-focus` · focus-visible → anel `focus-ring` | 17.23:1 ✅ AAA | ação secundária |
| `.btn-ghost` | transparente / `text-text-muted` | hover → `surface-muted` + `text-text` · focus-visible → anel `focus-ring` | 7.27:1 ✅ AAA (hover) | ação terciária |

### Card

| Classe | Composição (tokens) | Estados | Uso |
|---|---|---|---|
| `.card` | `bg-surface`, `border-border`, `shadow-sm`, `radius-lg`, transição `motion-base` | hover → `shadow-md` | container elevado — base de modais, painéis, itens de lista |

### Badges

Mapeamento Bloom → badge (`CLAUDE.md`): Lembrar → `badge-gray` ·
Compreender → `badge-info` · Aplicar → `badge-primary` · Analisar →
`badge-accent` · Avaliar → `badge-amber` · Criar → `badge-green`.

| Classe | Composição (tokens) | Contraste | Uso |
|---|---|---|---|
| `.badge` (base) | `inline-flex gap-x-1 px-2 py-0.5 text-xs font-medium`, `radius-xs`, borda 1px | — | base das variantes abaixo |
| `.badge-gray` | `surface-muted` / `text-muted`, borda `border` | 7.27:1 ✅ AAA | neutro — Bloom "Lembrar" |
| `.badge-primary` (alias `.badge-indigo`) | `primary-soft` / `on-primary-soft`, borda `teal-200` | 7.80:1 ✅ AAA | marca/info — Bloom "Aplicar" |
| `.badge-accent` | `accent-soft` / `on-accent-soft`, borda `terra-200` | 7.94:1 ✅ AAA | destaque terracota — Bloom "Analisar" |
| `.badge-green` | `success-soft` / `on-success-soft`, borda `success-border` | 6.10:1 ✅ AA | sucesso — Bloom "Criar" |
| `.badge-amber` | `warning-soft` / `on-warning-soft`, borda `warning-border` | 7.17:1 ✅ AAA | alerta — Bloom "Avaliar" |
| `.badge-red` | `danger-soft` / `on-danger-soft`, borda `danger-border` | 8.49:1 ✅ AAA | erro/destrutivo |
| `.badge-info` (alias `.badge-purple`) | `info-soft` / `on-info-soft`, borda `info-border` | 8.59:1 ✅ AAA | informativo — Bloom "Compreender" |

### Layout helpers

| Classe | Composição | Uso |
|---|---|---|
| `.page-header` | `pb-5 mb-8 flex flex-wrap items-center justify-between gap-4`, borda inferior `border-border` | título + ações no topo de uma página |
| `.form-section` | `pb-10 mb-10`, borda inferior `border-border` (removida na última seção) | agrupamento de campos de formulário com divisor |

---

## 2. Moléculas

Pequenas composições de átomos + lógica de variante. Cada uma reaparece em
múltiplos organismos/telas — qualquer alteração aqui se propaga.

| Componente | Arquivo | Composição | Variantes / Props | Onde é usado |
|---|---|---|---|---|
| `BrandMark` | `apps/web/src/components/BrandMark.tsx` | Espiral de aprendizagem (SVG inline) sobre `bg-primary`/`bg-on-primary` (ou inverso), `radius-md` | `inverted?: boolean`, `className?: string` | `Navbar`, `Footer` (inverted), `/`, `/login`, `/auth/reset-password` |
| `BloomBadge` + `BloomDistribution` | `apps/web/src/components/BloomBadge.tsx` | `BloomBadge` → `.badge-*` (mapeamento Bloom→cor); `BloomDistribution` → barra segmentada com primitivos `teal-*`/`terra-*`/`warning`/`success` (gradiente decorativo — uso de primitivos permitido para ilustração, CLAUDE.md) | `level: BloomLevel \| undefined` · `days: Array<{ bloom_level?, completed? }>` | `DayItem`, `ExerciseModal`; `BloomDistribution` em `/plan/[id]` |
| `LimitReachedBlock` | `apps/web/src/components/LimitReachedBlock.tsx` | ícone `bg-danger-soft`/`text-danger` (Lucide `Lock`) + barra de uso `bg-surface-muted`/`bg-danger` + CTA `.btn-accent` | `limitError: LimitedResponse` · `context?: 'modal' \| 'inline'` | `ExerciseModal`, `RecalibrateModal` (modal); `CheckinCard` (inline) |
| `CooldownNotice` | `apps/web/src/components/CooldownNotice.tsx` | ícone `bg-info-soft`/`text-info` (Lucide `Clock`) + texto de retry formatado | `cooldownError: CooldownResponse` · `context?: 'modal' \| 'inline'` | `RecalibrateModal` (modal); `CheckinCard` (inline) |
| `DashboardSkeleton` | `apps/web/src/components/DashboardSkeleton.tsx` | `.card` + `bg-surface-muted` + `animate-pulse`, grid responsivo (`aria-hidden`) | sem props | `/dashboard` (estado de loading) |

---

## 3. Organismos

Seções completas que compõem as telas. Documentadas aqui pela composição — o
histórico "antes → depois" de cada migração está em `DESIGN_SYSTEM.md` §4.

| Componente | Arquivo | Papel | Composição | Estados principais | Páginas |
|---|---|---|---|---|---|
| `Navbar` | `apps/web/src/components/Navbar.tsx` | Navegação global fixa | `BrandMark` + `.btn-primary`/`.btn-ghost` + `bg-surface`/`border-border` | oculto em `/` e `/login`; link ativo (`bg-surface-muted`); hover | layout global |
| `Footer` | `apps/web/src/components/Footer.tsx` | Rodapé institucional | `BrandMark` (inverted) + `bg-primary`/`text-on-primary` | hover em links (`text-on-primary/70` → `text-on-primary`) | `/`, `/login`, `/termos`, `/privacidade` |
| `DayItem` | `apps/web/src/components/DayItem.tsx` | Sessão de estudo do dia (item de lista) | `BloomBadge` + `.badge-*` + `.card` (`shadow-xs`) | completo/incompleto; critérios de maestria aberto/fechado; hover (`scale-110`); CTA "Praticar" com ring/hover `accent-soft-hover` (eco de `.badge-accent`) | `/plan/[id]` |
| `CheckinCard` | `apps/web/src/components/CheckinCard.tsx` | Check-in semanal de progresso | `LimitReachedBlock` + `CooldownNotice` + `.card` + `.btn-primary`/`.btn-secondary` | fechado/form/resultado; loading; erro/limite/cooldown; trend (atrasado/no ritmo/adiantado) | `/plan/[id]` |
| `ExerciseModal` | `apps/web/src/components/ExerciseModal.tsx` | Exercícios gerados por IA | `BloomBadge` + `LimitReachedBlock` + overlay `bg-text/50`/`bg-surface` | loading; limite; erro; lista de exercícios; respondido/não; dica aberta/fechada | `/plan/[id]` (via `DayItem`) |
| `RecalibrateModal` | `apps/web/src/components/RecalibrateModal.tsx` | Fluxo "estou travado" → recalibração | `LimitReachedBlock` + `CooldownNotice` + overlay | seleção de bloqueio/tópico; loading; erro/limite/cooldown; resultado (diagnóstico/ações) | `/plan/[id]` |
| `DeleteAccountModal` | `apps/web/src/components/DeleteAccountModal.tsx` | Confirmação destrutiva de exclusão de conta | overlay + `bg-danger`/`bg-danger-soft` | inicial (botão desabilitado até confirmação); loading; erro | `/conta` |

---

## 4. Templates / Páginas (fora deste catálogo)

Por Frost: templates e páginas são **composições** de organismos, não unidades
atômicas — documentá-las aqui duplicaria `DESIGN_SYSTEM.md` §4 ("Telas — ordem
de impacto"), que já registra o "antes → depois" e o lastro de cada tela (`/`,
`/dashboard`, `/plan/[id]`, `/plan/new`, `/planos`, `/login`, etc.).
