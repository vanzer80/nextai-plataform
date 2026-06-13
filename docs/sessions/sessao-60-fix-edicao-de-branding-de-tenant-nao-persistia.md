# Sessão 60 — 30/05/2026 — Fix: edição de branding de tenant não persistia

**Commit:** `a6ce200`

### Causa raiz
A migration `20260530_update_tenant_branding_rpc.sql` existia localmente mas nunca havia sido aplicada ao banco remoto. A RPC `update_tenant_branding` não existia em `pg_proc`. O frontend já havia sido corrigido para chamar a RPC (em commit anterior), mas como ela não existia, a edição falha silenciosamente.

### O que foi aplicado
- RPC `public.update_tenant_branding(uuid, text, text, text)` criada via MCP Supabase
- SECURITY DEFINER com guarda `is_platform_master()`
- `COALESCE(p_logo_url, logo_url)` preserva logo atual quando não há novo upload
- Cache-busting na URL do logo (`?v=Date.now()`) para forçar reload quando o path é reutilizado via upsert

### Armadilha nova documentada (#22)
**Supabase REVOKE:** `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC` não remove grants explícitos por role no `proacl`. O `anon=X/postgres` permanece mesmo após o REVOKE FROM PUBLIC. É obrigatório fazer `REVOKE ... FROM anon` explicitamente.

Verificação: `SELECT proacl FROM pg_proc WHERE proname = 'nome_funcao'`

### Checks finais
- ✅ `prosecdef=true` + `search_path=public`
- ✅ `anon` sem EXECUTE, só `authenticated`
- ✅ Zero novos alertas de segurança
- ✅ `npx tsc --noEmit` EXIT:0
- ✅ `npx vitest run` 117/117
