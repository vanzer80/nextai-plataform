// webhook-dispatcher v1 — processa entregas pendentes de webhook
// Pode ser chamada: (a) via botão "Disparar" no front-end; (b) via pg_cron a cada minuto.
// Body opcional: { "delivery_id": "<uuid>" } para forçar uma entrega específica.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Backoff por tentativa: imediato, 1min, 5min, 30min, 2h, 24h (morto após 5)
const RETRY_DELAYS_MS = [0, 60_000, 300_000, 1_800_000, 7_200_000, 86_400_000];
const BATCH_LIMIT     = 50;

async function hmacSha256(message: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Requer Authorization para evitar invocação anônima
  if (!req.headers.get("Authorization")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  const body: { delivery_id?: string } = req.method === "POST"
    ? await req.json().catch(() => ({}))
    : {};

  const now = new Date().toISOString();

  // Buscar entregas pendentes (ou específica)
  type DeliveryRow = {
    id: string;
    event_type: string;
    event_version: string;
    payload: Record<string, unknown>;
    attempts: number;
    webhook_endpoints: { url: string; secret: string };
  };

  let query = admin.from("webhook_deliveries")
    .select("id, event_type, event_version, payload, attempts, webhook_endpoints!inner(url, secret)")
    .eq("status", "pending")
    .or(`next_retry_at.is.null,next_retry_at.lte.${now}`)
    .order("created_at", { ascending: true })
    .limit(BATCH_LIMIT) as unknown as { data: DeliveryRow[] | null; error: { message: string } | null };

  if (body.delivery_id) {
    query = admin.from("webhook_deliveries")
      .select("id, event_type, event_version, payload, attempts, webhook_endpoints!inner(url, secret)")
      .eq("id", body.delivery_id)
      .limit(1) as unknown as { data: DeliveryRow[] | null; error: { message: string } | null };
  }

  const { data: deliveries, error: fetchErr } = await query;
  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500, headers: corsHeaders });
  }

  let processed = 0, succeeded = 0, failed = 0;

  for (const d of (deliveries ?? [])) {
    const ep         = d.webhook_endpoints;
    const payloadStr = JSON.stringify(d.payload);
    const signature  = `sha256=${await hmacSha256(payloadStr, ep.secret)}`;
    const newAttempts = d.attempts + 1;
    let delivered = false;
    let lastError = "";

    try {
      const res = await fetch(ep.url, {
        method:  "POST",
        headers: {
          "Content-Type":         "application/json",
          "X-NextAI-Signature":   signature,
          "X-NextAI-Event":       d.event_type,
          "X-NextAI-Event-Version": d.event_version,
          "X-NextAI-Delivery":    d.id,
        },
        body:   payloadStr,
        signal: AbortSignal.timeout(10_000),
      });
      delivered = res.status >= 200 && res.status < 300;
      if (!delivered) lastError = `HTTP ${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : "Timeout";
    }

    if (delivered) {
      await admin.from("webhook_deliveries").update({
        status: "delivered", attempts: newAttempts,
        delivered_at: new Date().toISOString(), last_error: null,
      }).eq("id", d.id);
      succeeded++;
    } else {
      const dead      = newAttempts >= 6;
      const nextRetry = !dead && newAttempts < RETRY_DELAYS_MS.length
        ? new Date(Date.now() + RETRY_DELAYS_MS[newAttempts]).toISOString()
        : null;
      await admin.from("webhook_deliveries").update({
        status: dead ? "dead" : "pending",
        attempts: newAttempts, last_error: lastError, next_retry_at: nextRetry,
      }).eq("id", d.id);
      failed++;
    }
    processed++;
  }

  return new Response(
    JSON.stringify({ processed, succeeded, failed }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
