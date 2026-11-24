# educar-se-ia — Plano de Regressão Manual

> **Versão:** Beta Release · **Data:** 2026-06-16  
> **Objetivo:** Validar manualmente todos os fluxos de integração e parse antes do acesso aos beta users.  
> **Executor:** _______________________ **Ambiente:** _______________________ **Build:** _______________________

---

## Como usar este documento

- Marque cada caso como **✅ PASSOU**, **❌ FALHOU** ou **⚠️ PARCIAL**
- Em caso de falha, anote: comportamento observado + URL + screenshot
- Prioridade: 🔴 Bloqueante · 🟡 Alta · 🟢 Média
- Execute os blocos na ordem — cada bloco pode depender do anterior

---

## Ambientes e contas necessárias

| Recurso | Valor |
|---|---|
| URL Web | `http://localhost:3000` (local) ou URL de preview Vercel |
| URL API | `http://localhost:3001` |
| Supabase local | `supabase start` antes de rodar |
| Conta Stripe test | Usar cartão `4242 4242 4242 4242` · exp. qualquer futura · CVC 123 |
| PDF ementa real | Arquivo digital (não escaneado) para TC-02 e TC-03 |
| PDF ementário | PDF com múltiplas disciplinas para TC-06 |
| PDF escaneado | PDF de imagem/scan sem texto selecionável para TC-07 |
| Conta beta | Tier `beta` configurado manualmente no Supabase `public.users` |

---

## Bloco A — Autenticação & Sessão

### TC-A01 🔴 Signup novo usuário

**Pré-condição:** email nunca cadastrado no sistema

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Acessar `/` | Landing carrega sem erro 500 | |
| 2 | Clicar "Começar grátis" | Navega para `/login` ou `/signup` | |
| 3 | Preencher email + senha forte e enviar | Formulário aceita | |
| 4 | (Se email confirmation ativo) Verificar inbox | Email de confirmação recebido em < 2 min | |
| 5 | Clicar no link de confirmação | Redireciona para `/dashboard` autenticado | |
| 6 | Verificar header | Nome/email do usuário visível ou botão "Sair" presente | |

**Notas:** ___________________________________________________________________

---

### TC-A02 🔴 Login com credenciais válidas

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Acessar `/login` com usuário já confirmado | Formulário exibe campos `#email` e `#password` | |
| 2 | Preencher credenciais corretas e submeter | Redireciona para `/dashboard` em < 3 s | |
| 3 | Recarregar a página (`F5`) | Sessão persiste — não redireciona para `/login` | |
| 4 | Abrir nova aba com `/dashboard` | Ainda autenticado (cookie compartilhado) | |

**Notas:** ___________________________________________________________________

---

### TC-A03 🟡 Login com senha incorreta

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Ir para `/login` | — | |
| 2 | Inserir email válido + senha errada | Mensagem de erro exibida no formulário | |
| 3 | Verificar URL | Permanece em `/login` (sem redirecionamento) | |
| 4 | Verificar console do navegador | Nenhum stack trace exposto ao usuário | |

**Notas:** ___________________________________________________________________

---

### TC-A04 🟡 Logout e proteção de rota

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Logado em `/dashboard`, clicar "Sair" no Navbar | Redireciona para `/login` | |
| 2 | Tentar acessar `/dashboard` pela URL diretamente | Redireciona para `/login` (middleware auth) | |
| 3 | Tentar acessar `/plan/new` diretamente | Redireciona para `/login` | |

**Notas:** ___________________________________________________________________

---

## Bloco B — Upload e Parse de PDF (núcleo de complexidade)

### TC-B01 🔴 Upload de ementa válida (PDF digital)

**Pré-condição:** logado, tier `free`, 0 planos criados, PDF digital de ementa de disciplina única

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Navegar para `/plan/new` | Step "Upload" exibido com dropzone | |
| 2 | Arrastar o PDF para a dropzone | Área muda de estilo (drag active) | |
| 3 | Soltar o arquivo | Spinner "Processando ementa com IA..." aparece | |
| 4 | Aguardar parse (10–30 s) | Avança automaticamente para step "Confirmar" | |
| 5 | Verificar step Confirmar | Nome da disciplina, número de tópicos e carga horária extraídos | |
| 6 | Verificar lista de tópicos | Mínimo 3 tópicos listados, coerentes com a ementa | |
| 7 | Verificar campos de metadados | Campos ausentes marcados com borda âmbar (warning) | |

