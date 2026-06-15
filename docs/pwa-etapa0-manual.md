# PWA Etapa 0 — Passos manuais (Dashboard Supabase)

> Estes passos **não** podem ser feitos por commit de código: dependem de gerar
> segredos e configurar o Dashboard do Supabase. A Etapa 0 entregou tudo o que é
> código (ícones, manifest, sw.js `v8`, trigger de atribuição). Falta apenas
> **ligar o push**, abaixo.
>
> Projeto Supabase: `sksursvmgvxqbbdsztcd` · Edge Function: `push-notification`
> (`supabase/functions/push-notification/index.ts`).

## Estado verificado em 2026-06-14

| Item | Estado |
|---|---|
| Tabela `push_subscriptions` | ✅ existe (0 assinaturas — ninguém assinou ainda) |
| Edge Function `push-notification` | ❌ **não deployada** (só no repo) → **Passo 0** |
| Secrets VAPID (`VAPID_PUBLIC_KEY`/`PRIVATE_KEY`/`SUBJECT`) | ❌ ausentes → **Passo 1** |
| `VITE_VAPID_PUBLIC_KEY` (frontend, lido por `usePushNotification`) | ❌ ausente → **Passo 1** |
| Database Webhook em `INSERT` de `public.notifications` | ❌ não criado → **Passo 2** |
| Trigger in-app na atribuição/status de OS | ✅ ativo (alimenta o webhook quando ele existir) |

---

## Passo 0 — Deploy da Edge Function `push-notification`

A função existe no repo mas nunca foi deployada. Sem ela, o webhook do Passo 2
não tem destino. Deployar **antes** de configurar VAPID é seguro: sem as chaves a
função apenas responde `200 "VAPID not configured"` e não envia nada.

```bash
supabase functions deploy push-notification --project-ref sksursvmgvxqbbdsztcd
```

> `verify_jwt` pode ficar no default (`true`): o Database Webhook (Passo 2) envia
> `Authorization: Bearer <service_role_key>`, que é um JWT válido e passa no gate.
>
> (Posso fazer este deploy via MCP se você preferir — só estava fora dos "2 passos
> de Dashboard" que você reservou para si. É só pedir.)

## Passo 1 — VAPID keys

1. Gerar o par de chaves:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. **Dashboard → Project Settings → Edge Functions → Secrets** (ou
   `supabase secrets set`): adicionar
   ```
   VAPID_PUBLIC_KEY=<chave_pública>
   VAPID_PRIVATE_KEY=<chave_privada>
   VAPID_SUBJECT=mailto:admin@nextai.com.br
   ```
3. Frontend lê a chave pública em `import.meta.env.VITE_VAPID_PUBLIC_KEY`. Adicionar
   `VITE_VAPID_PUBLIC_KEY=<chave_pública>`:
   - ao `.env` local, **e**
   - às Environment Variables do projeto na **Vercel** (produção) → novo build.
4. Redeploy da função para carregar os secrets:
   ```bash
   supabase functions deploy push-notification --project-ref sksursvmgvxqbbdsztcd
   ```

> A chave **pública** vai para o cliente (seguro). A **privada** fica só no secret
> da Edge Function — nunca no `.env` do frontend nem no git.

## Passo 2 — Database Webhook (INSERT em `notifications` → push)

**Dashboard → Database → Webhooks → Create a new hook:**

| Campo | Valor |
|---|---|
| Name | `push-on-notification-insert` |
| Table | `public.notifications` |
| Events | `INSERT` |
| Type | HTTP Request — `POST` |
| URL | `https://sksursvmgvxqbbdsztcd.supabase.co/functions/v1/push-notification` |
| HTTP Headers | `Authorization: Bearer <service_role_key>` · `Content-Type: application/json` |

O webhook envia `{ type, table, record }` — a função lê `record.user_id` e dispara
o Web Push para todas as `push_subscriptions` daquele usuário (limpa as expiradas
com `410 Gone`). O payload do push já usa `/icons/icon-192.png` e
`/icons/badge-72.png` — agora **existentes** (gerados na Etapa 0).

---

## Como testar (após os 3 passos)

1. No app (HTTPS — produção ou `localhost`), aceitar a permissão de notificação →
   cria uma linha em `push_subscriptions`.
2. Disparar um evento que insira em `notifications`:
   - **atribuir uma OS** a outro técnico (trigger `trg_notify_on_os_assignment`), ou
   - aprovar/reprovar/devolver uma OS (trigger `trg_notify_on_os_status`).
3. Esperado: notificação nativa com o ícone NextAI. Conferir logs:
   ```bash
   supabase functions logs push-notification --project-ref sksursvmgvxqbbdsztcd
   ```
   `[push-notification] Sent: N` confirma o envio.
