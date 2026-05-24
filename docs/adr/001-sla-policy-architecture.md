# ADR-001 — SLA Policy Architecture

**Status:** Proposed  
**Date:** 2026-05-24  
**Sprint:** A

## Context

We need to support SLA (Service Level Agreements) tracking on OS (service_reports). The system must know the due date for each OS and alert when breached.

## Decision

Store SLA policies in a `sla_policies` table (configurable per tenant, per service_type, per priority). Calculate `sla_due_at` at OS submission time via an RPC call inside `submit_report`. Breach detection runs as a scheduled Edge Function every 30 minutes.

## Alternatives Considered

1. **Hardcoded SLA per priority** — Simpler but not configurable per tenant. Rejected: different clients have different SLAs.
2. **Trigger-based calculation** — PostgreSQL trigger on INSERT to service_reports calculates sla_due_at. Rejected: triggers are harder to debug and test; RPC approach keeps logic visible.
3. **Frontend-only calculation** — Calculate in UI. Rejected: breach notifications require server-side checks.

## Consequences

- `submit_report` RPC gets a dependency on `sla_policies` table. Must handle gracefully when no policy matches (sla_due_at = NULL).
- Edge Function scheduler introduces operational complexity (needs Supabase cron or pg_cron).
- SLA breach notifications follow same pattern as existing notifications table.
