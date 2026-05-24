# ADR-002 — Parts Inventory Stock Atomicity

**Status:** Proposed  
**Date:** 2026-05-24  
**Sprint:** A

## Context

When a technician records parts used in an OS, the stock level in `parts.stock_qty` must be decremented. This must be atomic to prevent race conditions (two technicians using the last unit simultaneously).

## Decision

Use a `SECURITY INVOKER` RPC `use_part(p_report_id, p_part_id, p_qty)` that performs the decrement and insert atomically within a single transaction. The RPC checks `stock_qty >= p_qty` before decrementing and returns an error if stock is insufficient.

## Alternatives Considered

1. **Direct UPDATE from frontend** — Two sequential queries (check + update) with a race condition window. Rejected.
2. **Postgres trigger on os_parts INSERT** — Trigger decrements stock. Rejected: side effects in triggers are hard to unit test and debugging requires DB access.
3. **Optimistic concurrency with version column** — Add `version` to parts, check version in UPDATE WHERE clause. Rejected: more complex and not necessary given low-frequency updates.

## Consequences

- Stock can go negative if RPC is bypassed (direct INSERT to os_parts). Mitigated by RLS policies that prevent direct table writes for the Tecnico role.
- Edge case: OS is deleted after parts used — stock is not automatically restored. Acceptable for v1; restoration flow can be added later.
