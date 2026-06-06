// api-gateway v2 — NextAI Public API
// Validates X-API-Key, rate-limits (1000 req/hr per key), logs access, routes to resource handlers.
// Error format: RFC 7807 (application/problem+json)
// Patch 2: field injection whitelist · input validation · composite cursor pagination ·
//          direct team_id filter on reimbursements · consistent { data } envelope ·
//          GET by ID for all resources · PATCH /clients · idempotency for POST /clients ·
//          Content-Type validation (415) · updated_after delta sync on /orders.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const API_RATE_LIMIT     = 1000;
const API_RATE_WINDOW_MS = 3_600_000; // 1 hour

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type, idempotency-key",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
};

// ── Field whitelists (Fix 1 — field injection: service_role bypasses RLS, so every
//    INSERT/UPDATE from a public endpoint must restrict to known-safe columns only) ──

const ALLOWED_CREATE_ORDER  = ["client_id","technician_id","service_date","reported_problem","status"] as const;
const ALLOWED_PATCH_ORDER   = ["status","technician_id","service_date","reported_problem","final_diagnosis","services_performed"] as const;
const ALLOWED_CREATE_CLIENT = ["name","cnpj","email","phone","cidade","estado"] as const;
const ALLOWED_PATCH_CLIENT  = ["name","cnpj","email","phone","cidade","estado"] as const;
const ORDER_STATUSES        = ["draft","pending_review","returned","approved","rejected"] as const;

// ── Utilities ──────────────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function rfc7807(status: number, code: string, detail: string, instance: string): Response {
  const title = code.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return new Response(
    JSON.stringify({ type: `https://api.nextai.com.br/errors/${code}`, title, status, detail, instance }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } },
  );
}

function pick(obj: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> {
  return Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));
}

interface ValidationError { field: string; message: string }

function validationResponse(errors: ValidationError[], instance: string): Response {
  return new Response(JSON.stringify({
    type:   "https://api.nextai.com.br/errors/validation_error",
    title:  "Validation Error",
    status: 400,
    errors,
    instance,
  }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } });
}

function validateCreateOrder(body: unknown): ValidationError[] {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return [{ field: "body", message: "Must be a JSON object." }];
  const b = body as Record<string, unknown>;
  const errs: ValidationError[] = [];
  if (!b.client_id)                                              errs.push({ field: "client_id",     message: "Required." });
  if (b.client_id    && typeof b.client_id    !== "string")      errs.push({ field: "client_id",     message: "Must be a UUID string." });
  if (b.technician_id && typeof b.technician_id !== "string")    errs.push({ field: "technician_id", message: "Must be a UUID string." });
  if (b.service_date  && typeof b.service_date  !== "string")    errs.push({ field: "service_date",  message: "Must be a date string." });
  if (b.status && !ORDER_STATUSES.includes(b.status as never))   errs.push({ field: "status",        message: `Must be one of: ${ORDER_STATUSES.join(", ")}.` });
  return errs;
}

function validatePatchOrder(body: unknown): ValidationError[] {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return [{ field: "body", message: "Must be a JSON object." }];
  const b = body as Record<string, unknown>;
  const errs: ValidationError[] = [];
  if (Object.keys(b).length === 0)                               errs.push({ field: "body",          message: "At least one field required." });
  if (b.status && !ORDER_STATUSES.includes(b.status as never))   errs.push({ field: "status",        message: `Must be one of: ${ORDER_STATUSES.join(", ")}.` });
  if (b.technician_id && typeof b.technician_id !== "string")    errs.push({ field: "technician_id", message: "Must be a UUID string." });
  return errs;
}

function validateCreateClient(body: unknown): ValidationError[] {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return [{ field: "body", message: "Must be a JSON object." }];
  const b = body as Record<string, unknown>;
  const errs: ValidationError[] = [];
  if (!b.name)                                    errs.push({ field: "name",  message: "Required." });
  if (b.name  && typeof b.name  !== "string")     errs.push({ field: "name",  message: "Must be a string." });
  if (b.email && typeof b.email !== "string")     errs.push({ field: "email", message: "Must be a string." });
  return errs;
}

