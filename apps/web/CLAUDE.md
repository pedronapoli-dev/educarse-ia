# apps/web — Frontend & Design System

## Frontend (Next.js)
- Server Components by default — `'use client'` only for state/effects/events
- Push `'use client'` as deep as possible
- Use typed API client (`lib/api.ts`) for backend calls
- Use `cn()` helper (clsx + tailwind-merge) for class composition
- No inline styles
- Visual styling: design tokens only — see "Design System" section. No raw hex, no default Tailwind `indigo-*`/`gray-*`.
- **Hooks before guards:** all hooks before any conditional return

## Design System

**Brand:** Teal-Petróleo (`#1A4E5C`) × Terracota (`#A8452A`) × Creme (`#FAF4E8`). Territory: rigor acadêmico × calor humano — the product's pedagogical seriousness expressed visually. Rollout status, per-screen specs, and design rationale ("lastro"): `DESIGN_SYSTEM.md`. Component catalog (atoms/molecules/organisms, Atomic Design): `COMPONENTS.md`.

**Token architecture** — `apps/web/src/app/globals.css` (CSS vars) + `apps/web/tailwind.config.ts` (Tailwind mapping):
- **Primitives** (`--teal-*`, `--terra-*`, `--creme-*`, `--neutral-*`, `--success/warning/danger-*`) — raw scale values, implementation detail
- **Semantics** (`--color-*`, exposed as `bg-primary`, `text-text-muted`, etc.) — **UI consumes semantics only**

**Semantic colors:**

| Token | Use |
|---|---|
| `bg-bg` / `bg-surface` / `bg-surface-muted` / `bg-surface-subtle` | page background / card-modal-input / secondary surface / brand-tinted hint |
| `border-border` / `border-border-strong` / `border-border-focus` / `border-border-input` | default border / emphasized border / focus ring / form field border (3:1 vs. surface) |
| `text-text` / `text-text-muted` / `text-text-subtle` / `text-text-on-dark` | primary (AAA) / secondary (AAA) / caption-placeholder (AA) / text on dark surfaces |
| `bg-primary` / `text-primary` / `bg-primary-soft` / `text-on-primary` | teal — brand, main actions, info badges/chips |
| `bg-accent` / `text-accent` / `bg-accent-soft` / `text-on-accent` / `bg-accent-soft-hover` | terracota — conversion CTAs, warm highlight, hover state for soft surfaces |
| `*-success` / `*-warning` / `*-danger` / `*-info` (+ `-soft`, `-border`, `on-*-soft`) | functional states |

**Typography:**
- `font-sans` (Inter, via `next/font` → `--font-sans`) — all body/UI/labels
- `font-display` (Fraunces, via `next/font` → `--font-display`, weights 300–700 + italic) — hero `h1`, section `h2`s, moments of impact ONLY. Never on buttons, badges, labels, or form UI.
- Modular scale base-16, ratio ≈1.25 — `text-xs` (12px) through `text-7xl` (72px), each with a paired line-height (`tailwind.config.ts`)

**Radius:** `rounded-xs` 4px (badge/chip) · `sm` 6px (input/select) · `md` 8px **default** (button) · `lg` 12px (card/dropdown) · `xl` 16px (modal) · `2xl` 24px (hero container) · `full` (pill/avatar)

**Shadows:** `shadow-xs`→`xl`, tinted with teal rather than pure gray (Refactoring UI — colored shadows read as richer)

**Motion:** `duration-instant/fast/base/slow` (80/150/220/350ms) + `ease-standard/enter/exit`

**Components** (`@layer components` in `globals.css`):
- Buttons: `.btn-primary` (teal — main actions) · `.btn-accent` (terracota — the one conversion CTA per view) · `.btn-secondary` (outline) · `.btn-ghost` (tertiary)
- `.card`, `.badge-{primary,accent,green,amber,red,info,gray}`, `.page-header`, `.form-section`
- `BrandMark` (`@/components/BrandMark`) — brand symbol (learning spiral, see `DESIGN_SYSTEM.md` §5), inline SVG with `stroke`/`fill` via design tokens; `inverted` prop for dark surfaces (footer, CTA bands).

**Bloom level → badge mapping:** Lembrar → `badge-gray` · Compreender → `badge-info` · Aplicar → `badge-primary` · Analisar → `badge-accent` · Avaliar → `badge-amber` · Criar → `badge-green`

### Design System Rules
- **Semantic tokens only** in JSX (`bg-surface`, `text-text-muted`). Primitives (`teal-700`, `terra-100`, `creme-200`...) only for gradients/illustrations/decorative blobs — never raw hex or default Tailwind `indigo-*`/`gray-*`.
- **`font-display`** only on hero/section headings (h1, section h2s). Never on buttons, badges, nav, or form controls.
- **CTA hierarchy:** `btn-accent` = the single highest-priority conversion action per view; `btn-primary` = main app actions; `btn-secondary`/`btn-ghost` = secondary/tertiary.
- **Section rhythm:** `py-18`/`py-22` (72px/88px) for vertical section padding — not ad hoc values.
- **Highlight by contrast, not size** (Refactoring UI) — e.g. `border-primary/30 shadow-md`, never `scale()` or oversized cards.
- Verify any new text/background pairing with `python .claude/skills/agente-designer-senior-edit/scripts/check_contrast.py "#fg" "#bg"` — WCAG 2.2 AA minimum, don't eyeball it.