**Notas:** ___________________________________________________________________

---

### TC-B02 🔴 Upload via clique no dropzone

**Pré-condição:** mesmo que TC-B01

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Em `/plan/new`, clicar na área do dropzone (não arrastar) | Seletor nativo de arquivo abre | |
| 2 | Selecionar um PDF válido | Mesmo fluxo de TC-B01 a partir do passo 3 | |

**Notas:** ___________________________________________________________________

---

### TC-B03 🔴 Confirmação e edição de metadados

**Pré-condição:** step "Confirmar" ativo após TC-B01 ou TC-B02

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Editar campo "Curso" | Campo aceita texto livre | |
| 2 | Editar campo "Instituição" | Campo aceita texto livre | |
| 3 | Editar campo "Créditos" com valor numérico | Campo aceita número; rejeita texto | |
| 4 | Clicar "Tentar outro" | Volta para step Upload; campos zerados | |
| 5 | Fazer upload novamente e clicar "Confirmar" | Avança para step "Perfil"; metadados salvos via PATCH | |
| 6 | Verificar no Supabase (`public.subjects`) | Registro criado com `course`, `university`, `code` preenchidos | |

**Notas:** ___________________________________________________________________

---

### TC-B04 🔴 Parse com IA — qualidade do resultado

**Pré-condição:** step "Confirmar" ativo com ementa real

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Verificar tópicos extraídos vs. PDF original | Tópicos batem com a ementa (tolerância: nomes ligeiramente parafraseados) | |
| 2 | Verificar pré-requisitos (se houver no PDF) | Pré-requisitos listados no parse | |
| 3 | Verificar bibliografia (se houver no PDF) | Pelo menos 1 referência extraída | |
| 4 | Verificar `workload_hours` | Número de horas dentro de ±10% do valor no PDF | |

**Notas:** ___________________________________________________________________

---

### TC-B05 🔴 Upload de arquivo não-PDF

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Tentar arrastar um `.docx` ou `.png` para o dropzone | Dropzone rejeita (não processa) | |
| 2 | Tentar via clique e selecionar arquivo não-PDF | Seletor filtra para `.pdf` apenas | |
| 3 | Verificar que nenhuma requisição é enviada para a API | Nenhum `POST /api/subjects/upload` no Network tab | |

**Notas:** ___________________________________________________________________

---

### TC-B06 🔴 PDF maior que 10 MB

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Tentar upload de PDF > 10 MB | Erro exibido: tamanho excede o limite | |
| 2 | Verificar que nenhuma requisição atinge a API | Erro ocorre no frontend (multipart limit) ou API retorna 413 | |

**Notas:** ___________________________________________________________________

---

### TC-B07 🔴 PDF escaneado (imagem sem texto selecionável)

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Upload de PDF escaneado (fotografia de ementa) | API retorna 422 com `code: PDF_SCANNED` | |
| 2 | Verificar mensagem de erro no step Upload | Mensagem explica que o PDF não contém texto e sugere alternativa | |
| 3 | Verificar dica (hint) abaixo do erro | Exibe texto da propriedade `hint` da resposta | |
| 4 | Verificar que o usuário pode tentar outro arquivo | Dropzone permanece ativo após o erro | |

**Notas:** ___________________________________________________________________

---

### TC-B08 🟡 PDF com texto mínimo / ementa incompleta

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Upload de PDF com pouquíssimo conteúdo (ex: 1 parágrafo) | Parse retorna com campos parcialmente preenchidos | |
| 2 | Step Confirmar | Campos ausentes com indicador âmbar | |
| 3 | Fluxo pode continuar | Usuário consegue completar o wizard manualmente | |

**Notas:** ___________________________________________________________________

---

## Bloco C — Ementário (múltiplas disciplinas)

### TC-C01 🔴 Detecção e seleção de ementário

