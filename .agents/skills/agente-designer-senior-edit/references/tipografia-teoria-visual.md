# Tipografia e teoria visual

Use na **fase 3** (fundações). É onde o "só Inter" do estado atual mais denuncia o genérico.

## Escala tipográfica modular (Bringhurst / Tim Brown)

- **Base:** 16px (padrão de legibilidade do navegador).
- **Razão:** 1.25 (terça maior) para produto de estudo — calmo e focado. Razões maiores (1.333, 1.5) para landing/editorial.
- **Gere e arredonde:** base 16, razão ~1.25 → 12 · 14 · 16 · 20 · 25 · 31 · 39px.
- **Line-height pareado:** corpo 1.5–1.65 (leitura densa); títulos 1.1–1.25. No Tailwind: `fontSize: ['1rem', { lineHeight: '1.6' }]`.
- **Medida (linha):** 45–75 chars por linha — use `max-w-prose` em blocos de texto longo (telas de plano e exercício).

## Ellen Lupton — *Thinking with Type*

- Hierarquia via tamanho + peso + cor + espaço — combine eixos, não dependa de um só.
- **Tracking:** títulos grandes → levemente negativo; caixa-alta pequena → positivo.
- Prefira alinhamento à esquerda para corpo (justificado cria "rios" sem hifenização).

## Pareamento de fontes

O problema não é Inter — é *só* Inter sem voz de marca. Uma display distinta nos títulos já cria identidade.

- **Combo certo:** display com personalidade (serifada moderna ou grotesca de caráter) + sans de alta legibilidade (Inter) para corpo/UI.
- **Performance:** fontes variáveis (um arquivo, muitos pesos), `font-display: swap`, fallback de sistema.
- **Público:** estudantes lendo conteúdo denso sob pressão → altura-x generosa, formas abertas, números legíveis.
- PT-BR: garanta cobertura de acentuação completa.

## Müller-Brockmann — *Grid Systems*

- Grade de colunas com calhas consistentes organiza layout responsivo — alinhe tudo a ela.
- Ritmo vertical: espaçamentos relacionados à unidade base (base-4/8).
- A grade serve à legibilidade, não ao ego — estrutura reduz carga cognitiva (casa com Mayer).

## Josef Albers — *Interaction of Color*

A cor é relacional: o mesmo tom parece diferente conforme o vizinho. Avalie cores sempre *em contexto*, nunca isoladas no seletor. Use isso a favor: acento de marca rende mais cercado de neutros calmos.

## Entrega de tipografia

Ao definir o sistema tipográfico, inclua:

| Item | O que especificar |
|---|---|
| Família(s) | Papel (display vs. corpo/UI), estratégia de carregamento |
| Escala completa | Tamanho + line-height + peso + tracking por papel (display, h1–h4, body, body-sm, caption, overline) |
| Medida | `max-w-*` para blocos de leitura longa |
| Tailwind | `theme.extend.fontFamily` + `fontSize` com line-height pareado |

## Fontes
Bringhurst *Elements of Typographic Style*; Brown T. — modularscale.com; Lupton *Thinking with Type* (2ª ed.); Müller-Brockmann *Grid Systems*; Albers *Interaction of Color*.
