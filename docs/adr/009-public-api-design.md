# ADR-009 — Public API: Design Principles, Auth Strategy & ERP Integration Path

**Status:** Accepted  
**Date:** 2026-06-05  
**Authors:** Engineering (s73)  
**Supersedes:** —  
**Related:** Sprint G (foundation), Sprint G Patch 2 (security), Sprint I (completeness), Sprint J (enterprise)

---

## Context

NextAI needs a public API to enable integration with ERPs (SAP, TOTVS, Omie), BI tools, and
iPaaS platforms (Zapier, n8n). The API must serve two very different consumers:

1. **Simple integrations** — Zapier/n8n webhooks, small custom scripts. Developers expect
   API keys, JSON, and clear docs. They don't want to deal with OAuth flows.

2. **Enterprise ERPs** — TOTVS Fluig, SAP S/4HANA, Omie. These systems require enterprise
   authentication (OAuth 2.0 client credentials), bulk operations, delta sync, and SLAs in the
   tens of thousands of requests per hour.

The question is not which consumer to serve — we must serve both — but in what order and with
what tradeoffs at each phase.

---

## Decisions

### Decision 1: Phase-based delivery (Ph1 → Ph4)

Deliver in four phases rather than attempting everything at once. Each phase is independently
shippable and adds value on its own.

**Rationale:**
- Ph1 (auth + rate limit + logging) enables monitoring and abuse prevention immediately.
- Ph2 (CRUD endpoints) enables the first real integration use case.
- Ph3 (webhooks) enables push-based integrations without polling.
- Ph4 (DX) enables partner self-service onboarding.

**Consequence:** Ph1 and Ph2 were delivered in Sprint G. Ph4 (OpenAPI) intentionally deferred
until there is adoption to justify the maintenance cost.

---

### Decision 2: API Key as primary auth mechanism (not OAuth 2.0 from day one)

Sprint G ships with `X-API-Key` + SHA-256 storage. OAuth 2.0 client credentials is planned
for Sprint I.

**Rationale:**
- API key covers ~90% of integration use cases (Zapier, n8n, custom scripts, small ERPs).
- OAuth 2.0 adds ~3 days of development and significant operational complexity (token endpoint,
  refresh flows, client registration UI) without adding value until an enterprise client asks for it.
- The upgrade path is non-breaking: existing API key users are unaffected when OAuth is added.

**Consequence:** Corporate security teams at large enterprises may flag the absence of OAuth 2.0.
Mitigation: Sprint I delivers OAuth 2.0 client credentials before the first enterprise onboarding.

**OAuth 2.0 upgrade path (Sprint I):**
```
POST /api/v1/oauth/token
  Body: grant_type=client_credentials&client_id=...&client_secret=...
  Response: { access_token: "eyJ...", token_type: "Bearer", expires_in: 3600 }

Authorization: Bearer eyJ...   (replaces X-API-Key in auth flow)
```
Table `api_clients` mirrors `api_keys` but stores `client_id` + `hashed_client_secret`.
Both auth mechanisms coexist indefinitely.

---

### Decision 3: RFC 7807 (application/problem+json) as error format

All API errors return RFC 7807 Problem Details.

**Rationale:**
- Machine-readable: clients can branch on `type` without parsing `message` strings.
- Standard: adopted by Spring Boot, ASP.NET Core, GitHub API.
- Extensible: `errors` array field added for validation errors (400).

```json
{
  "type":     "https://api.nextai.com.br/errors/validation_error",
  "title":    "Validation Error",
  "status":   400,
  "detail":   "2 fields failed validation.",
  "instance": "/api/v1/orders",
  "errors": [
    { "field": "client_id", "message": "Required." },
    { "field": "status",    "message": "Invalid value. Allowed: draft, pending_review." }
  ]
}
```

---

### Decision 4: Cursor pagination over offset pagination

All list endpoints use opaque base64 cursor encoding `{ id, created_at }`.

**Rationale:**
- Offset pagination is O(n) in PostgreSQL: `OFFSET 50000` forces a sequential scan of 50k rows.
- Cursor pagination is O(log n) via index seek on `(created_at DESC, id DESC)`.
- Consistent under concurrent inserts: new rows don't shift existing pages.
- Stable for long-running sync jobs: ERP can resume interrupted sync without gaps.

**Composite cursor (mandatory from Patch 2):**

Single-field cursor on `created_at` alone loses records when multiple rows share the same
timestamp (batch inserts, triggers). The correct pattern:

