# ADR-005 — Client Portal Authentication

**Status:** Proposed  
**Date:** 2026-05-24  
**Sprint:** C

## Context

We need to allow external client contacts to log in and view only their company's OS. Several approaches exist with different security and complexity trade-offs.

## Decision

Add `'Cliente'` to the existing `user_role` enum. Link client users to a specific `client_id` via a new column on `users`. Use Supabase's built-in invite flow (email magic link). Apply an additional RLS policy on `service_reports` that restricts `role=Cliente` users to their `client_id`.

The existing `team_isolation` RESTRICTIVE policy already prevents cross-tenant access. The new client policy is additive within that constraint.

## Alternatives Considered

1. **Separate Supabase project for client portal** — Maximum isolation but doubles infrastructure cost and complexity. Rejected for current scale.
2. **Public share links (no auth)** — Generate a UUID URL per client OS list. Simpler but no session management, expiry complexity, and no way to restrict to new OS. Rejected.
3. **Third-party customer portal (Zendesk, Freshdesk)** — Too expensive and disconnected from our data model. Rejected.
4. **Separate `client_users` table outside auth** — Would require custom auth layer. Rejected.

## Security Considerations

- Client users must never see `team_id`, internal notes, or other clients' data.
- `internal_notes` field on `service_reports` must be excluded from the SELECT exposed to `role=Cliente`.
- Test with two distinct clients in the same tenant to verify RLS isolation.
- Supabase RLS advisors must show zero new vulnerabilities after this migration.

## Consequences

- `user_role` enum grows — update all TypeScript maps (LABEL, COLOR, guards).
- AppLayout must redirect `role=Cliente` to `/client/*` immediately after login.
- Client users cannot access any admin routes — enforce with `RoleGuard`.
