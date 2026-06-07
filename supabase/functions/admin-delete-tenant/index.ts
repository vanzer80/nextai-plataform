import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// FKs são ON DELETE SET NULL; apagamos explicitamente no hard delete para não deixar registros órfãos com team_id nulo.
const ORPHAN_PURGE_TABLES = [
  "service_reports",
  "clients",
  "orcamentos",
  "equipments",
  "material_requests",
  "notifications",
  "checklist_templates",
  "reimbursements",
  "sites",
] as const;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Nao autorizado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Valida JWT do caller — armadilha #12: nunca comparar com apikey
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser();
  if (authError || !callerUser) {
    return new Response(JSON.stringify({ error: "Token invalido." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: callerProfile, error: profileError } = await callerClient
    .from("users")
    .select("role, team_id")
    .eq("id", callerUser.id)
    .maybeSingle();

  if (profileError || !callerProfile) {
    return new Response(JSON.stringify({ error: "Perfil nao encontrado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verifica se caller é SuperMaster: role=Master E tenant.is_platform=true
  const { data: callerTenant } = await supabaseAdmin
    .from("tenants")
    .select("is_platform")
    .eq("id", callerProfile.team_id)
    .maybeSingle();

  const isSuperMaster = callerProfile.role === "Master" && callerTenant?.is_platform === true;
  if (!isSuperMaster) {
    return new Response(JSON.stringify({ error: "Permissao negada. Apenas SuperMaster pode deletar tenants." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { tenantId?: string; confirmSlug?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { tenantId, confirmSlug } = body;
  if (!tenantId || typeof tenantId !== "string") {
    return new Response(JSON.stringify({ error: "tenantId e obrigatorio." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!confirmSlug || typeof confirmSlug !== "string") {
    return new Response(JSON.stringify({ error: "confirmSlug e obrigatorio." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Bloqueia auto-deleção
  if (tenantId === callerProfile.team_id) {
    return new Response(JSON.stringify({ error: "Nao e possivel deletar o proprio tenant." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Busca o tenant alvo via service_role
  const { data: targetTenant, error: tenantError } = await supabaseAdmin
    .from("tenants")
    .select("id, name, slug, is_platform")
    .eq("id", tenantId)
    .maybeSingle();

  if (tenantError || !targetTenant) {
    return new Response(JSON.stringify({ error: "Tenant nao encontrado." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Defesa em profundidade: validar slug no servidor também
  if (confirmSlug !== targetTenant.slug) {
    return new Response(JSON.stringify({ error: "Slug de confirmacao incorreto." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Bloqueia deleção do tenant da plataforma
  if (targetTenant.is_platform) {
    return new Response(JSON.stringify({ error: "Nao e possivel deletar o tenant da plataforma." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ── Sequência de deleção ─────────────────────────────────────────────────────

  // (0) Marcar tenant como soft-deleted antes de qualquer operação destrutiva.
  // Se a função crashar no meio, o tenant sai da listagem normal em vez de ficar como "zumbi ativo".
  await supabaseAdmin
    .from("tenants")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", tenantId);

  // (a) Listar e deletar usuários do tenant em auth.users
  const { data: tenantUsers, error: usersError } = await supabaseAdmin
    .from("users")
    .select("id")
    .eq("team_id", tenantId);

  if (usersError) {
    console.error(`[admin-delete-tenant] Erro ao listar usuarios do tenant ${tenantId}:`, usersError.message);
    return new Response(JSON.stringify({ error: "Erro ao listar usuarios do tenant." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userIds = (tenantUsers ?? []).map((u: { id: string }) => u.id);
  let deletedUserCount = 0;

  for (const uid of userIds) {
    const { error: deleteUserError } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (deleteUserError) {
      console.warn(`[admin-delete-tenant] Falha ao deletar usuario ${uid}:`, deleteUserError.message);
    } else {
      deletedUserCount++;
    }
  }

  // (b) Deletar registros em tabelas com ON DELETE SET NULL antes do tenant
  for (const table of ORPHAN_PURGE_TABLES) {
    const { error: deleteTableError } = await supabaseAdmin
      .from(table)
      .delete()
      .eq("team_id", tenantId);

    if (deleteTableError) {
      console.warn(`[admin-delete-tenant] Aviso ao limpar ${table}:`, deleteTableError.message);
    }
  }

  // (c) Remover arquivos do Storage: tenant-assets/{slug}/
  const { data: storageFiles, error: listError } = await supabaseAdmin.storage
    .from("tenant-assets")
    .list(targetTenant.slug);

  if (!listError && storageFiles && storageFiles.length > 0) {
    const paths = storageFiles.map((f: { name: string }) => `${targetTenant.slug}/${f.name}`);
    const { error: removeError } = await supabaseAdmin.storage
      .from("tenant-assets")
      .remove(paths);
    if (removeError) {
      console.warn(`[admin-delete-tenant] Aviso ao remover arquivos de storage:`, removeError.message);
    }
  }

  // (d) Deletar o tenant — ON DELETE CASCADE apaga as tabelas filhas restantes
  const { error: deleteTenantError } = await supabaseAdmin
    .from("tenants")
    .delete()
    .eq("id", tenantId);

  if (deleteTenantError) {
    console.error(`[admin-delete-tenant] Erro ao deletar tenant ${tenantId}:`, deleteTenantError.message);
    return new Response(JSON.stringify({ error: "Erro ao deletar tenant: " + deleteTenantError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // (e) Registrar na auditoria (após deleção — tenant_id sem FK)
  const { error: auditError } = await supabaseAdmin.from("tenant_deletion_log").insert({
    tenant_id: tenantId,
    tenant_slug: targetTenant.slug,
    tenant_name: targetTenant.name,
    operation: "hard",
    deleted_by: callerUser.id,
    user_count: userIds.length,
  });
  if (auditError) {
    console.error(`[admin-delete-tenant] FALHA ao registrar auditoria para "${targetTenant.slug}":`, auditError.message);
  }

  console.log(
    `[admin-delete-tenant] Tenant "${targetTenant.name}" (${targetTenant.slug}) deletado permanentemente. ` +
    `Usuarios: ${deletedUserCount}/${userIds.length}. ` +
    `Caller: ${callerUser.id} (${callerProfile.role}, team:${callerProfile.team_id})`
  );

  return new Response(
    JSON.stringify({ success: true, deletedUsers: deletedUserCount }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
