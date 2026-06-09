# NextAI — Engineering Roadmap 2026

> Full documentation in Obsidian: `Sprints/00 - Master Roadmap B2B Enterprise.md`  
> **Atualizado em:** 2026-06-06 (Sessão 74) · ~156 commits · Sprints A–G + OS Import Bridge concluídas

## Current State

All core modules implemented across Sprints A–F + Sessions 31–69:

**Field Service (OS):** wizard 7 steps · GPS geolocation · AI diagnosis · digital signature canvas · offline drafts · auto-numbering · full-text search (GIN) · SLA tracking · preventive maintenance · QR code scan · OS↔Quote linking (SAP SD/PM) · Excel export · push notifications.

**Financial & Procurement:** Reimbursements (AI OCR · SHA-256 antifraude · CNPJ validation · status "Pago") · Compras + Purchase Orders · Orçamentos/CPQ (e-signature · versioning · OS linking) · Contas a Pagar (multilevel approval workflow).

**HR & Ops:** RH (CLT employees · departments · certifications · events) · DP (payroll INSS/IRRF/FGTS · holerites PDF · time records · vacation) · Dispatch Calendar · Knowledge Base (FTS pt-BR) · Asset Lifecycle (linear depreciation).

**Platform:** Multi-tenant RLS isolation by `team_id` · OKLCH dynamic branding · SuperMaster (5 Platform pages · Intelligence cross-tenant 15 tabs · Commercial Profile editor) · Customer Portal · CSAT · PWA (SW `nextai-v7` · IndexedDB) · Onboarding 25 tours / 85+ steps (driver.js).

**Integrações (Public API):** API Keys (SHA-256, scopes, rotação/revogação, reveal-once) · Edge Fn `api-gateway` (rate limit 1000 req/hr Deno KV · RFC 7807 errors · cursor pagination · idempotency keys) · Webhook System (HMAC-SHA256 signing · retry 6×backoff exponencial [0→24h] · dead-letter queue) · 7 eventos (order.created/updated/completed · reimbursement.approved/paid · quote.signed · payable.paid) · UI Admin (ApiKeys + Webhooks pages · log de entregas · disparo manual).

**Tests:** 117 Vitest unit tests (8 files) · 24 Playwright E2E spec files / ~171 tests.

---

## Completed Sprints

| Sprint | Features | Commit | Date |
|--------|----------|--------|------|
| **A** | SLA Tracking · Supplier Management · Parts Inventory | `fba1437` | 2026-05-24 |
| **B** | Purchase Orders · Expense Reports · QR Code → OS | `fb55035` | 2026-05-24 |
| **C** | Customer Portal · CSAT Surveys · Dispatch Calendar | `0b6fdeb` | 2026-05-24 |
| **D** | Quote E-Signature · Quote Versioning | `730d20a` | 2026-05-24 |
| **E** | OCR Receipts · Budget Control · Knowledge Base · Asset Lifecycle | `8a7ddad` | 2026-05-24 |
| **F** | RH (CLT) · DP (Payroll / Holerite / Ponto / Férias) · CP (Contas a Pagar) | `9bbb649` | 2026-05-26 |
| **G** | Public API & Webhook System (api-gateway · webhook-dispatcher · ApiKeys UI · Webhooks UI) | `a8f961c` | 2026-06-05 |

---

## Post-Sprint Deliveries (Sessions 62–72)

