# Design educacional, cognição e acessibilidade

Use na **fase 2** (estratégia de marca) e **fase 5** (validação). O elo design↔pedagogia.

## A ponte

O educar-se-ia já aplica Sweller. Mayer estende Sweller para materiais visuais — é a teoria mais diretamente aplicável a interfaces de aprendizagem. Quando você reduz ruído visual, não está só "deixando limpo": está reduzindo processamento extrínseco que rouba memória de trabalho do estudante. Use isso como argumento de marca: *a interface ensina porque respeita os limites da cognição.*

## Carga cognitiva (Sweller)

| Tipo | O que é | Papel do design |
|---|---|---|
| Intrínseca | Dificuldade inerente do conteúdo | Não elimina, mas sequencia (scaffolding) |
| **Extrínseca** | Imposta por como a info é apresentada | **Eliminar** — layout confuso, ruído, redundância |
| Pertinente | Esforço produtivo de construir esquemas | Liberar memória da extrínseca para sobrar para esta |

Cada elemento de UI que não serve à tarefa compete por memória de trabalho. Minimalismo é pedagógico, não estético.

## 12 princípios de Mayer (resumido)

**Reduzir processamento extrínseco:**

| Princípio | Tradução para UI |
|---|---|
| **Coerência** | Remova palavras, imagens e enfeites que não ensinam. Efeito forte e replicado. |
| **Sinalização** | Destaque estrutura essencial: títulos, ênfase, numeração, cor com função. |
| **Redundância** | Não repita info em canais que competem. Um significante claro basta. |
| **Contiguidade espacial** | Coloque rótulos/explicações *perto* do que descrevem (erro junto do campo). |
| **Contiguidade temporal** | Feedback no momento da ação (confirmação imediata ao concluir um dia). |

**Gerenciar processamento essencial:**

| Princípio | Tradução para UI |
|---|---|
| **Segmentação** | Quebre em pedaços controláveis pelo usuário (wizard de 5 passos, semanas→dias). |
| **Pré-treinamento** | Introduza conceitos antes da tarefa complexa (tooltips, legenda de badges). |
| **Modalidade** | Palavra + imagem em canais distintos quando possível. |

**Fomentar processamento generativo:**

| Princípio | Tradução para UI |
|---|---|
| **Personalização** | Tom conversacional, pt-BR humano. |
| **Voz** | Tom acolhedor (Freire: respeita a autonomia). |
| **Multimídia** | Palavra + imagem ensina mais — mas só se a imagem ensina (ver Coerência). |

**Regra de ouro:** quando Multimídia × Coerência competem, **Coerência ganha**.

## WCAG 2.2 nível AA — tabela de requisitos visuais

| Critério | Requisito | Verificação |
|---|---|---|
| 1.4.3 Contraste texto normal | ≥ 4.5:1 | `scripts/check_contrast.py` |
| 1.4.3 Contraste texto grande (≥24px ou ≥18.66px bold) | ≥ 3:1 | `scripts/check_contrast.py` |
| 1.4.11 Contraste não-texto (UI, ícones, foco) | ≥ 3:1 contra adjacente | Inspeção |
| 1.4.1 Uso de cor | Info nunca *só* por cor — some ícone/rótulo/forma | Inspeção |
| 1.4.4 / 1.4.10 Redimensionar/reflow | Até 200%, layout a 320px sem perda | Teste |
| 2.4.7 / 2.4.11 Foco visível e não obscurecido | `focus-visible:outline` ≥ 3:1 | Inspeção |
| 2.5.8 Tamanho de alvo | ≥ 24×24px (recomendado 44×44) | Medir |
| 3.3 Labels | Todo campo com label associado (`for`/`id`) | Código |

Entregue tabela de contraste dos pares principais em qualquer entrega de tokens.

## Checklist cognitivo-pedagógico (fase 5)

- O que aqui é **carga extrínseca** que dá para remover sem perder função?
- A **sinalização** deixa a estrutura óbvia em 1 segundo de varredura?
- Rótulos/erros/dicas estão **espacialmente contíguos** ao que descrevem?
- O feedback é **temporalmente contíguo** à ação?
- Informação **segmentada** em blocos digeríveis (Miller/7±2)?
- Nenhuma informação depende **só de cor** (WCAG 1.4.1)?
- Todos os pares de texto passam em **contraste AA**?
- Foco visível e alvos de toque adequados?

## Fontes
Sweller (1988; síntese 2011); Mayer *Cognitive Theory of Multimedia Learning* (Cambridge Handbook, cap. 12); W3C WCAG 2.2 AA.