```typescript
// Encodes last item:
btoa(JSON.stringify({ id: item.id, created_at: item.created_at }))

// Query:
.or(`created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`)
```

**No total count by default:** Counting large tables is expensive. Clients receive `has_more`
boolean. `X-Total-Count` header added in Sprint I via separate `COUNT(*)` query, opt-in via
`?count=exact` parameter.

---

### Decision 5: HMAC-SHA256 webhook signing

Every webhook delivery is signed with `X-NextAI-Signature: sha256=<hex>`.

**Rationale:**
- Same model as Stripe and GitHub — widely understood by developers.
- Simpler than mutual TLS while providing strong authenticity guarantee.
- Receiver can verify without network call: `hmac(secret, body) === signature`.
- Secret is generated server-side at endpoint creation and shown once (never stored in plaintext).

**Verification example (receiver side):**
```typescript
const sig  = req.headers['x-nextai-signature']; // "sha256=abc123..."
const body = await req.text();
const expected = `sha256=${hmacSha256(secret, body)}`;
if (!timingSafeEqual(sig, expected)) return res.status(401).send('Invalid signature');
```

**Known gap:** Secret rotation without downtime (zero-downtime rotation) is Sprint I scope.
Current workaround: delete + recreate endpoint (causes delivery interruption).

---

### Decision 6: Rate limiting via Deno KV (sliding window per hour)

1000 requests/hour per API key, enforced in the Edge Function via Deno KV.

**Rationale:**
- Deno KV is available natively in Supabase Edge Functions (no external Redis needed).
- Per-key rate limiting (not per-IP) aligns with the API key model.
- 1000/hr covers 90% of use cases at MVP stage.

**Known gap:** 1000/hr is insufficient for enterprise ERP batch jobs. Sprint I delivers tiered
limits (Basic: 1k/hr, Pro: 10k/hr, Enterprise: 100k/hr) configurable per `api_key` row.

---

### Decision 7: Service role + field whitelisting (not RLS on public schema)

API gateway uses `service_role` client to bypass per-user RLS (which is designed for the app's
own authenticated users, not API keys).

Tenant isolation is enforced by:
1. Resolving `team_id` from the validated API key (in the gateway, before any query).
2. Injecting `team_id` explicitly in every INSERT/SELECT.
3. **Whitelisting** accepted fields in every write endpoint (prevents field injection).

**Critical rule:** Never `insert({ ...body, team_id })` without first running `pick(body, ALLOWED_FIELDS)`.
The service_role client is unconditionally trusted by Postgres — field injection via the spread
operator is a real vulnerability. See CLAUDE.md § "Vulnerabilidade 1 — Field Injection".

---

## ERP Integration Path

### Phase A: Webhook-first (Sprint G — done)
ERPs subscribe to events (`order.completed`, `reimbursement.paid`, etc.) and react.
No polling required. NextAI pushes. Best for read-heavy ERP scenarios.

### Phase B: Full CRUD API (Sprint G Patch 2 + Sprint I)
ERPs can create/update records bidirectionally.
Delta sync via `?updated_after=` enables incremental nightly jobs.

### Phase C: OAuth 2.0 (Sprint I)
Replaces API key for enterprise clients with corporate security policies.
Token-based, short-lived (1h), non-interactive (client credentials flow).

### Phase D: ERP Adapters (Sprint J)
Each ERP speaks its own protocol:
- **TOTVS Fluig**: REST + OAuth 2.0 TOTVS auth → NextAI bridge adapter
- **SAP S/4HANA**: OData v4 → REST translation layer + SAP field mapping
- **Omie**: `app_key` + `app_secret` → X-API-Key bridge

These are **translation layers**, not core API changes. Core API remains ERP-agnostic.

---

## Consequences

**Positive:**
- Simple integrations (Zapier, n8n, custom scripts) work today with minimal setup.
- Webhook-first model means ERP integration begins as soon as Sprint G is live.
- Phased delivery allows early validation before investing in full enterprise complexity.

**Negative / Known Gaps:**
- OAuth 2.0 absence may block enterprise sales in regulated sectors.
- Rate limit of 1000/hr blocks any meaningful ERP batch sync today.
- No OpenAPI spec means partners cannot auto-generate clients.
- Field injection vulnerability (Patch 2) must be fixed before external exposure.

**Mitigations:**
- All gaps are scheduled with explicit sprint targets (Patch 2, I, J).
- No external developer access until Patch 2 is shipped.
- Enterprise sales conversations should be conditional on Sprint I delivery timeline.
