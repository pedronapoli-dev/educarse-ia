# Design system e linguagem visual

Use na **fase 3** (tokens) e **fase 4** (componentes).

## 1. Refactoring UI — o núcleo prático (Wathan & Schoger)

- **Hierarquia antes de decoração.** Use peso e cor para hierarquia — não só tamanho de fonte. Texto secundário ≠ fonte menor; muitas vezes é cor mais suave.
- **Conjunto fechado de tamanhos.** 5–7 tamanhos, 2–3 pesos — nunca saia deles.
- **Escala de cinza primeiro.** Force hierarquia por espaçamento/contraste antes de "resolver" com cor.
- **Espaço generoso, depois densifique** onde fizer sentido (tabelas, dashboards).
- **Cor em escalas** (~8–10 passos por matiz), não tons soltos.
- **Sombras coloridas** levemente no tom neutro do produto parecem mais ricas que cinza puro.
- **Personalidade via tipografia, cor e linguagem** — é onde a marca vive.

## 2. Arquitetura de tokens semânticos

Duas camadas — nunca consuma primitivos diretamente na UI:

```
Primitivos  →  blue-500, gray-900...        (paleta crua, implementação)
Semânticos  →  --color-primary, --color-surface, --color-on-surface...  (UI consome estes)
```

Por que importa: trocar tema muda o mapeamento semântico→primitivo em um lugar só.
Nomeie por *função* (`on-primary`), não por *valor* (`white`). Modelo de Material 3 e IBM Carbon.

## 3. Cor — escalas e papéis

**Papéis obrigatórios:**

| Papel | Descrição |
|---|---|
| Primária + on-primary | Ação principal, marca |
| Neutros com temperatura | Levemente alinhados à marca, não cinza puro |
| Superfícies | Fundo de página / card / elevado |
| Semânticas de estado | Sucesso / alerta / erro / info — cada uma com fundo-suave + texto + borda |
| Bordas/divisores | Em opacidades, não cinzas chapados |

**Regras:** construa escalas (50→900, espaço perceptual HSL/OKLCH); nunca dependa só de cor para informação (WCAG 1.4.1 — combine cor + ícone/rótulo); verifique contraste com `scripts/check_contrast.py`.

## 4. Espaçamento — base-4/8

Escala restrita: **4, 8, 12, 16, 24, 32, 48, 64, 96px**.

Elimina o "quase alinhado". Tailwind é base-4 nativo — use a escala nativa.
Espaçamento é Gestalt aplicado: menos espaço *dentro* do grupo, mais *entre* grupos.

## 5. Elevação e sombra

- Luz vem de cima — sombra embaixo, blur e spread suaves (não linha dura).
- Poucos níveis (0/1/2/3/6) mapeados a papéis: card repouso / hover / dropdown / modal.
- O projeto hoje usa só `ring-1 shadow-sm` — chapado. Introduza escala de elevação com sombras sutilmente coloridas no tom neutro do produto.

## 6. Atomic Design (Brad Frost)

**Átomos** (cor, tipo, ícone, input) → **Moléculas** (campo = label+input+erro) → **Organismos** (`DayItem`, `CheckinCard`) → **Templates** → **Páginas**.

Nunca redesenhe página com valores soltos — defina átomos/moléculas e a página se monta a partir deles.

## 7. Material 3 / Apple HIG / IBM Carbon — o que pegar

- **Material 3:** arquitetura de tokens (roles: primary/secondary/container), estados (hover/focus/pressed com state layers). *Não* importe o visual "Google".
- **Apple HIG:** clareza, deferência ao conteúdo, moderação. *Não* importe a estética da Apple.
- **IBM Carbon:** referência de *como documentar* tokens, grid 2x e estados de componente com rigor acessível.

Regra: pegue **estrutura e princípios**, expresse com a marca própria.

## 8. Receita de saída — Tailwind 3.4 + CSS variables

1. **CSS variables semânticas** em `globals.css` (`@layer base :root { ... }`). Nomeie por papel.
2. **`tailwind.config.ts`** mapeando com canais RGB para suportar opacidade:
   ```ts
   colors: { primary: 'rgb(var(--color-primary) / <alpha-value>)' }
   ```
3. **`@layer components`** (`.btn`, `.card`, `.badge-*`) sobre tokens semânticos — estenda o padrão existente.
4. **Tabela de contraste validada** acompanha qualquer entrega de tokens.

Ver `assets/design-tokens-template.css` para o esqueleto.

## Fontes
Wathan & Schoger *Refactoring UI* (2018); Material Design 3 — m3.material.io; Apple HIG — developer.apple.com/design; IBM Carbon — carbondesignsystem.com; Frost *Atomic Design* (2016).
