import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function transformPath(bucket: string, oldPath: string, teamId: string): string | null {
  const parts = oldPath.split("/");

  if (bucket === "materials_media") {
    // {userId}/{file...} → {teamId}/materials/{userId}/{file...}
    return `${teamId}/materials/${oldPath}`;
  }

  if (bucket === "reimbursements_media") {
    // {userId}/{file...} → {teamId}/reimbursements/{userId}/{file...}
    return `${teamId}/reimbursements/${oldPath}`;
  }

  if (bucket === "reports_media") {
    if ((parts[0] === "attachments" || parts[0] === "signatures") && parts.length >= 3) {
      // attachments/{reportId}/{file} → {teamId}/reports/{reportId}/attachments/{file}
      // signatures/{reportId}/{file}  → {teamId}/reports/{reportId}/signatures/{file}
      const type = parts[0];
      const reportId = parts[1];
      const file = parts.slice(2).join("/");
      return `${teamId}/reports/${reportId}/${type}/${file}`;
    }
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Validar JWT do caller
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !caller) return json({ error: "Token inválido." }, 401);

  const { data: profile, error: profileErr } = await callerClient
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileErr || !profile) return json({ error: "Perfil não encontrado." }, 401);
  if (profile.role !== "Master") return json({ error: "Permissão negada. Apenas Master pode executar backfill." }, 403);

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 2. Buscar team_id do tenant Mopar
  const { data: tenant, error: tenantErr } = await supabaseAdmin
    .from("tenants")
    .select("id, slug")
    .eq("slug", "mopar")
    .maybeSingle();

  if (tenantErr || !tenant) return json({ error: "Tenant 'mopar' não encontrado." }, 404);

  const teamId = tenant.id as string;
  const buckets = ["materials_media", "reimbursements_media", "reports_media"];

  const storageResults: Record<string, { moved: number; skipped: number; failed: number; errors: string[] }> = {};
  let totalMoved = 0;
  let totalFailed = 0;

  // 3. Mover objetos legados para paths namespaceados por team_id
  for (const bucket of buckets) {
    const result = { moved: 0, skipped: 0, failed: 0, errors: [] as string[] };

    const { data: objects, error: listErr } = await supabaseAdmin
      .rpc("list_legacy_storage_objects", { p_bucket: bucket, p_team_id: teamId });

    if (listErr) {
      result.errors.push(`Erro ao listar: ${listErr.message}`);
      storageResults[bucket] = result;
      continue;
    }

    for (const obj of (objects ?? []) as { name: string }[]) {
      const newPath = transformPath(bucket, obj.name, teamId);

      if (!newPath) {
        result.skipped++;
        console.warn(`[backfill] formato desconhecido: ${bucket}/${obj.name}`);
        continue;
      }

      const { error: moveErr } = await supabaseAdmin.storage
        .from(bucket)
        .move(obj.name, newPath);

      if (moveErr) {
        result.failed++;
        result.errors.push(`${obj.name}: ${moveErr.message}`);
        console.error(`[backfill] falha ao mover ${bucket}/${obj.name} → ${newPath}: ${moveErr.message}`);
      } else {
        result.moved++;
        console.log(`[backfill] movido ${bucket}/${obj.name} → ${newPath}`);
      }
    }

    totalMoved += result.moved;
    totalFailed += result.failed;
    storageResults[bucket] = result;
  }

  // 4. Atualizar colunas *_url no banco para os novos paths
  const { data: dbResult, error: dbErr } = await supabaseAdmin
    .rpc("backfill_storage_paths", { p_team_id: teamId });

  if (dbErr) {
    console.error(`[backfill] falha no update DB: ${dbErr.message}`);
  }

  console.log(`[backfill] concluído por ${caller.id}: moved=${totalMoved} failed=${totalFailed}`);

  return json({
    success: totalFailed === 0 && !dbErr,
    teamId,
    slug: tenant.slug,
    storage: storageResults,
    db: dbErr ? { error: dbErr.message } : dbResult,
    summary: { totalMoved, totalFailed },
  });
});
