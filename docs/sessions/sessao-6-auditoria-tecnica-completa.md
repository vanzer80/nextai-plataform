# Sessão 6 — 20/04/2026 — Auditoria Técnica Completa

### Diagnóstico executado

Auditoria completa de código (5.457 linhas, 22 arquivos) + banco de dados (schema, índices, RLS, funções, enums).

---

#### BANCO DE DADOS — Problemas encontrados

**🔴 CRÍTICO — Enum `reimbursement_status` duplicado**
- O enum tem `'Revisão'` (com acento) E `'Revisao'` (sem acento) simultaneamente
- O código usa `'Revisao'` — rows com `'Revisão'` quebram filtros silenciosamente
- Correção: remover o valor com acento via migration

**🔴 CRÍTICO — Zero índices secundários**
- Só existem PKs e o índice UNIQUE de `request_number`
- Colunas sem índice críticas:
  - `notifications(user_id, is_read)` — toda query do sino faz seq scan
  - `reimbursements(user_id, status)` — toda listagem faz seq scan
  - `material_requests(tech_id, status)` — toda listagem e KPI faz seq scan
  - `reimbursement_history(reimbursement_id)` — toda abertura de modal faz seq scan
- Sem impacto hoje (volume pequeno), crítico com crescimento

**🟠 ALTO — RLS policies duplicadas/conflitantes**
- `reimbursements`: 3 SELECT policies sobrepostas (Postgres avalia todas com OR = trabalho triplo)
  - `"Gestores veem todos"` usa `~~*` ILIKE em cast de enum — extremamente ineficiente
  - `"Users can view... managers can view all"` usa `is_manager_or_admin()`
  - `"Managers can manage all"` (ALL) também cobre SELECT
- `users`: 3 SELECT policies sobrepostas (`"Users can view own"` + `"Administradores podem VER"` + `"Managers can view all"`)

**🟠 ALTO — `is_manager_or_admin()` e `is_admin_role()` ainda usadas em 5 tabelas**
- Já documentado: função SECURITY DEFINER falha silenciosamente em RLS SELECT no PostgREST
- Já corrigido em `material_requests` — mas persiste em:
  - `notifications` — "Managers can insert and manage all notifications"
  - `reimbursements` — "Managers can manage all reimbursements"
  - `reimbursement_history` — "Users can view history..."
  - `equipments` / `sites` — "Managers can manage"
  - `users` — "Administradores podem VER/ATUALIZAR/DELETAR" usa `is_admin_role()`

**🟠 ALTO — FK inconsistente: `material_requests.comprador_id → auth.users`**
- Todas as outras FKs de usuário apontam para `public.users`
- `comprador_id` aponta para `auth.users` — impede JOIN com nome/role sem query separada

**🟡 MÉDIO — Dois triggers duplicados para `updated_at`**
- `handle_updated_at()` — genérica
- `update_material_requests_updated_at()` — específica e redundante

---

#### CÓDIGO FRONTEND — Problemas encontrados

**🔴 CRÍTICO — `page` nas deps do canal Realtime em `ReimbursementsList.tsx`**
- Canal é destruído e recriado a cada mudança de página → múltiplas conexões websocket

**🟠 ALTO — `withTimeout` copiado em 3 arquivos**
- `AuthContext.tsx`, `NewReimbursement.tsx`, `NewMaterialRequest.tsx`

**🟠 ALTO — Fetch de `clients` triplicado sem cache**
- `NewReimbursement`, `NewMaterialRequest`, `NewReport` fazem query idêntica no mount

**🟠 ALTO — 15+ usos de `any` sem tipagem**
- Interfaces TypeScript ausentes para modelos principais

**🟡 MÉDIO — Race condition de notificações no `AppLayout`**
- Ordem: fetch → subscribe (deveria ser subscribe → fetch → deduplicar)
- Notificação que chegar entre os dois momentos é perdida

**🟡 MÉDIO — Dashboard sem Realtime**
- Dados só atualizam no F5

---

#### Plano de Execução — 4 Etapas

| Etapa | Escopo | Risco |
|---|---|---|
| **E1** | Banco: índices + enum fix + cleanup policies duplicadas | 🟢 Baixo |
| **E2** | Código: `withTimeout` extraído + `page` removido do realtime + ordem notif | 🟢 Baixo |
| **E3** | Banco: substituir `is_manager_or_admin()` por EXISTS nas 5 tabelas restantes | 🟡 Médio |
| **E4** | Código: hook `useClients()` + tipos TypeScript | 🟢 Baixo |