**Pré-condição:** PDF com 3+ disciplinas (ementário de curso), tier com capacidade para múltiplos planos

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Upload do ementário | Spinner aparece | |
| 2 | Resultado do parse | Step "Selecionar" exibido (não "Confirmar") | |
| 3 | Verificar header do card | "Ementário detectado" + número correto de disciplinas | |
| 4 | Verificar lista | Cada disciplina com nome, código e total de tópicos | |
| 5 | Todas selecionadas por padrão | Checkboxes marcados em todas as disciplinas | |
| 6 | Contador no rodapé | "N de N selecionadas" correto | |

**Notas:** ___________________________________________________________________

---

### TC-C02 🟡 Desselecionar e prosseguir com subconjunto

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Desmarcar 2 disciplinas do ementário | Checkboxes ficam desmarcados; contador atualiza | |
| 2 | Clicar "Continuar (N)" | Avança para step Perfil | |
| 3 | Verificar banner informativo | "Este perfil será aplicado a todas as N disciplinas" | |
| 4 | Completar Perfil e Configurar | Fluxo normal | |
| 5 | Clicar "Gerar N planos com IA" | Spinner de batch aparece com progresso "1/N", "2/N"... | |
| 6 | Resultado | Redireciona para `/dashboard` com N novos planos listados | |

**Notas:** ___________________________________________________________________

---

### TC-C03 🟡 Voltar do step Selecionar

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | No step Selecionar, clicar "Voltar" | Retorna para step Upload; lista de ementário zerada | |
| 2 | Upload de ementa única | Fluxo de disciplina única (step Confirmar) | |

**Notas:** ___________________________________________________________________

---

## Bloco D — Wizard de Criação de Plano (Perfil + Configuração)

### TC-D01 🔴 Configuração de perfil do estudante

**Pré-condição:** step "Perfil" ativo após TC-B03

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Mover slider de conhecimento prévio para 0 | Label muda para "Nunca vi esse assunto" | |
| 2 | Mover slider para 10 | Label muda para "Domino completamente" | |
| 3 | Deixar slider em 5 | Label "Conheço razoavelmente" | |
| 4 | Desmarcar todos os formatos de aprendizado | Botão "Continuar" fica desabilitado | |
| 5 | Selecionar ao menos 1 formato | Botão "Continuar" habilita | |
| 6 | Preencher "Por que você precisa aprender isso?" | Textarea aceita texto | |
| 7 | Clicar "Continuar" | Avança para step "Configurar" | |

**Notas:** ___________________________________________________________________

---

### TC-D02 🔴 Configuração de disponibilidade

**Pré-condição:** step "Configurar" ativo

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Ajustar slider de horas/dia para 1h | Badge exibe "1h" | |
| 2 | Ajustar slider para 0.5h | Badge exibe "0.5h" (30 min) | |
| 3 | Clicar no botão de dias "3" | Seleção muda para 3 dias/semana | |
| 4 | Inserir data de prova futura | Campo aceita a data | |
| 5 | Deixar data de prova vazia | Campo opcional — não bloqueia | |
| 6 | Clicar "Gerar plano com IA" | Avança para step "Gerando" | |

**Notas:** ___________________________________________________________________

---

### TC-D03 🔴 Geração do plano com IA

**Pré-condição:** step "Gerando" ativo após TC-D02

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Verificar spinner e mensagem | "Gerando seu plano..." + "Isso leva cerca de 20–30 segundos" | |
| 2 | Aguardar conclusão (até 60 s) | Sem erro de timeout | |
| 3 | Resultado | Redireciona automaticamente para `/plan/{id}` | |
| 4 | URL gerada | `/plan/{uuid}` válido | |

**Notas:** ___________________________________________________________________

---

## Bloco E — Detalhe do Plano & Sessões de Estudo

### TC-E01 🔴 Estrutura da página de detalhe

**Pré-condição:** plano gerado existente, acessar `/plan/{id}`

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Verificar título da disciplina | Nome da disciplina exibido no header | |
| 2 | Verificar semana atual | "Semana 1" visível; navegação de semanas presente | |
| 3 | Verificar cards de sessão (DayItem) | Ao menos 1 card de sessão na semana 1 | |
| 4 | Verificar badges Bloom | Cada sessão com badge colorido (ex: "Entender" = azul) | |
| 5 | Verificar critério de maestria | Texto do `mastery_criteria` visível no card | |
| 6 | Verificar dica | Texto do `tip` visível | |