| Session | Date | Deliverable |
|---------|------|------------|
| s62 | 2026-05-30 | OS↔Quote SAP SD/PM linking · 33 E2E tests · 16 CPQ audit fixes |
| s63 | 2026-05-31 | NextAI landing page redesign (AI-first, AiOrb 3D) · tenant logo in all PDFs |
| s64 | 2026-05-31 | CPQ race condition fix · OS section in quote PDF · logo rendering fix (`measureImage`/`fitInBox`) |
| s65 | 2026-06-03 | 22 E2E tests for RH, DP, CP modules (7+7+8) |
| s66–67 | 2026-06-03 | Commercial tenant profile (CNPJ, address, fiscal data) · Onboarding 25 tours 85+ steps |
| s68 | 2026-06-04 | SuperMaster edits any tenant's commercial profile · 6 Platform E2E tests |
| s69 | 2026-06-04 | PRD audit against external product analysis · PRD + ROADMAP updated · 3 critical findings identified (update_orcamento non-atomic, AI cost observability, CP migration FK) |
| s70 | 2026-06-04 | Sidebar reorganizado em 9 grupos funcionais SAP-style (NAV_GROUPS) · 5 testes E2E sidebar-verify |
| s71 | 2026-06-04 | Correção de agrupamento: Orçamentos→Comercial · Manutenção Preventiva→Operações de Campo · Equipamentos→Suprimentos · split Configurações/Administração · testes atualizados 5/5 |
| s72 | 2026-06-05 | Security hardening: REVOKE anon+PUBLIC em 32 funções SECURITY DEFINER · search_path fixado em 4 funções · RLS em ai_routing_log · payable_status_history + audit trail (updated_by/updated_at) em payables+reimbursements · bucket tenant-assets restrito por team_id · ai-proxy rate limiting 20 req/min via Deno KV |
| s73 | 2026-06-05 | **Sprint G** — Public API & Webhook System: 2 migrações SQL (schema + patch-1 com 11 fixes) · 2 Edge Functions (api-gateway v1 · webhook-dispatcher v2) · 5 tabelas + 10 RPCs SECURITY DEFINER · UI Admin ApiKeys + Webhooks · 7 eventos webhook · onboarding tours integrations |
| s74 | 2026-06-06 | **OS Import Bridge** — Edge Fn os-import-processor v1 · mode json+pdf · Gemini 2.0 Flash extração · resolução client/técnico (CNPJ→name→auto_create) · reserve_os_number_service · migration 20260606 (external_source, external_ref_id, os_import_log, dedup index) · UI /admin/os-imports (log tabela + filtros + row expandida + reprocessar) · tour osImportTour |

---

## API Public — Scorecard de Maturidade (Auditoria 2026-06-05)

> Auditoria técnica completa realizada em s73 após entrega da Sprint G.  
> Referência: análise linha a linha do `api-gateway/index.ts` e `webhook-dispatcher/index.ts`.

| Dimensão | Estado Atual | Alvo SAP-level | Sprint |
|----------|-------------|----------------|--------|
| Segurança de autenticação | 7/10 · SHA-256 correto, sem OAuth 2.0 | 10/10 | I |
| Segurança dos endpoints | 4/10 · body injection via service_role | 10/10 | **Patch 2** |
| Completude do CRUD | 4/10 · metade dos endpoints faltando | 10/10 | **Patch 2** + I |
| Delta sync / filtros | 2/10 · sem `updated_after` | 10/10 | **Patch 2** + I |
| Rate limiting | 3/10 · 1k/hr flat, sem tiers | 10/10 | I |
| Validação de input | 1/10 · nenhuma, body não sanitizado | 10/10 | **Patch 2** |
| Webhook reliability | 7/10 · retry correto, falta rotação/test | 9/10 | I |
| Webhook coverage | 3/10 · 7 eventos vs 50+ necessários | 10/10 | I |
| Contrato de API (OpenAPI) | 0/10 · inexistente | 10/10 | I |
| Developer experience | 1/10 · sem sandbox, sem SDK | 10/10 | I + J |
| Observabilidade (UI) | 2/10 · log no banco, sem página | 10/10 | I |
| **Média** | **3,1/10** | **10/10** | |

---

## Sprint G Patch 2 — Segurança & Completude da API (urgente)

> Corrigir **antes** de qualquer divulgação pública do endpoint ou onboarding de cliente com integração.  
> Todas as correções são na Edge Function `api-gateway` — sem migrations de banco.  
> Detalhes técnicos completos: CLAUDE.md § "API — Vulnerabilidades & Padrões Corretos".

