# Sessão 4 — 20/04/2026 (continuação)

### Bugs corrigidos pós-testes do módulo de Compras

**Bug 6 — Real-time não disparava para nenhuma tabela**
- Sintoma: técnico não recebia atualização de status em tempo real; Comprador não recebia novos cards em tempo real
- Causa raiz: `supabase_realtime` publication com `puballtables = false` e **zero tabelas registradas** — nenhum evento `postgres_changes` chegava ao frontend
- Diagnóstico: `SELECT * FROM pg_publication_tables WHERE pubname = 'supabase_realtime'` retornou array vazio
- Correção: migration adicionando as tabelas à publicação:
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE material_requests;
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  ```
- Verificado: `pg_publication_tables` agora lista `material_requests` e `notifications`

**Bug 7 — Comprador não via cards de outros técnicos (INNER JOIN bloqueado por RLS)**
- Sintoma: Comprador (Luis) recebia notificação no sino mas painel mostrava zero cards de solicitações
- Causa raiz: policy SELECT da tabela `users` restringia cada usuário ao próprio perfil (`id = auth.uid()`). O PostgREST executa o join `users:tech_id(full_name)` como INNER JOIN — quando o RLS bloqueava a leitura do row do técnico (ex: Douglas), o card inteiro era excluído do resultado
- Correção 1: nova policy RLS em `users`:
  ```sql
  CREATE POLICY "Managers can view all users"
  ON public.users FOR SELECT
  USING (is_manager_or_admin());
  ```
  → Comprador, Gestor, Admin, Master agora podem ver todos os perfis (necessário para exibir nome do técnico)
- Correção 2: join alterado para LEFT JOIN em `MaterialsList.tsx`:
  ```typescript
  // Antes:
  users:tech_id(full_name)
  // Depois:
  users:tech_id!left(full_name)
  ```
  → Garante que o card aparece mesmo que o join retorne null

### Regra aprendida — Bug 7 (revisão)
- **PostgREST + RLS + JOIN**: quando um SELECT inclui join em outra tabela, o RLS dessa tabela é aplicado. Se o join falha por RLS, o PostgREST exclui a linha inteira do resultado (comportamento de INNER JOIN). Solução: adicionar policy permissiva OU usar `!left` no join.

**Bug 8 — `is_manager_or_admin()` retorna false no contexto de SELECT do PostgREST (causa raiz final)**
- Sintoma: Comprador via apenas 1 card (o seu próprio). Console mostrava `fetchRequests result: 1 records | userRole: Comprador`
- Diagnóstico via DevTools: `userRole: Comprador` confirmado no frontend, mas DB retornava 1 registro
- Causa raiz: a função `is_manager_or_admin()` (SECURITY DEFINER, sem SET search_path) falha silenciosamente no contexto de avaliação de RLS SELECT do PostgREST — provavelmente `auth.uid()` retorna NULL dentro da função nesse contexto, fazendo `SELECT role FROM users WHERE id = NULL` não retornar linhas → função retorna NULL → avaliado como false pelo PostgreSQL
- Pista decisiva: a policy `comprador_update_all` (UPDATE) já usava `EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN (...))` e funcionava perfeitamente
- Correção: reescrever as policies SELECT e ALL de `material_requests` com `EXISTS` direto, sem chamar função auxiliar:
  ```sql
  -- SELECT policy
  USING (
    tech_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('Comprador', 'Gestor', 'Admin', 'Master', 'Supervisor')
    )
  );
  -- ALL policy (mesma lógica)
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN ('Comprador', 'Gestor', 'Admin', 'Master', 'Supervisor')
    )
  );
  ```
- Verificado: Comprador agora vê todos os cards ✓
