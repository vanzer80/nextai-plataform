# NextAI — Engineering Roadmap 2026

> Full documentation in Obsidian: `Sprints/00 - Master Roadmap B2B Enterprise.md`  
> **Atualizado em:** 2026-06-05 (Sessão 73) · ~155 commits · Sprints A–G concluídas

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

---

## Next Development Phase — Sprint H: Developer Experience + Notificações

> Sprint G (Public API) concluída — ERP Integration agora desbloqueada.  
> Sprint H foca em completar o ciclo de integração e comunicação proativa.

| Módulo | Escopo | Esforço |
|--------|--------|---------|
| **Public API DX** | OpenAPI 3.0 spec em `/api/docs` (Swagger UI) · Getting started guide · Postman collection | 2–3 dias |
| **Notificações** | Email (Resend) + WhatsApp (Evolution API): SLA vencido · aprovação pendente · OS concluída | 1–2 dias |
| **AI Report Writer** | Free text → linguagem técnica profissional (GPT-4o) para laudos de OS | 1–2 dias |
| **CR (Contas a Receber)** | Ciclo financeiro completo: fatura → pagamento → aging report | 3–4 dias |

**Desbloqueado pela Sprint G:** ERP Integration (TOTVS/SAP/Omie via webhook + adapter por ERP)

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
| LGPD baseline: soft-delete de PII por tenant + registro de operações de tratamento | 🔴 High | 1–2 days | compliance |
| Email notifications (Resend) + WhatsApp (Evolution API) | 🔴 High | 1–2 days | — |
| AI Report Writer (free text → professional technical language) | 🔴 High | 1–2 days | — |
| Background Sync (Service Worker offline queue auto-sync) | 🟡 Medium | 1 day | — |
| PWA icons PNG 192×512 for Android/Chrome install | 🟢 Low | hours | — |
| RAG Analytics — natural language search over reports (pgvector) | 🟡 Strategic | 5–8 days | — |
| GPS Dispatching Map — real-time technician location tracking | 🟡 Strategic | 5–8 days | — |
| ERP Integration (TOTVS / SAP / Omie) via webhook + adapter por ERP | 🟡 Strategic | 3–5 days/ERP | ✅ Sprint G concluída |
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