function validatePatchClient(body: unknown): ValidationError[] {
  if (!body || typeof body !== "object" || Array.isArray(body))
    return [{ field: "body", message: "Must be a JSON object." }];
  const b = body as Record<string, unknown>;
  const errs: ValidationError[] = [];
  if (Object.keys(b).length === 0)                errs.push({ field: "body",  message: "At least one field required." });
  if (b.name  && typeof b.name  !== "string")     errs.push({ field: "name",  message: "Must be a string." });
  if (b.email && typeof b.email !== "string")     errs.push({ field: "email", message: "Must be a string." });
  return errs;
}

function paginationCursor(id: string, createdAt: string): string {
  return btoa(JSON.stringify({ id, created_at: createdAt }));
}
function parseCursor(c: string): { id: string; created_at: string } | null {
  try { return JSON.parse(atob(c)); } catch { return null; }
}

async function checkRateLimit(
  keyId: string,
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const kv     = await Deno.openKv();
  const window = Math.floor(Date.now() / API_RATE_WINDOW_MS);
  const kvKey  = ["rl_api", keyId, window];
  const entry  = await kv.get<number>(kvKey);
  const count  = (entry.value ?? 0) + 1;
  const resetAt = (window + 1) * API_RATE_WINDOW_MS;
  if (count > API_RATE_LIMIT) return { allowed: false, remaining: 0, resetAt };
  await kv.set(kvKey, count, { expireIn: API_RATE_WINDOW_MS * 2 });
  return { allowed: true, remaining: API_RATE_LIMIT - count, resetAt };
}