**Notas:** ___________________________________________________________________

---

### TC-E02 🔴 Marcar sessão como concluída

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Clicar em "Marcar como concluído" no DayItem | Botão ou estado visual muda (check/concluído) | |
| 2 | Verificar requisição no Network tab | `PATCH /api/plans/{id}/session` enviada com `week` e `day` | |
| 3 | Recarregar a página | Sessão permanece marcada como concluída (persistência) | |
| 4 | Verificar tabela `study_sessions` no Supabase | Registro inserido com `plan_id`, `week`, `day`, `completed_at` | |

**Notas:** ___________________________________________________________________

---

### TC-E03 🟡 Navegação entre semanas

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Clicar no botão "próxima semana" | Semana 2 exibida com seus DayItems | |
| 2 | Verificar títulos e tópicos | Diferentes dos da semana 1 | |
| 3 | Voltar para semana 1 | Semana 1 exibida novamente | |
| 4 | Verificar semana concluída (se TC-E02 feito) | Status de conclusão preservado | |

**Notas:** ___________________________________________________________________

---

### TC-E04 🔴 Geração de exercício (ExerciseModal)

**Pré-condição:** plano gerado, tier com `api_calls` disponível

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Clicar em "Praticar" no DayItem | Modal de exercício abre | |
| 2 | Aguardar geração (até 30 s) | Exercício exibido com enunciado, contexto e nível Bloom | |
| 3 | Verificar nível Bloom | Compatível com o `bloom_level` da sessão | |
| 4 | Verificar opção de dica (scaffolding) | Botão de dica disponível; ao clicar, dica parcial aparece | |
| 5 | Inserir resposta e enviar | Feedback de correto/incorreto exibido com explicação | |
| 6 | Fechar modal | Modal fecha; DayItem permanece normal | |

**Notas:** ___________________________________________________________________

---

### TC-E05 🔴 Check-in semanal (CheckinCard)

**Pré-condição:** plano ativo, sem check-in nas últimas 24 h

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Localizar o CheckinCard no detalhe do plano | Card de check-in exibido | |
| 2 | Preencher o formulário (progresso %, dificuldades) | Campos aceitam input | |
| 3 | Submeter | Spinner aparece; chamada `POST /api/skills/checkin` | |
| 4 | Aguardar resultado (até 30 s) | Card exibe: tendência (trend), ação proposta, rationale | |
| 5 | Verificar `skill_usage_log` no Supabase | Registro de checkin inserido com `created_at` correto | |
| 6 | Tentar fazer check-in novamente imediatamente | `CooldownNotice` exibido com "tente novamente em..." | |

**Notas:** ___________________________________________________________________

---

### TC-E06 🔴 Recalibrar plano (RecalibrateModal)

**Pré-condição:** plano ativo, sem recalibração na última semana (168 h)

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Clicar em "Estou travado" ou botão de recalibração | RecalibrateModal abre | |
| 2 | Selecionar tipo de bloqueio | Opções de block type disponíveis | |
| 3 | Informar tópico problemático | Campo de texto aceita input | |
| 4 | Submeter | Chamada `POST /api/skills/recalibrate` | |
| 5 | Aguardar resultado (até 45 s) | Resultado exibido: diagnóstico, causa raiz, ações sugeridas | |
| 6 | Verificar ações | Pelo menos 1 `RecalibrateActionItem` com tipo, tópico e rationale | |
| 7 | Tentar recalibrar novamente imediatamente | `CooldownNotice` com cooldown de 168 h | |

**Notas:** ___________________________________________________________________

---

## Bloco F — Tiers, Limites e Pagamento

### TC-F01 🔴 Limite de planos (tier free, 2 planos)

