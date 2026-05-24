# ADR-003 — Expense Report Total Amount Strategy

**Status:** Proposed  
**Date:** 2026-05-24  
**Sprint:** B

## Context

`expense_reports.total_amount` needs to reflect the sum of `reimbursements.amount` for all linked reimbursements. PostgreSQL GENERATED ALWAYS columns do not support subqueries, so we cannot use that approach.

## Decision

Calculate `total_amount` in the application layer. The `expenseReportService` computes the sum when loading a report. A PostgreSQL view `expense_reports_with_total` is created for queries that need the total server-side (e.g., dashboard aggregations).

```sql
CREATE VIEW public.expense_reports_with_total AS
SELECT er.*, COALESCE(SUM(r.amount), 0) AS total_amount
FROM public.expense_reports er
LEFT JOIN public.reimbursements r ON r.expense_report_id = er.id
GROUP BY er.id;
```

## Alternatives Considered

1. **GENERATED ALWAYS column** — Not supported with subqueries in PostgreSQL. Rejected.
2. **Trigger to maintain denormalized total** — Trigger on reimbursements INSERT/UPDATE/DELETE updates expense_reports.total_amount. More performant for reads but complex to maintain. Deferred to v2 if performance becomes an issue.
3. **Materialized view** — Would require manual refresh. Rejected for real-time accuracy requirement.

## Consequences

- Reads are slightly more expensive (JOIN + SUM on every expense report load).
- Acceptable for current scale (< 1000 reports per tenant).
- If performance degrades, migrate to trigger-based denormalization with ADR update.