| # | Vulnerabilidade / Lacuna | Severidade | Esforço |
|---|--------------------------|-----------|---------|
| 1 | **Field injection**: `...body` sem whitelist em POST/PATCH — service_role bypassa RLS, campos do sistema podem ser sobrescritos (`os_number`, `created_at`, `reviewer_id`) | 🔴 Crítico | 2h |
| 2 | **Sem validação de input**: campos obrigatórios, tipos, enums não verificados — 500 sem mensagem útil em vez de 400 com detalhe campo a campo | 🔴 Crítico | 1 dia |
| 3 | **Cursor pagination com bug**: `lt(created_at, ...)` perde registros quando múltiplos têm mesmo timestamp (batch inserts) | 🔴 Crítico | 2h |
| 4 | **GET /reimbursements join frágil**: `users!inner` → reembolso some silenciosamente se usuário for deletado; usar `team_id` direto da tabela | 🟠 Alto | 30min |
| 5 | **Response envelope inconsistente**: GET by ID retorna objeto raw, GET list retorna `{ data: [...] }` — quebra clients genéricos | 🟠 Alto | 1h |
| 6 | **GET by ID faltando**: `/clients/:id` · `/reimbursements/:id` · `/quotes/:id` — impede lookup por chave estrangeira | 🟠 Alto | 2h |
| 7 | **PATCH /clients faltando**: sem update de cliente, sync bidirecional é impossível | 🟠 Alto | 1h |
| 8 | **Idempotency ausente**: POST /clients não cacheia resposta — retry cria duplicata | 🟠 Alto | 30min |
| 9 | **Content-Type não validado**: body sem `application/json` resulta em 500 opaco | 🟡 Médio | 1h |
| 10 | **Delta sync mínimo**: filtro `updated_after` em `/orders` — sem ele, ERP precisa full-scan a cada sync | 🟡 Médio | 2h |

**Estimativa total:** ~2 dias · Edge Function only

---

## Next Development Phase — Sprint H: Comunicação & Conformidade (~2 semanas)

> Sprint G (Public API) concluída. Sprint H fecha três lacunas críticas do produto:  
> comunicação proativa (maior gap de UX), compliance legal (LGPD) e ciclo financeiro completo (CR).  
> Arquitetura detalhada em CLAUDE.md § "Sprint H — Comunicação & Conformidade".

| Módulo | Escopo | Esforço | Justificativa |
|--------|--------|---------|---------------|
| **Notificações** | Email (Resend) + WhatsApp (Evolution API): OS atribuída/concluída · SLA vencendo · aprovação CP · reembolso aprovado/rejeitado · `notification_preferences` + `notification_log` · Edge Fn `notification-dispatcher` | 2–3 dias | Maior gap de UX — a plataforma captura todos os eventos mas não comunica proativamente |
| **LGPD baseline** | Soft-delete PII em `users` · RPC `anonymize_user_pii()` · `pii_treatment_log` · botão "Remover dados" na UI | 1–2 dias | Requisito legal (Lei 13.709/2018) — custo de remediar pós-escala é exponencial |
| **AI Report Writer** | Edge Fn `ai-report-writer` · botão "Melhorar com IA" no wizard OS (steps 2+6) · GPT-4o · rate limit 10/hr | 1–2 dias | No workflow central do técnico · alta frequência de uso · diferenciador real |
| **CR (Contas a Receber)** | Tabelas `receivables` + `receivable_payments` · trigger `quote.signed → receivable` · aging RPC · widget dashboard · página `/financeiro/cr` | 3–4 dias | CP sem CR = módulo financeiro incompleto; pergunta obrigatória em qualquer demo |

**Desbloqueado pela Sprint G:** ERP Integration (TOTVS/SAP/Omie via webhook + adapter por ERP) — Sprint I  
**Desbloqueado pela Sprint H:** Public API DX completo e CR permitem integração financeira bidirecional

---

## Sprint I — API Completeness + ERP Foundation (~3 semanas)

> Eleva a API do estado "fundação funcional" para "production-ready para enterprise".  
> Pré-requisito para onboarding de qualquer cliente com integração ERP.