**Pré-condição:** usuário tier `free` com 2 planos já criados

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Tentar criar 3º plano (completar wizard até gerar) | Resposta 402 com `LimitedResponse` | |
| 2 | Verificar mensagem na wizard | Erro exibido com menção a limite/upgrade | |
| 3 | Verificar no dashboard | 80% de uso (2/2) exibe banner de aviso com link "/planos" | |

**Notas:** ___________________________________________________________________

---

### TC-F02 🔴 Limite de chamadas de IA (tier free, 10 calls)

**Pré-condição:** usuário tier `free` com `api_calls_this_month = 10`  
*(Ajustar diretamente no Supabase: `UPDATE public.users SET api_calls_this_month = 10 WHERE id = '...'`)*

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Tentar gerar exercício | 402 com `limit_type: 'api_calls'` | |
| 2 | Verificar ExerciseModal | `LimitReachedBlock` exibido com barra de uso (10/10) e "Ver planos" | |
| 3 | Clicar "Ver planos" | Navega para `/planos` | |
| 4 | Tentar fazer check-in | Mesmo 402; `LimitReachedBlock` no CheckinCard | |
| 5 | Tentar recalibrar | Mesmo 402; `LimitReachedBlock` no RecalibrateModal | |

**Notas:** ___________________________________________________________________

---

### TC-F03 🔴 Página /planos — cards e preços

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Acessar `/planos` | 4 cards exibidos: Free, Básico, Pro, Max | |
| 2 | Verificar preços | Básico R$19,90/mês · Pro R$29,90/mês · Max R$249,90/ano | |
| 3 | Verificar destaque | Card "Pro" visualmente destacado (border/shadow) | |
| 4 | Verificar callout Beta | Seção Beta visível com preço especial | |
| 5 | Card Free | Não tem botão de "Assinar" (plano atual ou gratuito) | |

**Notas:** ___________________________________________________________________

---

### TC-F04 🔴 Checkout Stripe — assinar Pro

**Pré-condição:** usuário tier `free`, logado

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Em `/planos`, clicar "Assinar Pro" | Spinner breve; redirect para `checkout.stripe.com` | |
| 2 | Verificar URL | Contém `checkout.stripe.com/pay/...` | |
| 3 | Na página Stripe, preencher `4242 4242 4242 4242` + dados | Formulário aceita | |
| 4 | Confirmar pagamento | Stripe redireciona para `/planos/sucesso` | |
| 5 | Verificar página de sucesso | Mensagem de confirmação + CTA para dashboard | |
| 6 | Aguardar webhook (5–10 s) | Supabase `public.users.plan` atualizado para `pro` | |
| 7 | Recarregar `/dashboard` | Banner de 80% sumiu; tier `pro` refletido | |

**Notas:** ___________________________________________________________________

---

### TC-F05 🟡 Tier beta — sem limites de plano, 100 calls/mês

**Pré-condição:** usuário com `plan = 'beta'` no Supabase

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Criar mais de 2 planos | Nenhum bloqueio (maxPlans = null) | |
| 2 | Realizar 10+ chamadas de IA (exercícios + checkins) | Sem 402 até os 100 calls mensais | |
| 3 | Verificar contador no Supabase | `api_calls_this_month` incrementa a cada chamada | |

**Notas:** ___________________________________________________________________

---

## Bloco G — Qualidade do Output da IA (SkillRouter & Prompts)

### TC-G01 🔴 Plano gerado — estrutura e coerência pedagógica

**Pré-condição:** plano recém-gerado de TC-D03

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Verificar número de semanas | Coerente com carga horária e disponibilidade informadas | |
| 2 | Verificar distribuição Bloom | Semanas iniciais: Lembrar/Entender · Finais: Avaliar/Criar | |
| 3 | Verificar scaffolding | DayItems das primeiras semanas: `scaffolding_level: 'alto'` | |
| 4 | Verificar tópicos do plano vs. ementa | Tópicos da ementa cobertos (sem invenção de tópicos fora da ementa) | |
| 5 | Verificar `mastery_criteria` | Presente e mensurável em cada sessão | |
| 6 | Verificar `tip` | Dica relevante ao tópico (não genérica como "estude bastante") | |

**Notas:** ___________________________________________________________________

---

### TC-G02 🟡 Roteamento por nível do estudante (SkillRouter)

