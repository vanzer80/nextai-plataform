// api-gateway v1 — NextAI Public API
// Validates X-API-Key, rate-limits (1000 req/hr per key), logs access, routes to resource handlers.
// Error format: RFC 7807 (application/problem+json)
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

  // 4. Idempotency (POST / PATCH) ───────────────────────────────────────────────
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

  // 5. Route ────────────────────────────────────────────────────────────────────
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
      const limit      = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
      const cursor     = url.searchParams.get("cursor");
      const filterSt   = url.searchParams.get("filter[status]");
      const teamId     = apiKey.team_id;

      let q = admin.from("service_reports")
        .select("id, os_number, status, client_id, technician_id, service_date, created_at")
        .eq("team_id", teamId).order("created_at", { ascending: false }).limit(limit + 1);
      if (filterSt) q = q.eq("status", filterSt);
      if (cursor) { const c = parseCursor(cursor); if (c) q = q.lt("created_at", c.created_at); }

      const { data, error } = await q;
      if (error) throw error;
      const hasMore  = (data?.length ?? 0) > limit;
      const items    = (data ?? []).slice(0, limit);
      const nextCur  = hasMore && items.length > 0
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
      if (!data) { statusCode = 404; responseBody = { type: `https://api.nextai.com.br/errors/not_found`, status: 404, detail: `Order ${id} not found.`, instance }; }
      else responseBody = data;
    }

    // POST /orders ─────────────────────────────────────────────────────────────
    else if (req.method === "POST" && path === "/orders") {
      const err = needScope("orders:write"); if (err) return endRequest(err);
      const body = await req.json();
      const { data, error } = await admin.from("service_reports")
        .insert({ ...body, team_id: apiKey.team_id, status: body.status ?? "draft" })
        .select("id, os_number, status, created_at").single();
      if (error) throw error;
      statusCode = 201; responseBody = data;
      await cacheIdempotency("POST", "/orders", 201, data);
    }

    // PATCH /orders/:id ────────────────────────────────────────────────────────
    else if (req.method === "PATCH" && /^\/orders\/[^/]+$/.test(path)) {
      const err = needScope("orders:write"); if (err) return endRequest(err);
      const id = path.split("/")[2];
      const body = await req.json();
      const { data, error } = await admin.from("service_reports")
        .update(body).eq("id", id).eq("team_id", apiKey.team_id)
        .select("id, os_number, status, updated_at").maybeSingle();
      if (error) throw error;
      if (!data) { statusCode = 404; responseBody = { status: 404, detail: `Order ${id} not found.` }; }
      else { responseBody = data; await cacheIdempotency("PATCH", `/orders/${id}`, 200, data); }
    }

    // GET /reimbursements ──────────────────────────────────────────────────────
    else if (req.method === "GET" && path === "/reimbursements") {
      const err = needScope("reimbursements:read"); if (err) return endRequest(err);
      const limit  = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
      const cursor = url.searchParams.get("cursor");
      let q = admin.from("reimbursements")
        .select("id, category, amount, status, description, created_at, users!inner(team_id)")
        .eq("users.team_id", apiKey.team_id)
        .order("created_at", { ascending: false }).limit(limit + 1);
      if (cursor) { const c = parseCursor(cursor); if (c) q = q.lt("created_at", c.created_at); }
      const { data, error } = await q;
      if (error) throw error;
      const hasMore = (data?.length ?? 0) > limit;
      const items   = (data ?? []).slice(0, limit).map(({ users: _u, ...r }) => r);
      responseBody = { data: items, pagination: { cursor: hasMore && items.length > 0 ? paginationCursor(items[items.length-1].id, items[items.length-1].created_at) : null, has_more: hasMore, limit } };
    }

    // GET /clients ─────────────────────────────────────────────────────────────
    else if (req.method === "GET" && path === "/clients") {
      const err = needScope("clients:read"); if (err) return endRequest(err);
      const limit  = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
      const cursor = url.searchParams.get("cursor");
      let q = admin.from("clients")
        .select("id, name, cnpj, email, phone, cidade, estado, created_at")
        .eq("team_id", apiKey.team_id).order("created_at", { ascending: false }).limit(limit + 1);
      if (cursor) { const c = parseCursor(cursor); if (c) q = q.lt("created_at", c.created_at); }
      const { data, error } = await q;
      if (error) throw error;
      const hasMore = (data?.length ?? 0) > limit;
      const items   = (data ?? []).slice(0, limit);
      responseBody = { data: items, pagination: { cursor: hasMore && items.length > 0 ? paginationCursor(items[items.length-1].id, items[items.length-1].created_at) : null, has_more: hasMore, limit } };
    }

    // POST /clients ────────────────────────────────────────────────────────────
    else if (req.method === "POST" && path === "/clients") {
      const err = needScope("clients:write"); if (err) return endRequest(err);
      const body = await req.json();
      const { data, error } = await admin.from("clients")
        .insert({ ...body, team_id: apiKey.team_id }).select("id, name, created_at").single();
      if (error) throw error;
      statusCode = 201; responseBody = data;
    }

    // GET /quotes ──────────────────────────────────────────────────────────────
    else if (req.method === "GET" && path === "/quotes") {
      const err = needScope("quotes:read"); if (err) return endRequest(err);
      const limit  = Math.min(Number(url.searchParams.get("limit") ?? "50"), 100);
      const cursor = url.searchParams.get("cursor");
      let q = admin.from("orcamentos")
        .select("id, status, titulo, client_id, signed_at, validade, desconto_pct, created_at")
        .eq("team_id", apiKey.team_id).order("created_at", { ascending: false }).limit(limit + 1);
      if (cursor) { const c = parseCursor(cursor); if (c) q = q.lt("created_at", c.created_at); }
      const { data, error } = await q;
      if (error) throw error;
      const hasMore = (data?.length ?? 0) > limit;
      const items   = (data ?? []).slice(0, limit);
      responseBody = { data: items, pagination: { cursor: hasMore && items.length > 0 ? paginationCursor(items[items.length-1].id, items[items.length-1].created_at) : null, has_more: hasMore, limit } };
    }

    // 404 ──────────────────────────────────────────────────────────────────────
    else {
      statusCode = 404;
      responseBody = { type: "https://api.nextai.com.br/errors/not_found", status: 404, detail: `Route ${req.method} ${path} not found.`, instance };
    }

  } catch (e) {
    console.error("api-gateway error:", e);
    statusCode   = 500;
    responseBody = { type: "https://api.nextai.com.br/errors/internal_error", status: 500, detail: "An unexpected error occurred.", instance };
  }

  const duration = Date.now() - startMs;

  // 6. Log access (fire-and-forget) ─────────────────────────────────────────────
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
