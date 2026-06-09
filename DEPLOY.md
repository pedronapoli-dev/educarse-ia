# Deploy — educar-se-ia

Guia passo a passo para colocar o educar-se-ia em produção.

**Arquitetura:**
- **Web (Next.js):** Vercel → `educarse-ia.com.br`
- **API (Fastify):** Railway → `api.educarse-ia.com.br`
- **DB + Auth:** Supabase (projeto existente)

---

## 1. Supabase — Configurar domínio de produção

No dashboard do Supabase (Authentication → URL Configuration):

1. **Site URL:** `https://educarse-ia.com.br`
2. **Redirect URLs:** adicionar `https://educarse-ia.com.br/**`
3. Se usar OAuth social no futuro, adicionar os redirect URLs aqui também

---

## 2. Vercel — Deploy do frontend

### 2.1 Criar projeto

1. Acesse [vercel.com/new](https://vercel.com/new)
2. Importe o repositório GitHub
3. **Framework Preset:** Next.js (auto-detectado)
4. **Root Directory:** `apps/web`
5. O `vercel.json` já configura os comandos de build

### 2.2 Variáveis de ambiente

No painel do projeto → Settings → Environment Variables:

```
NEXT_PUBLIC_SUPABASE_URL=https://<seu-projeto>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
NEXT_PUBLIC_API_URL=https://api.educarse-ia.com.br
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=<stripe-pk> (opcional por enquanto)
```

### 2.3 Domínio

Settings → Domains → Add `educarse-ia.com.br`

A Vercel vai pedir para criar registros DNS:
- **Tipo A:** `76.76.21.21` (para `educarse-ia.com.br`)
- **Tipo CNAME:** `cname.vercel-dns.com` (para `www.educarse-ia.com.br`, se quiser)

---

## 3. Railway — Deploy da API

### 3.1 Criar conta e projeto

1. Acesse [railway.app](https://railway.app) e crie conta
2. New Project → Deploy from GitHub repo
3. Selecione o repositório

### 3.2 Configurar build

No service settings:
- **Root Directory:** `/` (raiz, porque o Dockerfile precisa do monorepo inteiro)
- **Builder:** Dockerfile
- **Dockerfile Path:** `apps/api/Dockerfile`
- **Start Command:** (deixe vazio, o CMD do Dockerfile cuida)

### 3.3 Variáveis de ambiente

No painel do service → Variables:

```
NODE_ENV=production
PORT=3001
SUPABASE_URL=https://<seu-projeto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
SUPABASE_ANON_KEY=<anon-key>
ANTHROPIC_API_KEY=<sk-ant-...>
JWT_SECRET=<não usado com JWKS, mas manter compatibilidade>
FRONTEND_URL=https://educarse-ia.com.br
STRIPE_SECRET_KEY=<sk_...> (opcional por enquanto)
STRIPE_WEBHOOK_SECRET=<whsec_...> (opcional por enquanto)
STRIPE_PRICE_ID_PRO=<price_...> (opcional por enquanto)
YOUTUBE_API_KEY=<key> (opcional, degrada graciosamente)
```

**Importante:** Railway define a variável `PORT` automaticamente. Se conflitar, remover o `PORT=3001` manual e deixar o Railway gerenciar.

### 3.4 Domínio customizado

Settings → Networking → Custom Domain → `api.educarse-ia.com.br`

Railway vai pedir um registro CNAME. Exemplo:
- **CNAME:** `api.educarse-ia.com.br` → `<seu-service>.up.railway.app`

---

## 4. DNS — Configurar no registrador do domínio

No painel onde registrou `educarse-ia.com.br`, crie os registros:

| Tipo  | Nome  | Valor                          | TTL  |
|-------|-------|--------------------------------|------|
| A     | @     | `76.76.21.21`                  | 3600 |
| CNAME | www   | `cname.vercel-dns.com`         | 3600 |
| CNAME | api   | `<seu-service>.up.railway.app` | 3600 |

Os valores exatos de CNAME serão fornecidos pela Vercel e Railway nos passos anteriores.

---

## 5. Checklist pós-deploy

- [ ] `https://educarse-ia.com.br` carrega a landing page
- [ ] `https://api.educarse-ia.com.br/health` retorna `{"status":"ok"}`
- [ ] Login funciona (Supabase redirect URL correto)
- [ ] Criar plano funciona (API recebe request, Claude responde)
- [ ] CORS permite requests do frontend para a API
- [ ] SSL/HTTPS ativo em ambos os domínios (automático pela Vercel e Railway)

---

## Troubleshooting

**CORS error no browser:** Verificar se `FRONTEND_URL` no Railway é exatamente `https://educarse-ia.com.br` (sem trailing slash).

**Login redireciona para URL errada:** Verificar Site URL e Redirect URLs no Supabase Auth settings.

**Build falha no Vercel:** Verificar se `vercel.json` está em `apps/web/` e que o Root Directory está configurado como `apps/web`.

**Build falha no Railway:** Verificar se o Root Directory é `/` (raiz) e o Dockerfile Path é `apps/api/Dockerfile`.

**API não responde:** Verificar logs no Railway. Conferir se todas as env vars obrigatórias estão definidas (especialmente `SUPABASE_URL` e `ANTHROPIC_API_KEY`).
