# Fundamentos de UX e usabilidade

Use na **fase 1** (diagnóstico) e **fase 5** (validação). Vocabulário para nomear
problemas com precisão em vez de "ficou estranho".

## Don Norman — *The Design of Everyday Things*

| Conceito | Aplicação no educar-se-ia |
|---|---|
| **Affordances** | Botões, toggles e cards de sessão precisam *parecer* interativos; achatar demais mata affordance. |
| **Signifiers** | Pistas que comunicam affordance (sombra em botão, cursor, sublinhado). Affordance escondida = affordance morta. |
| **Mapping** | Ordene controles espacialmente como o efeito (progresso esquerda→direita; semana→dias→sessões espelha o modelo mental). |
| **Feedback** | Toda ação precisa de resposta imediata — loading ao gerar plano, confirmação ao marcar dia concluído. |
| **Constraints** | Limite opções para evitar erro (`LimitReachedBlock`, desabilitar "avançar" até campos obrigatórios). |

**Regra:** erro é falha de design, não do usuário. Previna com constraints; torne recuperável com mensagens claras.

## As 10 heurísticas de Nielsen

| # | Heurística | Leitura no produto |
|---|---|---|
| 1 | Visibilidade do status | Geração de plano com progresso real, não spinner mudo |
| 2 | Correspondência sistema↔mundo | Linguagem do estudante, pt-BR, metáforas pedagógicas |
| 3 | Controle e liberdade | Desfazer, voltar etapas no wizard |
| 4 | Consistência e padrões | Mesmo componente = mesmo comportamento — isso é o design system |
| 5 | Prevenção de erros | Validação e constraints antes de mensagem de erro |
| 6 | Reconhecer em vez de lembrar | Badges de tipo/Bloom tornam estado reconhecível à primeira vista |
| 7 | Flexibilidade e eficiência | Atalhos para experientes sem atrapalhar novatos |
| 8 | Estética minimalista | Cada elemento extra compete por atenção (ecoa Mayer/Sweller) |
| 9 | Reconhecer e recuperar de erros | Mensagens humanas com causa e saída acionável |
| 10 | Ajuda e documentação | Contextual, disponível quando necessária |

**Fase 1:** percorra as heurísticas na tela atual e nomeie cada violação.
**Fase 5:** rode o mesmo checklist no novo design; explicite trade-offs.

## Steve Krug — *Don't Make Me Think*

- Cada ponto de interrogação na cabeça do usuário é carga cognitiva que afasta.
- Hierarquia visual = importância visual: o que importa mais é maior/mais forte/mais destacado.
- "Satisficing": usuários escolhem a primeira opção razoável, não a ótima — torne a opção certa a mais visível.
- Elimine palavras: corte pela metade, depois corte de novo. Casa diretamente com Mayer (coerência).

## Leis quantitativas

- **Fitts:** alvos importantes maiores e mais perto; CTAs generosos; toque ≥ 44×44px (também WCAG 2.2).
- **Hick-Hyman:** mais opções = mais tempo de decisão. Reduza escolhas por tela; o wizard de 5 passos já faz isso — preserve.
- **Miller (7±2) + chunking:** agrupe informação em blocos. Ligado diretamente à carga cognitiva de Sweller.

## Princípios de Gestalt

| Princípio | Aplicação prática |
|---|---|
| **Proximidade** | Espaçamento *é* semântica — aproxime o que se relaciona, afaste o que não |
| **Similaridade** | Itens parecidos = mesmo tipo (badges consistentes por tipo de sessão) |
| **Continuidade** | O olho segue linhas; alinhe a uma grade |
| **Figura/fundo** | Contraste e elevação separam conteúdo de superfície |
| **Região comum** | Um container (card) une o que está dentro |

Proximidade + similaridade fazem 80% do trabalho de organização — antes de adicionar linhas e caixas, ajuste espaçamento e repetição.

## Fontes
Norman (2013); Nielsen NN/g; Krug (2014); Fitts (1954); Hick/Hyman (1952/53); Miller (1956); Gestalt — síntese NN/g.
