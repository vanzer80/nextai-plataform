# Portal Mopar — Engineering Roadmap 2026

> Full documentation in Obsidian: `Sprints/00 - Master Roadmap B2B Enterprise.md`

## Current State (baseline)

All core modules implemented: OS, Reimbursements, Purchases, Quotes, Equipment, Dashboard, Notifications, PWA offline, PDF export, multi-tenant RLS.

## Planned Sprints

| Sprint | Features | Status |
|--------|----------|--------|
| **A** | SLA Tracking · Supplier Management · Parts Inventory | Planned |
| **B** | Purchase Orders · Expense Reports · QR Code → OS | Planned |
| **C** | Customer Portal · CSAT Surveys · Dispatch Calendar | Planned |
| **D** | Quote E-Signature · Quote Versioning | Planned |
| **E** | OCR Receipts · Budget Control · Knowledge Base · Asset Lifecycle | Planned |

## Engineering Principles

1. Every new table ships with `team_isolation` RESTRICTIVE RLS in the same migration
2. New RPCs use `SECURITY INVOKER` + `SET search_path = 'public'` by default
3. `npx tsc --noEmit` must exit 0 after every feature
4. New pages are lazy-loaded; initial bundle stays ≤ 100 kB gzip
5. `get_advisors` run after every migration — zero new security alerts permitted
6. At least one Playwright spec per new feature (happy path)
7. Breaking changes forbidden — new columns are nullable or have DEFAULT

## Architecture Decision Records

- [ADR-001](docs/adr/001-sla-policy-architecture.md) — SLA Policy Architecture
- [ADR-002](docs/adr/002-parts-inventory-atomicity.md) — Parts Inventory Stock Atomicity
- [ADR-003](docs/adr/003-expense-report-total-amount.md) — Expense Report Total Amount Strategy
- [ADR-004](docs/adr/004-qr-code-library.md) — QR Code Library Choice
- [ADR-005](docs/adr/005-client-portal-auth.md) — Client Portal Authentication
- [ADR-006](docs/adr/006-dispatch-calendar-library.md) — Dispatch Calendar Library
- [ADR-007](docs/adr/007-esignature-approach.md) — E-Signature: Own-Built vs DocuSign
- [ADR-008](docs/adr/008-ocr-provider.md) — OCR Provider: GPT-4o vs Google Document AI
