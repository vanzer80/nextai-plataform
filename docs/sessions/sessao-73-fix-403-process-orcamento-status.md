# Sessão 73 — 14/06/2026 — Fix: 403 em process_orcamento_status + console.log

## Commits Realizados
- `a ser gerado` fix(orcamento): 403 em process_orcamento_status — cria migration com função + tabela + GRANT

## O que foi implementado/resolvido

### Bug: HTTP 403 ao "Enviar para aprovação" / "Aprovar" / "Rejeitar" orçamento

**Causa raiz identificada:**  
A função `process_orcamento_status` e a tabela `orcamento_history` foram criadas diretamente no banco em 2026-05-24 (commit `e061801`) sem migration SQL rastreada. Por isso:
1. A função ficou com `EXECUTE TO PUBLIC` (padrão do PostgreSQL ao criar funções) sem o `REVOKE FROM PUBLIC; REVOKE FROM anon;` que as demais funções receberam nas migrations `20260605_revoke_*`.
2. A tabela `orcamento_history` ficou sem migration de criação.

**Sintoma:**  
```
sksursvmgvxqbbdsztcd.supabase.co/rest/v1/rpc/process_orcamento_status → 403 (Forbidden)
```

**Solução:**  
Migration `20260614_fix_process_orcamento_status_grant.sql` com:
- `CREATE TABLE IF NOT EXISTS public.orcamento_history` + RLS `team_isolation` RESTRICTIVE
- `CREATE OR REPLACE FUNCTION public.process_orcamento_status(...)` com SECURITY DEFINER, SET search_path = public, RBAC completo, auditoria e notificações
- `REVOKE EXECUTE FROM PUBLIC; REVOKE FROM anon; GRANT TO authenticated`

### Limpeza: console.log de debug em produção
- Removido `console.log('[useClientLocations] clientId: ... → N filiais')` de `src/hooks/useClientLocations.ts`  
  Esse log era o primeiro erro visível no console da screenshot, causando confusão no diagnóstico.

## Pendências para a próxima sessão
- Nenhuma.
