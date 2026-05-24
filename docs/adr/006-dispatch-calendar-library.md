# ADR-006 — Dispatch Calendar Library

**Status:** Proposed  
**Date:** 2026-05-24  
**Sprint:** C

## Context

We need a calendar component for the dispatch view (OS by technician by day) with drag-and-drop rescheduling.

## Decision

Use **`@fullcalendar/react`** with the `daygrid`, `timegrid`, and `interaction` plugins. Reasons: most complete API for our needs (month/week views, drag-and-drop, event coloring), active maintenance, 450k+ weekly npm downloads.

Bundle cost: ~55 kB gzip for the three plugins combined. Loaded as a separate lazy chunk (`DispatchCalendar` page).

## Alternatives Considered

1. **`react-big-calendar`** — 28 kB gzip, simpler API. Does not support drag-and-drop natively without `react-dnd` (~15 kB extra). Total similar to FullCalendar. Rejected because FullCalendar has better mobile support.
2. **Custom built** — CSS Grid calendar. Zero bundle cost but significant development time for drag-and-drop. Deferred to v2 if FullCalendar licensing becomes an issue.
3. **`vis-timeline`** — Gantt-like timeline, good for resource view. Overly complex for our use case.

## Consequences

- FullCalendar v6 is MIT licensed for the core packages used here. No license cost.
- Adds ~55 kB to the DispatchCalendar chunk (lazy loaded, does not affect initial bundle).
- Drag-and-drop updates `service_reports.service_date` — must be restricted to Gestor/Supervisor via UI guard (not RLS, since any auth'd user with team membership can update service_date).