// ── Main handler ───────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url      = new URL(req.url);
  const rawPath  = url.pathname;
  // Strip function prefix: /api-gateway/api/v1/... → /api/v1/...
  const path     = rawPath.replace(/^\/api-gateway/, "").replace(/^\/api\/v1/, "");
  const instance = `/api/v1${path}`;
  const startMs  = Date.now();

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Validate API key ──────────────────────────────────────────────────────────
  const rawKey = req.headers.get("X-API-Key") ?? req.headers.get("x-api-key");
  if (!rawKey) return rfc7807(401, "missing_api_key", "X-API-Key header is required.", instance);

  const keyHash = await sha256hex(rawKey);
  const { data: apiKey } = await admin
    .from("api_keys")
    .select("id, team_id, scopes, is_active, expires_at")
    .eq("key_hash", keyHash)
    .maybeSingle();

  if (!apiKey)           return rfc7807(401, "invalid_api_key",   "API key not found.", instance);
  if (!apiKey.is_active) return rfc7807(401, "api_key_revoked",   "API key has been revoked.", instance);
  if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
    return rfc7807(401, "api_key_expired", "API key has expired.", instance);
  }

  // 2. Rate limit ───────────────────────────────────────────────────────────────
  const { allowed, remaining, resetAt } = await checkRateLimit(apiKey.id);
  if (!allowed) return rfc7807(429, "rate_limit_exceeded", "1000 requests/hour limit exceeded.", instance);

  const rateHdrs = {
    "X-RateLimit-Limit":     String(API_RATE_LIMIT),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset":     String(Math.floor(resetAt / 1000)),
  };

  // 3. Scope helper ─────────────────────────────────────────────────────────────
  const scopes: string[] = apiKey.scopes ?? [];
  function needScope(scope: string): Response | null {
    return scopes.includes(scope) ? null
      : rfc7807(403, "insufficient_scope", `Scope '${scope}' required.`, instance);
  }

  // 4. Content-Type validation (POST / PATCH) ───────────────────────────────────
  if (["POST", "PATCH"].includes(req.method)) {
    const ct = req.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return rfc7807(415, "unsupported_media_type", "Content-Type must be application/json.", instance);
    }
  }

  // 5. Idempotency (POST / PATCH) ───────────────────────────────────────────────
  const idempKey = req.headers.get("Idempotency-Key");
  if (idempKey && ["POST", "PATCH"].includes(req.method)) {
    const { data: cached } = await admin
      .from("api_idempotency_keys")
      .select("status_code, response")
      .eq("key", idempKey)
      .eq("team_id", apiKey.team_id)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached) {
      return new Response(JSON.stringify(cached.response), {
        status: cached.status_code,
        headers: { ...corsHeaders, ...rateHdrs, "Content-Type": "application/json", "Idempotent-Replayed": "true" },
      });
    }
  }

  // 6. Route ────────────────────────────────────────────────────────────────────
  const ip           = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  let responseBody: unknown = null;
  let statusCode    = 200;

  async function cacheIdempotency(method: string, p: string, sc: number, body: unknown) {
    if (!idempKey) return;
    await admin.from("api_idempotency_keys").upsert({
      key: idempKey, team_id: apiKey.team_id, method, path: p, status_code: sc, response: body,
    });
  }

  try {

    // GET /orders ──────────────────────────────────────────────────────────────
    if (req.method === "GET" && path === "/orders") {
      const err = needScope("orders:read"); if (err) return endRequest(err);
      const limit        = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
      const cursor       = url.searchParams.get("cursor");
      const filterSt     = url.searchParams.get("filter[status]");
      const updatedAfter = url.searchParams.get("updated_after");

      if (updatedAfter) {
        const ts = new Date(updatedAfter);
        if (isNaN(ts.getTime())) {
          return endRequest(rfc7807(400, "invalid_parameter", "'updated_after' must be an ISO 8601 datetime.", instance));
        }
      }

      let q = admin.from("service_reports")
        .select("id, os_number, status, client_id, technician_id, service_date, created_at, updated_at")
        .eq("team_id", apiKey.team_id)
        .order("created_at", { ascending: false })
        .order("id",         { ascending: false })
        .limit(limit + 1);
      if (filterSt)    q = q.eq("status", filterSt);
      if (updatedAfter) q = q.gte("updated_at", new Date(updatedAfter).toISOString());
      if (cursor) {
        const c = parseCursor(cursor);
        // Composite cursor prevents skipping records with identical created_at (batch inserts).
        if (c) q = q.or(`created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`);
      }

      const { data, error } = await q;
      if (error) throw error;
      const hasMore = (data?.length ?? 0) > limit;
      const items   = (data ?? []).slice(0, limit);
      const nextCur = hasMore && items.length > 0
        ? paginationCursor(items[items.length - 1].id, items[items.length - 1].created_at) : null;
      responseBody = { data: items, pagination: { cursor: nextCur, has_more: hasMore, limit } };
    }

    // GET /orders/:id ──────────────────────────────────────────────────────────
    else if (req.method === "GET" && /^\/orders\/[^/]+$/.test(path)) {
      const err = needScope("orders:read"); if (err) return endRequest(err);
      const id = path.split("/")[2];
      const { data, error } = await admin.from("service_reports")
        .select("id, os_number, status, client_id, technician_id, service_date, reported_problem, final_diagnosis, services_performed, created_at, updated_at")
        .eq("id", id).eq("team_id", apiKey.team_id).maybeSingle();
      if (error) throw error;
      if (!data) {
        statusCode   = 404;
        responseBody = { type: "https://api.nextai.com.br/errors/not_found", title: "Not Found", status: 404, detail: `Order ${id} not found.`, instance };
      } else {
        responseBody = { data };
      }
    }

    // POST /orders ─────────────────────────────────────────────────────────────
    else if (req.method === "POST" && path === "/orders") {
      const err = needScope("orders:write"); if (err) return endRequest(err);
      const body = await req.json();
      const errs = validateCreateOrder(body);
      if (errs.length > 0) return endRequest(validationResponse(errs, instance));
      const safe = pick(body as Record<string, unknown>, ALLOWED_CREATE_ORDER);
      const { data, error } = await admin.from("service_reports")
        .insert({ ...safe, team_id: apiKey.team_id, status: (safe.status as string) ?? "draft" })
        .select("id, os_number, status, created_at").single();
      if (error) throw error;
      statusCode   = 201;
      responseBody = { data };
      await cacheIdempotency("POST", "/orders", 201, { data });
    }

    // PATCH /orders/:id ────────────────────────────────────────────────────────
    else if (req.method === "PATCH" && /^\/orders\/[^/]+$/.test(path)) {
      const err = needScope("orders:write"); if (err) return endRequest(err);
      const id   = path.split("/")[2];
      const body = await req.json();
      const errs = validatePatchOrder(body);
      if (errs.length > 0) return endRequest(validationResponse(errs, instance));
      const safe = pick(body as Record<string, unknown>, ALLOWED_PATCH_ORDER);
      const { data, error } = await admin.from("service_reports")
        .update(safe).eq("id", id).eq("team_id", apiKey.team_id)
        .select("id, os_number, status, updated_at").maybeSingle();
      if (error) throw error;
      if (!data) {
        statusCode   = 404;
        responseBody = { type: "https://api.nextai.com.br/errors/not_found", title: "Not Found", status: 404, detail: `Order ${id} not found.`, instance };
      } else {
        responseBody = { data };
        await cacheIdempotency("PATCH", `/orders/${id}`, 200, { data });
      }
    }

    // GET /reimbursements ──────────────────────────────────────────────────────
    else if (req.method === "GET" && path === "/reimbursements") {
      const err = needScope("reimbursements:read"); if (err) return endRequest(err);
      const limit  = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
      const cursor = url.searchParams.get("cursor");
      // team_id is on the reimbursements table directly — no join needed.
      // Using !inner + users.team_id filter loses records when the user is deleted.
      let q = admin.from("reimbursements")
        .select("id, category, amount, status, description, created_at")
        .eq("team_id", apiKey.team_id)
        .order("created_at", { ascending: false })
        .order("id",         { ascending: false })
        .limit(limit + 1);
      if (cursor) {
        const c = parseCursor(cursor);
        if (c) q = q.or(`created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`);
      }
      const { data, error } = await q;
      if (error) throw error;
      const hasMore = (data?.length ?? 0) > limit;
      const items   = (data ?? []).slice(0, limit);
      responseBody  = {
        data: items,
        pagination: {
          cursor:   hasMore && items.length > 0 ? paginationCursor(items[items.length - 1].id, items[items.length - 1].created_at) : null,
          has_more: hasMore,
          limit,
        },
      };
    }

    // GET /reimbursements/:id ──────────────────────────────────────────────────
    else if (req.method === "GET" && /^\/reimbursements\/[^/]+$/.test(path)) {
      const err = needScope("reimbursements:read"); if (err) return endRequest(err);
      const id = path.split("/")[2];
      const { data, error } = await admin.from("reimbursements")
        .select("id, category, amount, status, description, created_at, updated_at")
        .eq("id", id).eq("team_id", apiKey.team_id).maybeSingle();
      if (error) throw error;
      if (!data) {
        statusCode   = 404;
        responseBody = { type: "https://api.nextai.com.br/errors/not_found", title: "Not Found", status: 404, detail: `Reimbursement ${id} not found.`, instance };
      } else {
        responseBody = { data };
      }
    }

    // GET /clients ─────────────────────────────────────────────────────────────
    else if (req.method === "GET" && path === "/clients") {
      const err = needScope("clients:read"); if (err) return endRequest(err);
      const limit  = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
      const cursor = url.searchParams.get("cursor");
      let q = admin.from("clients")
        .select("id, name, cnpj, email, phone, cidade, estado, created_at")
        .eq("team_id", apiKey.team_id)
        .order("created_at", { ascending: false })
        .order("id",         { ascending: false })
        .limit(limit + 1);
      if (cursor) {
        const c = parseCursor(cursor);
        if (c) q = q.or(`created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`);
      }
      const { data, error } = await q;
      if (error) throw error;
      const hasMore = (data?.length ?? 0) > limit;
      const items   = (data ?? []).slice(0, limit);
      responseBody  = {
        data: items,
        pagination: {
          cursor:   hasMore && items.length > 0 ? paginationCursor(items[items.length - 1].id, items[items.length - 1].created_at) : null,
          has_more: hasMore,
          limit,
        },
      };
    }

    // GET /clients/:id ─────────────────────────────────────────────────────────
    else if (req.method === "GET" && /^\/clients\/[^/]+$/.test(path)) {
      const err = needScope("clients:read"); if (err) return endRequest(err);
      const id = path.split("/")[2];
      const { data, error } = await admin.from("clients")
        .select("id, name, cnpj, email, phone, cidade, estado, created_at")
        .eq("id", id).eq("team_id", apiKey.team_id).maybeSingle();
      if (error) throw error;
      if (!data) {
        statusCode   = 404;
        responseBody = { type: "https://api.nextai.com.br/errors/not_found", title: "Not Found", status: 404, detail: `Client ${id} not found.`, instance };
      } else {
        responseBody = { data };
      }
    }

    // POST /clients ────────────────────────────────────────────────────────────
    else if (req.method === "POST" && path === "/clients") {
      const err = needScope("clients:write"); if (err) return endRequest(err);
      const body = await req.json();
      const errs = validateCreateClient(body);
      if (errs.length > 0) return endRequest(validationResponse(errs, instance));
      const safe = pick(body as Record<string, unknown>, ALLOWED_CREATE_CLIENT);
      const { data, error } = await admin.from("clients")
        .insert({ ...safe, team_id: apiKey.team_id }).select("id, name, created_at").single();
      if (error) throw error;
      statusCode   = 201;
      responseBody = { data };
      await cacheIdempotency("POST", "/clients", 201, { data });
    }

    // PATCH /clients/:id ───────────────────────────────────────────────────────
    else if (req.method === "PATCH" && /^\/clients\/[^/]+$/.test(path)) {
      const err = needScope("clients:write"); if (err) return endRequest(err);
      const id   = path.split("/")[2];
      const body = await req.json();
      const errs = validatePatchClient(body);
      if (errs.length > 0) return endRequest(validationResponse(errs, instance));
      const safe = pick(body as Record<string, unknown>, ALLOWED_PATCH_CLIENT);
      const { data, error } = await admin.from("clients")
        .update(safe).eq("id", id).eq("team_id", apiKey.team_id)
        .select("id, name, created_at").maybeSingle();
      if (error) throw error;
      if (!data) {
        statusCode   = 404;
        responseBody = { type: "https://api.nextai.com.br/errors/not_found", title: "Not Found", status: 404, detail: `Client ${id} not found.`, instance };
      } else {
        responseBody = { data };
        await cacheIdempotency("PATCH", `/clients/${id}`, 200, { data });
      }
    }

    // GET /quotes ──────────────────────────────────────────────────────────────
    else if (req.method === "GET" && path === "/quotes") {
      const err = needScope("quotes:read"); if (err) return endRequest(err);
      const limit  = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
      const cursor = url.searchParams.get("cursor");
      let q = admin.from("orcamentos")
        .select("id, status, titulo, client_id, signed_at, validade, desconto_pct, created_at")
        .eq("team_id", apiKey.team_id)
        .order("created_at", { ascending: false })
        .order("id",         { ascending: false })
        .limit(limit + 1);
      if (cursor) {
        const c = parseCursor(cursor);
        if (c) q = q.or(`created_at.lt.${c.created_at},and(created_at.eq.${c.created_at},id.lt.${c.id})`);
      }
      const { data, error } = await q;
      if (error) throw error;
      const hasMore = (data?.length ?? 0) > limit;
      const items   = (data ?? []).slice(0, limit);
      responseBody  = {
        data: items,
        pagination: {
          cursor:   hasMore && items.length > 0 ? paginationCursor(items[items.length - 1].id, items[items.length - 1].created_at) : null,
          has_more: hasMore,
          limit,
        },
      };
    }

    // GET /quotes/:id ──────────────────────────────────────────────────────────
    else if (req.method === "GET" && /^\/quotes\/[^/]+$/.test(path)) {
      const err = needScope("quotes:read"); if (err) return endRequest(err);
      const id = path.split("/")[2];
      const { data, error } = await admin.from("orcamentos")
        .select("id, status, titulo, client_id, signed_at, validade, desconto_pct, report_id, created_at, updated_at")
        .eq("id", id).eq("team_id", apiKey.team_id).maybeSingle();
      if (error) throw error;
      if (!data) {
        statusCode   = 404;
        responseBody = { type: "https://api.nextai.com.br/errors/not_found", title: "Not Found", status: 404, detail: `Quote ${id} not found.`, instance };
      } else {
        responseBody = { data };
      }
    }

    // 404 ──────────────────────────────────────────────────────────────────────
    else {
      statusCode   = 404;
      responseBody = { type: "https://api.nextai.com.br/errors/not_found", title: "Not Found", status: 404, detail: `Route ${req.method} ${path} not found.`, instance };
    }

  } catch (e) {
    console.error("api-gateway error:", e);
    statusCode   = 500;
    responseBody = { type: "https://api.nextai.com.br/errors/internal_error", title: "Internal Error", status: 500, detail: "An unexpected error occurred.", instance };
  }

  const duration = Date.now() - startMs;

  // 7. Log access (fire-and-forget) ─────────────────────────────────────────────
  Promise.all([
    admin.from("api_access_log").insert({
      api_key_id: apiKey.id, team_id: apiKey.team_id,
      method: req.method, path: url.pathname,
      status_code: statusCode, duration_ms: duration, ip_address: ip,
    }),
    admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", apiKey.id),
  ]).catch(console.error);

  return new Response(responseBody ? JSON.stringify(responseBody) : null, {
    status: statusCode,
    headers: { ...corsHeaders, ...rateHdrs, "Content-Type": "application/json", "X-Response-Time": `${duration}ms` },
  });
});

function endRequest(r: Response): Response { return r; }