| Módulo | Escopo técnico | Esforço |
|--------|---------------|---------|
| **CRUD completo** | PATCH/DELETE clients · GET by ID em todos os recursos · filtros `status`, `cnpj`, `technician_id` em clientes e OS | 2–3 dias |
| **Delta sync** | `updated_after` + `created_after` em todos os endpoints · `X-Total-Count` header nas listagens | 1 dia |
| **Bulk read** | `GET /orders?ids=id1,id2,...` (max 100) · resposta idêntica ao list — batch lookup para reconciliação ERP | 1 dia |
| **OAuth 2.0 Client Credentials** | Edge Fn `oauth-token` · tabela `api_clients` (client_id + hashed_secret) · access token JWT 1h · padrão RFC 6749 § 4.4 | 3 dias |
| **Rate limit por tier** | Configurável por `api_key`: Basic 1k/hr · Pro 10k/hr · Enterprise 100k/hr · burst 200 req/min | 1 dia |
| **OpenAPI 3.0 spec** | Spec YAML versionada em `docs/api/openapi.yaml` · servida em `/api/docs` via Swagger UI · inclui schemas de erro RFC 7807 e exemplos | 2–3 dias |
| **Sandbox tenant** | `team_id = SANDBOX_TEAM_ID` fixo · seed com 50 OS + 20 clientes sintéticos · reset diário via cron | 1–2 dias |
| **Webhook secret rotation** | `POST /api/v1/webhooks/:id/rotate-secret` · novo secret gerado · antigo válido 24h (zero-downtime) | 1 dia |
| **Webhook test delivery** | `POST /api/v1/webhooks/:id/test` · payload sintético por `event_type` · retorna resultado imediato | 1 dia |
| **Admin API usage** | Página `/admin/api-usage` · gráfico req/erros/latência por chave (última hora/dia/semana) · tabela últimas 100 chamadas | 2 dias |
| **Webhook events +8** | `order.assigned` · `sla.breach` · `client.created/updated` · `reimbursement.rejected` · `payable.approved/overdue` · `quote.rejected/expired` | 2 dias |

**Total estimado:** ~3 semanas · Blocker: Sprint G Patch 2 + Sprint H concluídas

---

## Sprint J — Enterprise Maturity (~4 semanas)

> Produto capaz de competir com SAP Integration Suite e TOTVS Fluig no segmento enterprise.

| Módulo | Escopo técnico | Esforço |
|--------|---------------|---------|
| **TOTVS adapter** | Bridge OAuth 2.0 TOTVS ↔ NextAI · mapeamento `ordem_servico ↔ service_report` · sync bidirecional · Edge Fn `totvs-adapter` | 5 dias |
| **SAP S/4HANA adapter** | OData v4 → REST bridge · field mapping SAP PM/SD ↔ NextAI · event translate | 5 dias |
| **Omie adapter** | `app_key` + `app_secret` bridge · sync OS/financeiro/clientes com Omie API | 3 dias |
| **SDK TypeScript oficial** | Package `@nextai/sdk` no npm · typed client · retry automático · interceptors | 3–4 dias |
| **Developer portal** | Redoc interativo · changelog semântico de API · getting started por ERP · exemplos de integração | 3 dias |
| **Bulk operations** | `POST /orders/bulk` (max 100) · `POST /clients/bulk` · resposta 207 Multi-Status com status por item | 2 dias |
| **Webhook circuit breaker** | Auto-desabilita endpoint após 10 falhas consecutivas · notifica via email · re-enable manual no UI | 1 dia |
| **API versioning policy** | Suporte paralelo v1+v2 · headers `Sunset` + `Deprecation` · LTS 12 meses por versão major | 2 dias |
| **Sparse fieldsets** | `?fields=id,os_number,status` em todas as listagens · reduz payload em integrações de alto volume | 1 dia |

**Total estimado:** ~4 semanas · Resultado: API pronta para enterprise sales

---

## Future Roadmap

**⚠️ Blocker for ERP integrations:** items marked `[pre-ERP]` must ship before any ERP webhook work — corrupted data sent to SAP/TOTVS triggers financial audit cascades that cannot be undone.

