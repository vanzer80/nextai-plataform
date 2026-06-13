# Sessão 61 — 30/05/2026 — Módulo de OS nível SAP (12 features + 3 módulos novos)

**Commits:** `cc594ec` · `5bac32a` · `4b84906` · `b988c9f` · `fae97a6` · `1c0c6c2`
**Branch:** `master` → `nextai-plataform`

### Contexto

Objetivo: elevar o módulo de Ordens de Serviço ao nível de um sistema SAP PM (Plant Maintenance). Implementação em 6 commits cobrindo numeração automática, busca full-text, notificações nativas, manutenção preventiva e integração com estoque.

---

### DB — Migrations aplicadas via MCP Supabase (execute_sql)

| Migration | O que cria |
|-----------|-----------|
| `20260530_os_number_counter_and_search` | `tenant_os_counters`, `reserve_os_number()` RPC, `search_vector` GENERATED STORED, índice GIN |
| `20260530_notifications` | `notifications` table + Realtime + trigger `notify_on_os_status_change` |
| `20260530_resubmit_report` | `resubmit_report(uuid, jsonb)` RPC |
| `20260530_reopen_report` | `reopen_report(uuid)` RPC |
| `20260530_maintenance_plans` | `maintenance_plans`, `maintenance_plan_id` em `service_reports`, `create_due_maintenance_orders()` |
| `20260530_stock_deduction` | trigger `trg_deduct_stock_on_approval` (deduz `os_parts` de `parts.stock_qty` na aprovação) |
| `20260530_push_subscriptions` | `push_subscriptions` table com RLS |

---

### Features implementadas

#### 1 — Numeração automática de OS (SAP PM style)
- `tenant_os_counters`: contador atômico por tenant (UPSERT atômico, sem race condition)
- `reserve_os_number(team_id)`: SECURITY DEFINER, REVOKE de `anon`, formato `OS-YYYYMM-NNNNN`
- `Step1Identification`: `useEffect` idempotente, `generationRef` anti-race, badge read-only, RefreshCw, fallback manual em erro
- Unique constraint `(team_id, os_number)` com NULLs tolerados

#### 2 — Busca full-text com índice GIN (nível SAP)
- `search_vector GENERATED ALWAYS AS tsvector('simple', ...)` STORED — 8 campos indexados
- `useReports`: `textSearch('search_vector', q, { type: 'websearch', config: 'simple' })`
- `ReportFilters`: input de busca com debounce 350ms, isMounted ref evita disparo espúrio no mount
- Busca por nome de cliente: `matchingClientIds` via `useClients()` cache (cross-table não suportado em GENERATED COLUMN)
- Busca offline: catch block do `useReports` filtra cache IndexedDB com JS includes

#### 3 — Filtros expandidos na lista
- **Prioridade** (todos): Select crítica/alta/normal/baixa
- **Técnico** (gestores): `useTechnicians` hook com cache em memória + RLS isola por tenant
- **`hasActiveFilter`** completo: inclui priority e technicianId
- `sla_due_at` e `priority` adicionados ao SELECT (eram carregados no ReportDetail mas faltavam na listagem)

#### 4 — Chip de prioridade e badge OS no ReportCard
- `os_number`: badge `font-mono` no header do card (ao lado do status badge)
- Prioridade: chip âmbar (alta), vermelho+chama (crítica), oculto para normal
- Badge "Preventiva" violeta quando `maintenance_plan_id` não nulo

#### 5 — Edição de OS devolvida (inline, SAP PM ordem de correção)
- `resubmit_report(uuid, jsonb)`: valida técnico + status=returned, atualiza 8 campos de texto, transita → `pending_review`, insere histórico
- `ReportDetail`: form expansível inline (não refaz o wizard de 7 etapas), pré-preenchido com valores atuais

#### 6 — Reabrir OS rejeitada
- `reopen_report(uuid)`: valida técnico + status=rejected, transita → `returned` (preserva `reviewer_comment`)
- `ReportDetail`: alerta vermelho com motivo (antes ausente), card de contestação com confirmação 2 etapas
- Trigger `notify_on_os_status_change` não re-notifica pois `changed_by === technician_id` (guard existente)

#### 7 — Notificações in-app em tempo real (completas)
- Trigger `notify_on_os_status_change`: INSERT em `notifications` para técnico em `approved/rejected/returned`
- `AppLayout`: toast.info ao receber INSERT via Realtime websocket
- Clicar na notificação → navega para `/reports/<report_id>` (useNavigate dentro de NotificationsDropdown)

