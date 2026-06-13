# Sessão 41 — 14/05/2026 — Auditoria completa do banco de dados
**Arquivos Obsidian criados:** `Auditoria de Banco de Dados 2026-05-14.md`
**Commits:** nenhum (auditoria read-only — correções ficaram como prompts)

### Escopo da sessão

Auditoria de segurança e performance completa do banco Supabase (`sksursvmgvxqbbdsztcd`). Análise via MCP Supabase com 15+ queries SQL paralelas cobrindo: políticas RLS, definições de funções SECURITY DEFINER, grants por role, índices, storage, enums, grants de tabelas e código frontend.

### Metodologia

- `get_advisors(security)` + `get_advisors(performance)` → advisors com 152k chars
- `list_tables` + `list_migrations` → 19 tabelas, 47 migrations
- 8 queries SQL paralelas: RLS policies, function defs, grants, índices, FK coverage, storage, table grants, RLS flags
- 7 queries adicionais: storage policies, tenants, enums, users schema, funções não-SECURITY DEFINER, buckets, performance advisors
- Leitura de `AuthContext.tsx` e `TenantContext.tsx`

### Achados — 37 total

**GRUPO A (Segurança) — 5 achados:**
- A-01 🔴 CRÍTICO: 14 funções SECURITY DEFINER com EXECUTE grant para role `anon` via PostgREST (`/rest/v1/rpc/`)
- A-02 🔴 CRÍTICO: `backfill_storage_paths(p_team_id)` aceita team_id externo sem verificar autorização — usuário autenticado pode sobrescrever paths de arquivos de outros tenants (SECURITY DEFINER bypassa RLS)
- A-03 🔴 CRÍTICO: `list_legacy_storage_objects(bucket, team_id)` sem autorização — lista objetos de storage de qualquer tenant sem verificação
- A-04 🟠 ALTO: Storage policies `reports_media_team_delete/update` com condição OR legada (`'attachments', 'signatures'`) — qualquer usuário autenticado pode DELETE/UPDATE objetos com paths legados de outros tenants
- A-05 🟡 MÉDIO: Leaked password protection desabilitado no Supabase Auth

**GRUPO B (Integridade/RLS) — 6 achados:**
- B-01 🔴 CRÍTICO: `reimbursement_status` enum com duplicata — `'Revisão'` (acento, sortorder 4) E `'Revisao'` (sem acento, sortorder 5); RPC usa `'Revisao'` mas registros históricos com `'Revisão'` ficam em estado inprocessável
- B-02 🟠 ALTO: `checklist_template_items` sem política RESTRICTIVE de team_isolation — qualquer usuário autenticado vê templates de todos os tenants
- B-03 🟠 ALTO: `tenants_master_select_all` permite que qualquer Master veja TODOS os tenants (cross-tenant info leak)
- B-04 🟡 MÉDIO: `reimbursements_select` inclui role `Comprador` — diverge da documentação (Comprador não deveria ver reembolsos da equipe)
- B-05 🟡 MÉDIO: `users.team_id` nullable sem NOT NULL constraint — usuários sem team_id ficam bloqueados silenciosamente
- B-06 🟡 MÉDIO: `service_type` enum usa PascalCase+acentos (`Preventiva`, `Instalação`...) — diverge da documentação que diz snake_case

**GRUPO C (Performance) — 22 FKs sem índice:**
- `service_reports.team_id`, `reimbursements.team_id`, `clients.team_id`, `material_requests.team_id`, `orcamentos.team_id`, `checklist_templates.team_id`, `sites.team_id`, `equipments.team_id`, `notifications.team_id`, `users.team_id` — avaliadas em TODA operação RLS RESTRICTIVE
- 12 FKs adicionais: `orcamentos.report_id`, `sites.client_id`, `equipments.site_id` e outros

**GRUPO D (Observabilidade) — 4 achados:**
- D-01 🟡: Terceiro tenant `zamb-eng` (Zambrano Engenharia) existente mas não documentado — criado 2026-05-07 01:56, ~1h após NextAI
- D-02 🟡: `reimbursements_media` e `reports_media` sem `file_size_limit` e sem `allowed_mime_types`
- D-03 🟡: Triggers `handle_updated_at`, `update_orcamentos_updated_at`, `generate_material_request_number` sem `SET search_path` fixo
- D-04 🟢: Funções `backfill_storage_paths` e `list_legacy_storage_objects` devem ser dropadas (Fase 4 concluída em s36, funções obsoletas)

### Entregáveis

Arquivo `Auditoria de Banco de Dados 2026-05-14.md` com:
- 14 seções de análise técnica completa
- 4 prompts de implementação prontos para executar (Grupos A/B/C/D)
- Matriz de risco e priorização (P0 → P4)
- Estado final esperado após cada grupo de correções

### Descobertas notáveis

- Funções `backfill_storage_paths` e `list_legacy_storage_objects` são as únicas com exploit real acessível hoje — as demais funções de domínio têm guards `auth.uid() IS NULL` internos que mitigam o risco anon, mas violam o princípio de menor privilégio
- O terceiro tenant `zamb-eng` (Zambrano Engenharia) sugere que o sistema já foi testado com onboarding real — confirmar com usuário se é tenant de produção ou teste
- search_path fixado corretamente em todas as 11 funções SECURITY DEFINER ✅ (ponto positivo)
