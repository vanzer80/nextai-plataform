# ADR-007 — E-Signature: Own-Built vs DocuSign

**Status:** Proposed  
**Date:** 2026-05-24  
**Sprint:** D

## Context

We need electronic signature capture on approved quotes (orçamentos) so clients can formally accept them within the system.

## Decision

**Own-built canvas signature** with timestamp and IP address as evidence of intent. Store signature as PNG in Supabase Storage. No third-party e-signature provider for v1.

Evidence captured per signing event:
- Canvas PNG of handwritten signature
- Signer's name, email, and role (self-declared)
- Server-side timestamp (`signed_at` = `now()` in RPC)
- Client IP address (passed from frontend, verified against `X-Forwarded-For` in Edge Function)

## Alternatives Considered

1. **DocuSign** — Enterprise-grade legal compliance, certified timestamps, audit trail. US$25+/month minimum. Overkill for our current client size and adds external dependency. Deferred to v2 for enterprise tier.
2. **ClickSign (Brazilian provider)** — Compliant with ICP-Brasil. R$299+/month. Same size concern as DocuSign. Deferred to v2.
3. **Typed name as signature** — Simplest implementation. Lower perceived value to client. Rejected in favor of canvas.

## Legal Considerations

In Brazil, Law 14.063/2020 and MP 2.200-2/2001 govern electronic signatures. Our implementation constitutes a "simple electronic signature" (assinatura eletrônica simples) — legally valid for most commercial contracts but not for notarial acts. This is sufficient for service agreement acceptance.

For regulated industries or high-value contracts, upgrade path is to integrate ICP-Brasil certified providers (DocuSign Brazil, ClickSign) in a future sprint.

## Consequences

- Signature storage in Supabase Storage (bucket: `orcamento-signatures`, private RLS).
- PDF orçamento updated to include signature image + "Assinado digitalmente em {date} por {name}" footer.
- Legal admissibility: sufficient for the target market (engineering SMBs).
