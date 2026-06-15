# Design System — educar-se-ia — Rastreador de implementação

> Tokens, regras de uso e referência rápida vivem em `.claude/CLAUDE.md`
> (seção "Design System") — fonte canônica, consumida em toda sessão.
> Este documento é o **rastreador de rollout**: o que já foi migrado, o
> que falta, e o "lastro" (justificativa de design) de cada decisão.
>
> Catálogo de componentes (átomos/moléculas/organismos, Atomic Design):
> `COMPONENTS.md`.
>
> Atualizado em: 2026-06-14
>
> Paleta: **Teal-Petróleo × Terracota × Creme**
> Território: rigor acadêmico × calor humano

---

## Índice

1. [Arquivos já migrados](#1-arquivos-já-migrados)
2. [Fase 3 — Fundações restantes](#2-fase-3--fundações-restantes)
3. [Fase 4 — Componentes](#3-fase-4--componentes)
4. [Fase 4 — Telas (ordem de impacto)](#4-fase-4--telas-ordem-de-impacto)
5. [Páginas auxiliares e estados de erro](#4b-páginas-auxiliares-e-estados-de-erro-fora-do-rastreador-original)
6. [Fase 5 — Criação do símbolo de marca (logo)](#5-fase-5--criação-do-símbolo-de-marca-logo)

---

## 1. Arquivos já migrados

### ✅ Arquivos de identidade corrigidos

| Arquivo | Antes | Depois |
|---------|-------|--------|
| `apps/web/src/app/layout.tsx` | `bg-gray-50 text-gray-900`, só Inter | Fraunces + Inter via `next/font`, classes do sistema |
| `apps/web/src/app/icon.tsx` | `#4f46e5` (indigo) | `#1A4E5C` (teal-800), "e" tipográfico |
| `apps/web/src/app/opengraph-image.tsx` | `#4f46e5` (indigo), layout vazio | Teal-950 bg, hierarquia 3 camadas, acento terracota |
| `apps/web/src/components/Navbar.tsx` | `bg-indigo-600`, `gray-*` hardcoded | Tokens semânticos, `BrandMark` tipográfico |
| `apps/web/src/components/Footer.tsx` | `bg-white`, `GraduationCap` indigo, `gray-*` | `bg-primary`, `BrandMark` invertido, `on-primary/70` |
| `apps/web/src/app/page.tsx` | Indigo/gray, sem `font-display`, sem tokens | Hero `font-display` + acento terracota, `.card`, `.badge-*`, `bg-primary`/`bg-surface-muted` por seção |

### Novos arquivos de suporte (necessários, não previstos no plano original)

| Arquivo | Motivo |
|---------|--------|
| `apps/web/src/lib/utils.ts` | `cn()` (clsx + tailwind-merge) — `Navbar.tsx` já importava e não existia, quebrava o build |
| `apps/web/src/components/BrandMark.tsx` | Extraído do `Navbar.tsx` para reuso no header da landing e no `Footer.tsx` (`inverted` para fundos escuros) |

### Bugs de contraste corrigidos (auditoria 2026-06-14)

- `--color-text-muted` era `creme-500` (#9B896C, 3.1:1 — ❌ FAIL) → agora `neutral-700` (#4A4A4A, 8.09:1 ✅ AAA)
- `--color-text-subtle` era `creme-400` (#BEAE94, 1.98:1 — ❌ FAIL ALL) → agora `neutral-500` (#5C5C5C, 6.10:1 ✅ AA)

### Bug de tokens corrigido — `tailwind.config.ts` (auditoria 2026-06-14)

`globals.css` define as CSS vars `--color-on-primary-soft`, `--color-on-accent-soft`,
`--color-on-success-soft`/`--color-success-border`, `--color-on-warning-soft`/`--color-warning-border`,
`--color-on-danger-soft`/`--color-danger-border` e `--color-on-info-soft`/`--color-info-border`, mas
`tailwind.config.ts` não as registrava em `theme.extend.colors`. Resultado: classes já usadas em
componentes migrados (`text-on-warning-soft`, `border-danger-border`, etc.) não geravam CSS nenhum —
falha silenciosa, sem erro de build. Corrigido na raiz (não por componente): todas as variantes
`on-*-soft` e `*-border` agora registradas como cores Tailwind.

---

## 2. Fase 3 — Fundações restantes

### ✅ Tipografia de display — aplicação fora da landing

**Status:** Fraunces está carregada, mapeada e aplicada em todos os `h1` de
página migrados na Fase 4 (`/dashboard`, `/plan/[id]`, `/plan/new`, `/planos`,
`/conta`, `/login`, `/termos`, `/privacidade`, `/planos/sucesso`) — a maior
parte do escopo desta fase já foi resolvida organicamente durante a Fase 4.

**Auditoria 2026-06-14 — gaps de consistência corrigidos:**

| Arquivo | Antes | Depois | Motivo |
|---|---|---|---|
| `apps/web/src/app/login/page.tsx` (estado "Confirme seu e-mail") | `text-lg font-bold` | `+ font-display` | Tela-irmã (formulário) já usa `font-display` no h2 — §6 já documentava "3 telas em font-display", faltava aplicar em 2 delas |
| `apps/web/src/app/login/page.tsx` (estado "Verifique seu email") | `text-lg font-bold` | `+ font-display` | idem |
| `apps/web/src/app/auth/reset-password/page.tsx` (estado "Link inválido ou expirado") | `text-lg font-bold` | `+ font-display` | Estado-irmão "Criar nova senha" já usa `font-display` |
| `apps/web/src/app/plan/new/page.tsx` (passo "Gerando seu plano...") | `text-base font-semibold` | `font-display text-xl font-bold` | Momento climático do wizard (Mayer) — paralelo ao empty state "Nenhum plano ainda" do dashboard (`font-display text-2xl`), em escala menor por ser estado transitório |
| `apps/web/src/app/error.tsx`, `global-error.tsx`, `not-found.tsx` (h2 principal) | `text-lg font-semibold` | `+ font-display` | h2 funciona como heading principal da página — mesmo papel que os `h1` já migrados, mantém o sistema coerente mesmo em estados de erro |

**Casos avaliados e mantidos em `font-sans` (lastro: Mayer — uma "voz" de
display por página, repetição dilui o sinal):**

- `/privacidade`, `/termos` — 9–10 `h2` numerados por página (texto legal).
- `/conta` — `h2` "Perfil/Plano/Comunidade/Zona de risco" são labels de
  subseção, mesmo papel que `.form-section`.
- `/planos` — `h2 {plan.name}` nos cards é label repetido por card, não
  heading de seção.
- Landing (`page.tsx`) — `h3` de itens dentro de grid (passos, features); a
  seção já tem `h2` em `font-display`.
- Modais/componentes (`ExerciseModal`, `RecalibrateModal`,
  `DeleteAccountModal`, `CheckinCard`, `LimitReachedBlock`, `CooldownNotice`)
  — UI utilitária recorrente, fora do escopo "hero/section heading".

**Especificação de uso (referência):**

```tsx
// ✅ Hero, títulos de seção, momentos de impacto
<h1 className="font-display font-bold text-4xl tracking-tight text-text">
  Sua ementa vira um plano de estudos.
</h1>

// ✅ Itálico da Fraunces tem muito caráter — use para ênfase em subtítulos
<p className="font-display italic text-xl text-text-muted">
  Baseado em Bloom, Vygotsky e Ebbinghaus.
</p>

// ❌ Não misturar font-display em UI utilitária
<button className="font-display ...">Salvar</button>  // errado
```

**Lastro:** Bringhurst, *The Elements of Typographic Style* — "contraste de famílias só funciona quando há hierarquia clara: a fonte de display serve o impacto, a de texto serve a leitura."

---

## 3. Fase 4 — Componentes

### ✅ `Navbar.tsx` — símbolo de marca aplicado

**Arquivo:** `apps/web/src/components/Navbar.tsx`

`BrandMark` renderiza a espiral de aprendizagem (Fase 5, §5): `<svg>` com
traço `stroke-on-primary` + ponto `fill-terra-500` sobre `bg-primary`.

---

### ✅ `BloomBadge.tsx`

**Arquivo:** `apps/web/src/components/BloomBadge.tsx`

Mapeamento Bloom → badge aplicado conforme `CLAUDE.md`: Lembrar → `badge-gray`, Compreender →
`badge-info`, Aplicar → `badge-primary`, Analisar → `badge-accent`, Avaliar → `badge-amber`, Criar →
`badge-green`. `BloomDistribution` (usado em `/plan/[id]`) segue o mesmo mapeamento.

---

### ✅ `DayItem.tsx`

**Arquivo:** `apps/web/src/components/DayItem.tsx`

`bg-white`/`border-gray-*` → `.card`/`border-border`; `text-gray-*` → `text-text`/`text-text-muted`/
`text-text-subtle`; `bg-gray-*` → `bg-surface-muted`; `indigo-*` → `primary` semântico. Badges de
tipo/prioridade/Bloom via `.badge-*` + `BloomBadge`.

---

### ✅ `CheckinCard.tsx`

**Arquivo:** `apps/web/src/components/CheckinCard.tsx`

Estados de resultado (trend, progress, action rationale) em `.badge-*` semânticos e
`text-success`/`text-warning`/`text-danger`. `LimitReachedBlock` no 402 e `CooldownNotice` no 429
(cooldown) integrados via `useAsyncAction`.

---

### ✅ `ExerciseModal.tsx`

**Arquivo:** `apps/web/src/components/ExerciseModal.tsx`

Overlay `bg-text/50`, modal `bg-surface` com `rounded-t-3xl sm:rounded-lg`. Hierarquia de texto
(exercício, dicas escalonadas, feedback de resposta) em tokens; `LimitReachedBlock` no 402.

---

### ✅ `RecalibrateModal.tsx`

**Arquivo:** `apps/web/src/components/RecalibrateModal.tsx`

Mesmo padrão de modal do `ExerciseModal`. Fluxo "tipo de bloqueio → tópico → resultado" em tokens;
`LimitReachedBlock` no 402 e `CooldownNotice` no 429.

---

### ✅ `LimitReachedBlock.tsx` + `CooldownNotice.tsx`

**Arquivos:**
- `apps/web/src/components/LimitReachedBlock.tsx`
- `apps/web/src/components/CooldownNotice.tsx`

`bg-warning-soft`/`bg-danger-soft` para superfície de alerta, ícones `text-warning`/`text-danger`,
barra de uso em `bg-primary`/`bg-surface-muted`. Componentes compartilhados entre modal e contexto
inline (`context: 'modal' | 'inline'`).

---

### ✅ `Footer.tsx`

**Arquivo:** `apps/web/src/components/Footer.tsx`

Fundo `bg-primary` (teal-800), `text-on-primary`, links em `text-on-primary/70` com hover em `text-on-primary`. `BrandMark` com `inverted` (creme sobre teal) no lugar do `GraduationCap` indigo.

---

## 4. Fase 4 — Telas (ordem de impacto)

### ✅ 1. Landing page `/` — maior alavanca de conversão

**Arquivo:** `apps/web/src/app/page.tsx`

**Estrutura aplicada:**

```
Hero
├── Tag de posicionamento (overline: font-sans uppercase tracking-widest text-accent text-xs)
├── H1 em font-display (bold, 4xl-5xl, text-text, tracking-tight)
├── Subtítulo (font-sans, xl, text-text-muted)
├── CTA pair: [btn-accent "Começar grátis"] + [btn-secondary "Ver planos"]
└── Social proof / badge de beta

Seção: Como funciona (3 passos)
├── Cards numerados com raio lg, sombra sm
├── Número em font-display text-primary
└── Descrição em text-text-muted

Seção: Fundação pedagógica
├── Destaque visual dos 7 teóricos
└── Credibilidade acadêmica — diferencial central

Seção: Benefícios / features
└── Grid de cards com ícone, título, descrição

Seção: Preços (resumo → link para /planos)

CTA final
├── Fundo bg-primary (teal-800)
├── Texto text-on-primary
└── Botão btn-accent
```

**Decisões de design aplicadas:**

1. **Hero:** `font-display` no H1, overline e destaque "em 60 segundos" em `text-accent` (terracota, 5.4:1 sobre `bg-bg` ✅ AA). O CTA principal é `btn-accent` — cria a tensão visual calor × profundidade.

2. **Acentos decorativos do hero:** dois círculos `blur-3xl` (teal-100 + terra-100) repetem o par de cores do `opengraph-image.tsx` — rima visual entre pontos de contato (Müller-Brockmann: consistência sistêmica).

3. **Demo Ementa → Plano:** card "Plano gerado" recebe `border-primary/30 shadow-md` para se destacar por contraste de borda, não por tamanho (Refactoring UI). Badges de tipo de sessão usam `.badge-primary` (teoria), `.badge-accent` (exercício/esforço) e `.badge-amber` (revisão/Ebbinghaus) — mesmo mapeamento do `DayItem`.

4. **Seção pedagógica:** teóricos exibidos como pills `bg-surface-subtle text-primary` (8.59:1 ✅ AAA) — credibilidade acadêmica visível, não escondida (Nielsen heurística 1).

5. **Fundo do CTA final:** `bg-primary` (teal-800) com botão `btn-accent` — a seção se destaca sem virar "bloco colorido qualquer"; o teal já é a cor de marca.

6. **Espaçamento entre seções:** `py-18`/`py-22` em todas as seções de conteúdo (demo, como funciona, features, fundamento, CTA final), substituindo `py-16 sm:py-20` ad hoc.

---

### ✅ 2. Dashboard `/dashboard`

**Arquivo:** `apps/web/src/app/dashboard/page.tsx`

Heading "Meus Planos" em `font-display`. Banner de 80% de uso em `bg-warning-soft`/`border-warning-border`
+ `text-warning`. Cards de plano em `.card`, título `text-text font-semibold`, metadados
`text-text-muted`, barra de progresso `bg-primary` sobre `bg-surface-muted`. `PlanRow` (lista) também
migrado: `hover:bg-surface-muted`, `text-text`/`text-text-subtle`/`text-text-muted`,
`border-border-strong` no chevron.

---

### ✅ 3. Plano `/plan/[id]` — coração do uso recorrente

**Arquivo:** `apps/web/src/app/plan/[id]/page.tsx`

Título do plano em `font-display text-2xl`. Abas de semana em pílulas: semana atual `bg-primary
text-on-primary`, semana concluída `bg-success-soft text-on-success-soft`, demais `text-text-muted`.
Banner de foco da semana em `bg-primary-soft`/`text-on-primary-soft`. `DayItem` × N na lista de
sessões. Ação "Estou travado" em `border-dashed border-warning/30 bg-warning-soft/50 text-warning` →
abre `RecalibrateModal`.

---

### ✅ 4. Wizard `/plan/new` — 5 passos

**Arquivo:** `apps/web/src/app/plan/new/page.tsx`

Indicador de progresso: passo concluído `bg-primary text-on-primary`, passo ativo `ring-2 ring-primary
bg-surface text-primary`, passo futuro `bg-surface-muted text-text-subtle` (conector `bg-primary`/
`bg-border`). Campos de metadados não preenchidos sinalizados com `ring-warning/40 bg-warning-soft`
(sem `!important` — gambiarra removida). Seleções (formatos de estudo, dias/semana) usam `bg-primary
text-on-primary ring-2 ring-primary` quando ativas.

**Lastro:** Nielsen heurística 1 (visibilidade do estado do sistema) — o usuário sabe sempre em qual
passo está e quantos faltam.

---

### ✅ 5. Pricing `/planos`

**Arquivo:** `apps/web/src/app/planos/page.tsx`

Card "Pro" destacado por `ring-accent/30 shadow-md` + badge `.badge-accent` "Mais popular" — contraste
de borda/cor, não tamanho. CTA do card destacado é `btn-accent` (única CTA de conversão da tela);
demais planos pagos em `btn-secondary`. Callout de beta em `bg-primary-soft` com CTA `btn-primary`
(evita dois `btn-accent` na mesma tela). H1 em `font-display`.

**Lastro:** Refactoring UI (Wathan/Schoger) — destaque por contraste de borda/cor, não por tamanho
diferente.

---

### ✅ 6. Login `/login`

**Arquivo:** `apps/web/src/app/login/page.tsx`

Formulário sobre `bg-bg`, card `.card`. `BrandMark` substitui o ícone `GraduationCap` em caixa indigo
(3 telas: signin/signup, confirmação de email, link de redefinição enviado). H2 em `font-display`.
Erros em `bg-danger-soft`/`text-on-danger-soft`. Links de ação em `text-primary
hover:text-primary-hover`.

---

### ✅ 7. Checkout sucesso `/planos/sucesso`

**Arquivo:** `apps/web/src/app/planos/sucesso/page.tsx`

H1 elevado para `font-display` (momento de impacto pós-conversão). Ícone de sucesso em
`bg-success-soft`/`text-success`. CTA `btn-primary` para o dashboard.

---

## 4b. Páginas auxiliares e estados de erro (fora do rastreador original)

Descobertas via auditoria de `grep` por classes `indigo|gray-*` — não estavam no plano original da
Fase 4, mas faziam parte da "experiência completa" e tinham a mesma identidade genérica Tailwind UI.

| Arquivo | Aplicado |
|---------|----------|
| `apps/web/src/app/conta/page.tsx` | `.card` por seção (Perfil, Plano, Comunidade, Zona de risco); `badge-indigo`→`badge-primary`; "Zona de risco" com `ring-1 ring-danger/20` (ring anterior `ring-red-100` não tinha largura — não renderizava); botão "Excluir conta" em `bg-danger-soft`/`text-on-danger-soft`. H1 em `font-display`. |
| `apps/web/src/app/auth/reset-password/page.tsx` | Mesmo padrão do `/login`: `BrandMark` no lugar do `GraduationCap` indigo, cards `.card`, H2 em `font-display`, erro em `bg-danger-soft`. |
| `apps/web/src/app/error.tsx` | `text-gray-900`/`text-gray-500` → `text-text`/`text-text-muted`. |
| `apps/web/src/app/global-error.tsx` | Importa `./globals.css` diretamente (este boundary substitui o root layout — os tokens não chegam via `layout.tsx`). `bg-indigo-600` → `.btn-primary`; `bg-gray-50 text-gray-900` → `bg-bg text-text`. |
| `apps/web/src/app/not-found.tsx` | Ícone `bg-indigo-50`/`text-indigo-600` → `bg-primary-soft`/`text-primary`; texto em tokens. |
| `apps/web/src/app/privacidade/page.tsx`, `apps/web/src/app/termos/page.tsx` | `bg-white` → `bg-bg`; H1 em `font-display`; H2/ênfase/links → `text-text`/`text-text-muted`/`text-text-subtle`. |
| `apps/web/src/components/DeleteAccountModal.tsx` | Mesmo padrão de modal (`bg-text/50` overlay, `bg-surface`); erro em `bg-danger-soft`; botão destrutivo em `bg-danger text-text-on-dark hover:bg-danger/90` (substituiu `bg-red-600 text-white` hardcoded). |

---

## 5. Fase 5 — Criação do símbolo de marca (logo)

### ✅ Espiral de aprendizagem — aplicado

**Estado atual:** símbolo próprio aplicado em `BrandMark.tsx`, `icon.tsx` e
`opengraph-image.tsx` (Fase 6, §5.8) — substitui o "e" tipográfico que
funcionava como placeholder. Path SVG e posição do ponto centralizados em
`apps/web/src/lib/brand-symbol.ts`.

#### 5.1 Conceito

O símbolo precisa comunicar, dentro do território "rigor acadêmico × calor humano":

- **Transformação** — ementa (caos) → plano (estrutura)
- **Método** — progressão, sequência, etapas
- **Calor** — não é frieza corporativa de SaaS genérico
- **Versatilidade técnica** — legível em 32×32 (favicon) e 1200×630 (OG image)

**Lastro:** Mayer, *Multimedia Learning* — um conceito por asset, alto
sinal/ruído. O símbolo não tenta comunicar os 4 atributos ao mesmo tempo;
escolhe transformação + calor como protagonistas (seção 5.2) e deixa
método/versatilidade como consequência da execução (variantes, seção 5.4).

#### 5.2 Decisão de direção

**Escolhido: símbolo abstrato — espiral de aprendizagem.** Traço único em
espiral (curva de Arquimedes, ~2,75 voltas) terminando em um ponto
terracota. A abertura do traço (o "vão" entre início e fim da espiral) foi
posicionada para coincidir com o contador do "e" da Fraunces — comparado
lado a lado durante o processo de design — evocando a inicial de
"educar-se-ia" sem desenhar a letra.

**Lastro:**
- Bruner, *currículo em espiral* — o mesmo conteúdo é revisitado em níveis
  crescentes de profundidade; a espiral é a metáfora visual direta do
  método pedagógico do produto, resolvendo "Método" (§5.1) de forma
  literal, não decorativa.
- Ebbinghaus / SM-2 (já implementado) — o ponto terracota no final do traço
  lê como "próxima revisão" / "próximo passo", reforçando "Transformação"
  sem precisar de uma segunda forma.
- Refactoring UI (Wathan/Schoger) — um traço contínuo + um ponto é a menor
  composição que ainda comunica direção e destino; evita ruído em 32×32.

**Histórico — pivot do brief original:** a primeira versão deste brief
propunha um "monograma refinado" ("e" da Fraunces + detalhe terracota) e
descartava o símbolo abstrato por "exigir validação de mercado antes de
investir em um ícone sem ligação tipográfica com o nome". Na execução, o
monograma refinado se mostrou genérico — um "e" com um ponto não é
"inconfundivelmente educar-se-ia" (critério do agente de design). A espiral
*cita* o "e" via sua abertura (acima) e tem lastro pedagógico próprio —
atende ao critério sem os riscos do monograma genérico.

**Descartada:**
- *Wordmark puro* — não resolve o caso de uso de favicon/ícone de app: "e"
  isolado é legível em 32×32, "educar-se-ia" inteiro não é. A espiral herda
  essa vantagem sem ser um monograma.

#### 5.3 Especificação de construção

- **Geometria:** espiral de Arquimedes (`r = a + b·θ`, `a=2.2`, `b=1.15`,
  ~2,75 voltas), espelhada no eixo horizontal (preserva a "área de assento"
  do traço, inverte a quiralidade). Path final e posição do ponto em
  `apps/web/src/lib/brand-symbol.ts` (`BRAND_SYMBOL_PATH`,
  `BRAND_SYMBOL_DOT`).
- **Grade de construção:** `viewBox="0 0 32 32"` — mesma proporção do
  `BrandMark` (`h-8 w-8`), funciona em containers quadrados (favicon,
  avatar) sem recorte.
- **Traço:** `stroke-width: 2.4`, `stroke-linecap: round`, `fill: none`.
- **Detalhe terracota:** círculo `r=2` no terminal do traço (extremidade
  superior-direita da espiral, ~10-11h) — o "próximo passo" (§5.2).
- **Área de proteção:** ≥ 20% da altura do símbolo livre de outros
  elementos (texto, ícone, borda) — herdado do brief original.

#### 5.4 Variantes necessárias

| Variante | Composição | Quando usar |
|---|---|---|
| Principal | `bg-primary` (teal-800) + traço `stroke-on-primary` (creme-50) + ponto `fill-terra-500` | superfícies claras — header, landing, cards, favicon |
| Invertida | traço/ponto monocromáticos `stroke-primary`/`fill-primary` (teal-800) sobre `bg-on-primary` (creme-50) | fundos escuros (footer, CTA bands) — prop `inverted` do `BrandMark` |
| Reduzida / favicon (32×32) | `<rect rx="7">` teal-800 + traço + ponto, sem padding extra além da área de proteção | `icon.tsx` |

#### 5.5 Do's & don'ts

| ✅ Fazer | ❌ Evitar |
|---|---|
| Manter `viewBox="0 0 32 32"` e a proporção 1:1 do container | Distorcer/esticar o traço ou alterar `stroke-width` por contexto |
| Usar `terra-500` (`fill-terra-500`) para o ponto na variante principal | Usar `accent`/`terra-700` no ponto sobre `bg-primary` — falha de contraste (ver lastro) |
| Aplicar sobre `bg-primary`/`bg-on-primary` (par já validado) | Aplicar sobre fundos fora da paleta de marca ou com contraste não verificado |
| Respeitar a área de proteção mínima | Posicionar texto/ícones dentro da área de proteção |

**Lastro:** WCAG 2.2 AA (`check_contrast.py`) — o par originalmente
especificado para o detalhe (`accent`/`terra-700` `#A8452A` sobre
`bg-primary` teal-800 `#1A4E5C`) resulta em **1,55:1**, falha até o mínimo
de não-texto (3:1). `terra-500` (`#DC805A`, já registrado em
`tailwind.config.ts` com o comentário "ícone terracota, decorativo") resulta
em **3,18:1** — passa. A variante invertida não é afetada: `primary`
(`teal-800`) sobre `on-primary` (`creme-50`) = **9,03:1** (AAA) em ambas as
direções.

#### 5.6 Fluxo de execução

O símbolo foi desenhado diretamente em código, sem Canva: espiral computada
com `python3` (`math.cos`/`math.sin` sobre `r = a + b·θ`), iterando o path
em previews HTML estáticas até convergir no formato/posicionamento
aprovados pelo usuário. O resultado é um path SVG versionável, consistente
com "sem sistema de assets paralelo" (§5.8 / regra "NUNCA UTILIZE
GAMBIARRAS TÉCNICAS" do `CLAUDE.md`).

Para variações futuras (ex.: nova proporção de voltas), ajustar `a`/`b`/
`θ_max` (e o espelhamento, se aplicável) em um script equivalente, gerar
preview HTML, validar com `check_contrast.py` e atualizar
`brand-symbol.ts`.

#### 5.7 Checklist de validação

- [x] Contraste do símbolo ≥ 3:1 contra `bg-primary`/`bg-on-primary`
      (`check_contrast.py`) — traço `creme-50`/`teal-800` = 9,03:1 (AAA);
      ponto `terra-500`/`teal-800` = 3,18:1 (passa não-texto); invertida
      `teal-800`/`creme-50` = 9,03:1 (AAA) para traço e ponto.
- [x] Legível em 32×32 — validado em preview HTML com tile real de 32px; o
      traço de 2,4px permanece contínuo e o ponto terminal visível.
- [x] Funciona em escala de cinza — o ponto se distingue por forma (círculo
      preenchido vs. traço contínuo), não depende da diferença de cor para
      ser percebido como elemento separado.
- [x] Variante invertida (`inverted`) testada sobre `bg-primary` (contexto
      do `Footer`) — tile `bg-on-primary` com traço/ponto `primary`, mesmo
      par 9,03:1 da variante principal (invertido).

#### 5.8 Arquivos atualizados (Fase 6)

- `apps/web/src/lib/brand-symbol.ts` — novo: `BRAND_SYMBOL_PATH` +
  `BRAND_SYMBOL_DOT`, fonte única consumida pelos 3 arquivos abaixo.
- `apps/web/src/components/BrandMark.tsx` — `<span>e</span>` → `<svg>`
  (traço + ponto), variantes principal/invertida via `inverted`.
- `apps/web/src/app/icon.tsx` — favicon 32×32, variante principal (cores em
  hex — `ImageResponse`/satori não processa Tailwind).
- `apps/web/src/app/opengraph-image.tsx` — símbolo adicionado ao bloco
  "educar-se-ia" (canto superior-esquerdo), variante principal.

Projeto não tem `apps/web/public/` — `favicon.ico`/`apple-touch-icon.png`
do brief original não se aplicam; `icon.tsx` já cobre o favicon via
`ImageResponse` (convenção adotada antes desta fase).
