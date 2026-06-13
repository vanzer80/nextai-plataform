# Sessão 29 — 02/05/2026 → 03/05/2026 — Auditoria de Segurança: 12 achados corrigidos + Phase 1 Banco
**Commits:** `bffc2cd` (6 achados de código), `e4cdf7a` (bug crítico storage), `dc538b9` (storage reimbursements + INSERT WITH CHECK)

### O que foi executado

**Auditoria de código (Revisão do Plano v2) — `bffc2cd`**

6 achados corrigidos:

| Achado | Arquivo | Correção |
|--------|---------|----------|
| CRÍTICO — Escalada de privilégio | `admin-create-user/index.ts` | `ROLE_RANK` + guard `targetRank >= callerRank`: Gestor não pode criar Admin/Master |
| CRÍTICO — Email hardcoded bypass RBAC | `AppLayout.tsx:291` | Removido `user?.email === 'vanzer80@gmail.com'` do filtro de nav |
| HIGH — Security headers ausentes | `vercel.json` | X-Frame-Options: DENY, X-Content-Type-Options: nosniff, Referrer-Policy, Permissions-Policy |
| HIGH — Debug artifact committed | `test-timeout.ts` (root) | Arquivo removido do repo |
| MÉDIO — Role "Tecnico de Campo" vs "Tecnico" | `UserManagement.tsx` + `admin-create-user` | Padronizado para "Tecnico" |
| MÉDIO — models.ts ServiceReport.status PT-BR | `models.ts` | Corrigido para enum EN do banco |

**Auditoria Phase 1 — Banco real (sksursvmgvxqbbdsztcd)**

Resultado das queries SQL:
- ✅ RLS: 18/18 tabelas com RLS habilitado — zero tabelas expostas
- ✅ Políticas: `is_manager_or_admin()` e `is_admin_role()` sem referências — removidas do banco
- ✅ Realtime: 5 tabelas publicadas (service_reports, reimbursements, notifications, material_requests, report_status_history)
- ✅ Views: zero views no schema public (nenhum bypass de RLS via views)
- ✅ `rls_auto_enable()`: DDL trigger que auto-habilita RLS em novas tabelas — saudável, mantido
- ✅ `get_auth_role()`: AINDA EM USO em 3 policies da tabela `users` — mantida

**Bug crítico de storage — `e4cdf7a`**

Achado: bucket `service_reports_media` não existe. O banco tem `reports_media`. Todo upload de fotos e assinaturas de relatórios falhava desde o início.

Correções:
- `reportService.ts`: `service_reports_media` → `reports_media` (2 uploads)
- `useReportDetail.ts`: `service_reports_media` → `reports_media` (createSignedUrls)
- Banco: `reports_media` agora é **PRIVADO** (dados sensíveis: fotos, assinaturas)
- Banco: RLS policies criadas (INSERT/SELECT/DELETE para `authenticated`)
- Banco: funções mortas `is_manager_or_admin()` e `is_admin_role()` dropadas

**Vercel deploy verificado:**
- Todos os 4 security headers ativos em produção: X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy

**Continuação (03/05/2026) — `dc538b9`**

4 achados adicionais corrigidos:

| Achado | Correção |
|--------|----------|
| `reimbursements_media` público + URL pública salva no banco | Bucket agora privado; `NewReimbursement` salva path; `ReimbursementsList` resolve signed URLs com compatibilidade retroativa para URLs antigas |
| Nova lib: `src/lib/storage.ts` | `extractStoragePath()` + `batchSignedUrls()` — extrai path de URL antiga ou nova; resolve lote de signed URLs |
| INSERT policy `service_reports` sem WITH CHECK | `WITH CHECK (technician_id = auth.uid())` adicionado |
| INSERT policies `reimbursements`, `orcamentos`, `orcamento_itens` sem WITH CHECK | WITH CHECK com `auth.uid()` adicionado em todas; `orcamento_itens` verifica ownership do orcamento pai |

### Pendências para próxima sessão
- Sprint 13: Notificações externas (Resend email + Evolution API WhatsApp)