#### 8 — Exportação Excel
- `exportarOsExcel.ts`: SheetJS com largura automática de colunas, 14 campos
- Botão "Exportar" (gestores): fetch completo sem paginação respeitando todos os filtros ativos
- Warning (não sucesso) quando resultado vazio

#### 9 — Ordenação configurável
- `sortBy`: `created_at | service_date | sla_due_at | os_number`; `sortDir`: `asc | desc`
- `.order(sortCol, { ascending: sortAsc, nullsFirst: false })` — NULLs em `sla_due_at` vão para o final
- Select compacto inline com a barra de busca; `lastIndexOf('-')` para parsing seguro de colunas com underscores

#### 10 — Deep link (URL sync)
- `useSearchParams` em `ReportsList`: lazy init lê URL no mount; `useEffect` unidirecional `filter→URL` com `replace:true` (sem poluir history)
- Defaults omitidos da URL para links limpos (ex: `?status=approved&sort=sla_due_at`)

#### 11 — Duplicar OS
- `ReportDetail`: botão "Duplicar" no header → `/reports/new?duplicateFrom=<id>`
- `NewReport`: `useEffect` de mount faz fetch e pré-preenche service_type/client_id/site_location/asset/priority; diagnóstico/execução ficam vazios; OS number regenerado automaticamente pelo Step1

#### 12 — Manutenção Preventiva (módulo completo — padrão SAP PM IP41/IP10)
- `maintenance_plans`: frequência (diário/semanal/quinzenal/mensal/trimestral/personalizado), `lead_days`, RLS team_isolation
- `create_due_maintenance_orders()`: SECURITY DEFINER, idempotente (não duplica se rascunho < 2 dias), avança `next_due_at` automaticamente
- Edge Function `maintenance-scheduler`: chama RPC, agendável via cron `0 9 * * *`
- `/admin/maintenance-plans`: CRUD completo com Dialog, técnico/cliente/tipo, botão "Executar agora"
- Nav link para Gestor/Admin/Master

#### 13 — Baixa automática de estoque na aprovação
- Trigger `trg_deduct_stock_on_approval`: AFTER UPDATE OF status, deduz `os_parts.qty_used` de `parts.stock_qty`
- Estoque negativo permitido (técnico não pode ser bloqueado no campo)
- Notifica gestores (INSERT em `notifications`) quando estoque cai abaixo do mínimo

#### 14 — Push notifications nativas (Web Push API)
- `push_subscriptions`: RLS, upsert por user_id+user_agent (multi-device)
- `public/sw.js`: handlers `push` e `notificationclick` adicionados ao SW existente (offline cache preservado)
- Edge Function `push-notification`: webhook `notifications INSERT → web-push@3.6.7`; remove subscriptions expiradas (410 Gone)
- `usePushNotification`: auto-subscribe se permissão já concedida; AppLayout pede permissão após 8s para Tecnico/Supervisor

**Setup necessário para push:**
```bash
npx web-push generate-vapid-keys
# .env: VITE_VAPID_PUBLIC_KEY=<pub>
# Supabase Secrets: VAPID_PRIVATE_KEY + VAPID_SUBJECT
# supabase functions deploy push-notification
# Dashboard Webhook: notifications INSERT → /functions/v1/push-notification
# supabase functions deploy maintenance-scheduler + Schedule: 0 9 * * *
```

---

### Decisões técnicas relevantes

| Decisão | Motivo |
|---------|--------|
| `config: 'simple'` no tsvector (não `'portuguese'`) | Sem stemming para dados estruturados — `OS-202605-00001` indexado corretamente |
| `generationRef` anti-race no Step1 | Mudança rápida de tipo de serviço disparava 2 RPCs — resultado mais recente vence, gaps são tolerados (padrão ERP) |
| `lastIndexOf('-')` para parsing do sort | Colunas com underscore (`sla_due_at`) quebram com `split('-')` simples |
| `setHasMore(false)` no catch offline | Sem fix, "Carregar mais" appendava duplicatas do cache |
| `reopen_report` transita `rejected → returned` | Reutiliza o form de correção existente — zero código duplicado |
| `deduct_stock_on_approval` permite negativo | Campo não pode bloquear técnico; gestor recebe notificação de estoque baixo |
| pg_cron indisponível → Edge Function | Supabase free tier não tem pg_cron — Edge Function `maintenance-scheduler` com schedule manual via dashboard |

### Checks finais

- ✅ `npx tsc --noEmit` EXIT:0
- ✅ `npx vitest run` 117/117
- ✅ `npm run build` EXIT:0
- ✅ Security advisors: zero novos alertas reais
- ✅ `proacl` de todas as RPCs: `anon` ausente