| Feature | Priority | Effort | Tag |
|---------|----------|--------|-----|
| ~~Fix CP migration FK `teams → tenants`~~ | ✅ Done | — | debt |
| ~~Atomic `update_orcamento` RPC~~ | ✅ Done | — | [pre-ERP] |
| ~~Version `ai-proxy` Edge Function in repository~~ | ✅ Done (s72) | — | ops |
| Ativar HaveIBeenPwned password protection no Supabase Dashboard | 🔴 Urgent | 2 min | security |
| AI cost observability: SuperMaster widget + webhook alert por tenant | 🔴 High | 1 day | [pre-ERP] |
| LGPD baseline: soft-delete de PII por tenant + registro de operações de tratamento | 🔴 High | 1–2 days | Sprint H |
| Email notifications (Resend) + WhatsApp (Evolution API) | 🔴 High | 1–2 days | Sprint H |
| AI Report Writer (free text → professional technical language) | 🔴 High | 1–2 days | Sprint H |
| CR (Contas a Receber): fatura → pagamento → aging report | 🔴 High | 3–4 days | Sprint H |
| Background Sync (Service Worker offline queue auto-sync) | 🟡 Medium | 1 day | — |
| PWA icons PNG 192×512 for Android/Chrome install | 🟢 Low | hours | — |
| RAG Analytics — natural language search over reports (pgvector) | 🟡 Strategic | 5–8 days | — |
| GPS Dispatching Map — real-time technician location tracking | 🟡 Strategic | 5–8 days | — |
| ERP Integration (TOTVS / SAP / Omie) via webhook + adapter por ERP | 🟡 Strategic | 3–5 days/ERP | Sprint J |
| Public API DX: OpenAPI 3.0 spec + Swagger UI | 🟠 High | 2–3 days | Sprint I |
| OAuth 2.0 Client Credentials (enterprise auth) | 🟠 High | 3 days | Sprint I |
| SDK TypeScript oficial (`@nextai/sdk`) | 🟡 Strategic | 3–4 days | Sprint J |
| Phase 6 SaaS: subdomain routing per tenant + billing (Stripe) | 🟡 Strategic | 2–3 weeks | — |

---

## Engineering Principles

1. Every new table ships with `team_isolation` RESTRICTIVE RLS in the same migration
2. New RPCs use `SECURITY INVOKER` + `SET search_path = 'public'` by default; `SECURITY DEFINER` only for cross-tenant — always follow with: `REVOKE FROM PUBLIC; REVOKE FROM anon; GRANT TO authenticated`
3. `npx tsc --noEmit` must exit 0 after every feature
4. New pages are lazy-loaded; initial bundle stays ≤ 100 kB gzip
5. `get_advisors` run after every migration — zero new security alerts permitted
6. At least one Playwright spec per new feature (happy path)
7. Breaking changes forbidden — new columns are nullable or have `DEFAULT`; enum values added with `ADD VALUE IF NOT EXISTS`
8. ADRs for architectural decisions — any non-obvious decision documented in `docs/adr/`
9. **Writes (INSERT):** inject `team_id` manually — RLS does not inject on writes. **Reads:** do NOT add `.eq('team_id', ...)` — RLS filters via `get_caller_team_id()` automatically

---

## Architecture Decision Records

- [ADR-001](docs/adr/001-sla-policy-architecture.md) — SLA Policy Architecture
- [ADR-002](docs/adr/002-parts-inventory-atomicity.md) — Parts Inventory Stock Atomicity
- [ADR-003](docs/adr/003-expense-report-total-amount.md) — Expense Report Total Amount Strategy
- [ADR-004](docs/adr/004-qr-code-library.md) — QR Code Library Choice
- [ADR-005](docs/adr/005-client-portal-auth.md) — Client Portal Authentication
- [ADR-006](docs/adr/006-dispatch-calendar-library.md) — Dispatch Calendar Library
- [ADR-007](docs/adr/007-esignature-approach.md) — E-Signature: Own-Built vs DocuSign
- [ADR-008](docs/adr/008-ocr-provider.md) — OCR Provider: GPT-4o vs Google Document AI
- [ADR-009](docs/adr/009-public-api-design.md) — Public API: Design Principles, Auth Strategy & ERP Integration Path