Criar 2 planos com mesma ementa, apenas alterando o `prior_knowledge_level`:

| # | Cenário | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | `prior_knowledge = 0` (nunca viu) | Semana 1 começa com Lembrar/Entender; scaffolding 'alto' | |
| 2 | `prior_knowledge = 9` (quase expert) | Semana 1 já com Aplicar/Analisar; menos sessões básicas | |

**Notas:** ___________________________________________________________________

---

### TC-G03 🟡 Diagnóstico pedagógico

**Pré-condição:** plano ativo com ao menos 1 semana concluída

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Acessar endpoint de diagnóstico (via UI ou direto na API) | Resposta com `DiagnosticResult` | |
| 2 | Verificar `zdp_current` e `zdp_next` | Descrevem progressão coerente com o que foi estudado | |
| 3 | Verificar pré-requisitos mapeados | Lista de pré-requisitos relevante | |
| 4 | Verificar tópicos de risco | Se houver, tópicos que costumam causar dificuldade identificados | |

**Notas:** ___________________________________________________________________

---

## Bloco H — Estabilidade & Casos de Borda

### TC-H01 🟡 Sessão expirada durante uso

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Deixar a aba aberta por 1+ hora (ou limpar cookies manualmente) | — | |
| 2 | Tentar fazer qualquer ação autenticada | Redireciona para `/login` ou exibe erro de autenticação | |
| 3 | Fazer login novamente | Retoma normalmente | |

**Notas:** ___________________________________________________________________

---

### TC-H02 🟡 API offline durante geração de plano

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Parar o servidor API (`Ctrl+C` em `apps/api`) | — | |
| 2 | Tentar gerar um plano (step Configurar → Gerar) | Erro exibido na wizard (não crash/tela branca) | |
| 3 | Verificar mensagem | Mensagem de erro compreensível em português | |
| 4 | Reiniciar a API e tentar novamente | Fluxo normal restaurado | |

**Notas:** ___________________________________________________________________

---

### TC-H03 🟡 Dashboard com múltiplos planos

**Pré-condição:** usuário com 2+ planos criados

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Acessar `/dashboard` | Lista de planos exibida (não empty state) | |
| 2 | Verificar cards | Cada card mostra: título da disciplina, progresso % e status | |
| 3 | Clicar em um plano | Navega para `/plan/{id}` correto | |

**Notas:** ___________________________________________________________________

---

### TC-H04 🟢 Responsividade mobile

| # | Ação | Esperado | ✅/❌ |
|---|---|---|---|
| 1 | Abrir DevTools → modo mobile (375px) | Landing renderiza sem overflow horizontal | |
| 2 | Navegar para `/plan/new` em mobile | Wizard legível; steps visíveis; botões tocáveis | |
| 3 | Abrir detalhe de plano em mobile | DayItems legíveis; botões "Marcar concluído" tocáveis | |

**Notas:** ___________________________________________________________________

---

## Resumo de Execução

| Bloco | Descrição | Total TCs | Passou | Falhou | Parcial |
|---|---|---|---|---|---|
| A | Autenticação | 4 | | | |
| B | Upload & Parse PDF | 8 | | | |
| C | Ementário | 3 | | | |
| D | Wizard Criação | 3 | | | |
| E | Detalhe do Plano | 6 | | | |
| F | Tiers & Pagamento | 5 | | | |
| G | Qualidade da IA | 3 | | | |
| H | Borda & Estabilidade | 4 | | | |
| **Total** | | **36** | | | |

---

## Critério de Go/No-Go para Beta Release

**Go** se:
- Todos os 🔴 Bloqueantes passarem sem exceção
- Nenhum 🟡 Alta abrir um bug de perda de dados ou regressão crítica
- Testes 🟢 Média podem ter pendências documentadas

**No-Go** se:
- Qualquer TC marcado 🔴 falhar
- Dados de usuário perdidos ou corrompidos em qualquer cenário
- Checkout Stripe não completar o ciclo end-to-end

---

## Bugs Encontrados

| ID | TC | Severidade | Descrição | Reprodução | Status |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |

---

*Documento gerado automaticamente — educar-se-ia v0.1.0-beta*
