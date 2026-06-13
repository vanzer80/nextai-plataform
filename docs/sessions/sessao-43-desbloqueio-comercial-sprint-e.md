# Sessão 43 — 17/05/2026 — Desbloqueio comercial: Sprint E

### Sprint E — Migração `service_type` enum → tabela `service_types` ✅

**Commit:** `07e4cf6`

**Motivação:** O tipo de serviço era um PostgreSQL enum hardcoded (`Preventiva | Corretiva | ...`), impossibilitando que cada tenant configure seus próprios tipos. Bloqueador crítico para comercialização multi-tenant.

#### E1 — SQL Migration (migration `sprint_e_service_types_table`)

| Ação | Detalhe |
|---|---|
| Nova tabela `service_types` | `id UUID PK`, `team_id FK tenants`, `value TEXT`, `label TEXT`, `sort_order INT`, `is_active BOOL`, `UNIQUE(team_id, value)` |
| RLS | RESTRICTIVE `team_isolation` + `authenticated_select` + `admin_all` |
| Seed | 5 tipos (`Preventiva`, `Corretiva`, `Instalação`, `Vistoria`, `Emergência`) para os 3 tenants ativos (15 registros) |
| `service_reports.service_type` | `ALTER COLUMN ... TYPE TEXT USING service_type::text` |
| `checklist_templates.service_type` | `ALTER COLUMN ... TYPE TEXT USING service_type::text` |
| `submit_report` RPC | Removido cast `(p_report->>'service_type')::service_type` → agora apenas `p_report->>'service_type'` (TEXT) |
| Drop enum | `DROP TYPE public.service_type` |

#### E2 — Frontend

| Arquivo | Mudança |
|---|---|
| `src/types/reports.ts` | `ServiceType = string` (era union de 5 valores); removido `SERVICE_TYPE_OPTIONS` |
| `src/hooks/useServiceTypes.ts` | **NOVO** — hook com cache em nível de módulo (uma fetch por sessão) |
| `src/pages/reports/NewReport.tsx` | Removido `SERVICE_TYPES` const + `z.enum(...)` → `z.string().min(1)` |
| `src/pages/reports/components/steps/Step1Identification.tsx` | Usa `useServiceTypes()` |
| `src/pages/reports/admin/ChecklistTemplates.tsx` | Removido `SERVICE_TYPE_LABEL` + `TYPE_COLOR` Records estáticos; usa `useServiceTypes()` |
| `src/pages/reports/admin/TemplateEditor.tsx` | Usa `useServiceTypes()` |

#### E3 — Admin CRUD

| Arquivo | Mudança |
|---|---|
| `src/pages/admin/ServiceTypes.tsx` | **NOVO** — lista ordenada com toggle ativo/inativo + reorder (chevrons) + dialog "Novo Tipo" |
| `src/App.tsx` | Rota `/admin/service-types` com `RoleGuard(['Master','Admin','Gestor'])` |
| `src/components/layout/AppLayout.tsx` | Link "Tipos de Serviço" no sidebar (icon `Settings2`, roles: Gestor/Admin/Master) |
