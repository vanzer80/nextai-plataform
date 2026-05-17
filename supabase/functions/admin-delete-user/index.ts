import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ["Master", "Admin"];

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

  // Busca role E team_id do caller
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

  if (!ALLOWED_ROLES.includes(callerProfile.role)) {
    return new Response(JSON.stringify({ error: "Permissao negada. Apenas Master ou Admin." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { userId } = body;
  if (!userId || typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "userId e obrigatorio." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (callerUser.id === userId) {
    return new Response(JSON.stringify({ error: "Nao e possivel excluir sua propria conta." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Valida que o usuário alvo pertence ao mesmo tenant do caller.
  // Usa service_role para garantir leitura mesmo com RLS (a validação é feita aqui).
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: targetProfile, error: targetError } = await supabaseAdmin
    .from("users")
    .select("team_id, role")
    .eq("id", userId)
    .maybeSingle();

  if (targetError || !targetProfile) {
    return new Response(JSON.stringify({ error: "Usuario alvo nao encontrado." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verifica se caller é SuperMaster (tenant is_platform=true)
  const { data: callerTenant } = await supabaseAdmin
    .from("tenants")
    .select("is_platform")
    .eq("id", callerProfile.team_id)
    .maybeSingle();

  const isSuperMaster = callerProfile.role === "Master" && callerTenant?.is_platform === true;

  // Bloqueia cross-tenant: apenas SuperMaster pode excluir de outros tenants
  if (!isSuperMaster && targetProfile.team_id !== callerProfile.team_id) {
    console.warn(
      `[admin-delete-user] BLOQUEADO: caller ${callerUser.id} (team:${callerProfile.team_id}) ` +
      `tentou excluir ${userId} (team:${targetProfile.team_id})`
    );
    return new Response(JSON.stringify({ error: "Permissao negada. Usuario pertence a outro tenant." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);

  if (deleteError) {
    console.error(`[admin-delete-user] Falha ao excluir ${userId}:`, deleteError.message);
    const isNotFound = deleteError.message?.toLowerCase().includes("not found");
    return new Response(JSON.stringify({ error: deleteError.message }), {
      status: isNotFound ? 404 : 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(
    `[admin-delete-user] Usuario ${userId} (team:${targetProfile.team_id}) ` +
    `excluido por ${callerUser.id} (${callerProfile.role}, team:${callerProfile.team_id})`
  );

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
