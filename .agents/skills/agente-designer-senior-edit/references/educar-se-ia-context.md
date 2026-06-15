# Contexto do educar-se-ia

Use na **fase 1** (diagnóstico) e ao gerar código.

## 1. O produto

Gerador de planos de estudo com IA: o estudante envia ementa (PDF/texto) e recebe
cronograma semanal personalizado com teoria, prática, revisão espaçada (SM-2) e
exercícios adaptativos. Diferencial: **fundamentação pedagógica real** — Freire,
Piaget, Vygotsky, Bloom, Darcy Ribeiro, Sweller, Ebbinghaus.

Tiers: free / basic / pro / max / beta. Lançamento beta é o horizonte imediato.

## 2. Público

Estudantes brasileiros (universitários e vestibulandos), muitos sob pressão de
prazo/prova, lendo conteúdo denso inclusive de exatas. Design deve transmitir:
calma, foco, baixa carga cognitiva, legibilidade alta, confiança/credibilidade,
tom acolhedor (não infantil, não corporativo frio).

## 3. Stack e convenções do repo (restrições de código)

- **Frontend:** Next.js 16 (App Router), React 18, **Tailwind 3.4**, monorepo Turborepo — `apps/web/`
- **Tailwind config:** `apps/web/tailwind.config.ts`
- **Estilos/componentes:** `apps/web/src/app/globals.css` com `@layer base/components`. Já existem `.btn/.btn-primary/.btn-secondary/.btn-ghost`, `.card`, `.badge-*`. **Estenda** — não crie sistema paralelo.
- **Componentes** em `apps/web/src/components/` (PascalCase): `DayItem`, `CheckinCard`, `ExerciseModal`, `RecalibrateModal`, `LimitReachedBlock`, `CooldownNotice`, `BloomBadge`, `Navbar`, `Footer`
- **Código:** TypeScript strict, sem `any`; Server Components por padrão; `'use client'` só com estado/efeito/evento; `cn()` para compor classes; sem inline styles; arrow functions; tipos em `@educarseia/types`
- **Idioma:** código em inglês; strings de usuário em **pt-BR**
- **Ícones:** `lucide-react`
- **Regra do projeto:** NUNCA gambiarra — causa raiz, solução estruturalmente correta

## 4. Auditoria da identidade atual

Estado "Tailwind UI de fábrica" — competente e invisível:

| Elemento | Estado atual | Problema |
|---|---|---|
| Tipografia | Só Inter, tamanhos ad hoc | Sem voz de marca, sem escala documentada |
| Cor | Primária `indigo-600`, neutros `gray-*` | Default mais reconhecível = invisível |
| Forma | `rounded-md/lg/xl` misturados sem regra | Sem sistema de raio |
| Elevação | Só `shadow-sm + ring-1` | Chapado, sem escala |
| Símbolo | `GraduationCap` numa caixa indigo | Genérico — qualquer edtech usa |
| Motion | Só `transition-colors` | Sem sistema |

Diagnóstico: o trabalho não é "consertar bugs visuais" — é **dar um rosto** que só poderia ser do educar-se-ia.

## 5. Atributos de marca (âncoras de decisão)

Território: **rigor acadêmico × calor humano** — nem frio corporativo, nem fofo infantil.

| Atributo | Implicação visual |
|---|---|
| Rigoroso | Método, não palpite — sistema coerente, sem ornamento gratuito |
| Claro | Reduz carga cognitiva — cada coisa no lugar (Sweller/Mayer) |
| Confiável | Credibilidade acadêmica — o estudante aposta o tempo dele aqui |
| Humano/acolhedor | Freire: respeita autonomia; encoraja, não pune |
| Focado | Calmo, sem ruído; ajuda a concentrar sob pressão |

Implicações plausíveis (a fundamentar caso a caso): paleta com acento de marca próprio
sobre neutros calmos e levemente quentes; display com caráter para títulos + sans de alta
legibilidade no corpo; geometria e espaçamento generosos.

## 6. Telas prioritárias para o beta

`/` (landing) → `/dashboard` → `/plan/[id]` → `/plan/new` → `/planos` → `/login`
Marca aplicada: `icon.tsx`, `opengraph-image.tsx`, peças Canva.
