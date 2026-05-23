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

  const supabaseUrl      = Deno.env.get("SUPABASE_URL")!;
  const anonKey          = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Valida o caller via JWT
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

  // Busca perfil do caller (role + team_id)
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
    return new Response(JSON.stringify({ error: "Permissao negada. Apenas Master ou Admin podem redefinir senhas." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { userId?: string; new_password?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { userId, new_password } = body;

  if (!userId || typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "userId e obrigatorio." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!new_password || new_password.length < 6) {
    return new Response(JSON.stringify({ error: "new_password deve ter no minimo 6 caracteres." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Não permite redefinir a própria senha por esta rota (use o fluxo normal de perfil)
  if (callerUser.id === userId) {
    return new Response(JSON.stringify({ error: "Use as configuracoes de perfil para alterar sua propria senha." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Verifica se o caller é SuperMaster
  const { data: callerTenant } = await supabaseAdmin
    .from("tenants")
    .select("is_platform")
    .eq("id", callerProfile.team_id)
    .maybeSingle();

  const isSuperMaster = callerProfile.role === "Master" && callerTenant?.is_platform === true;

  // Busca o usuário alvo para validar tenant
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

  // Bloqueia cross-tenant (exceto SuperMaster)
  if (!isSuperMaster && targetProfile.team_id !== callerProfile.team_id) {
    console.warn(
      `[admin-reset-password] BLOQUEADO: caller ${callerUser.id} (team:${callerProfile.team_id}) ` +
      `tentou redefinir senha de ${userId} (team:${targetProfile.team_id})`
    );
    return new Response(JSON.stringify({ error: "Permissao negada. Usuario pertence a outro tenant." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Redefine a senha via service_role
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: new_password,
  });

  if (updateError) {
    console.error(`[admin-reset-password] Falha ao redefinir senha de ${userId}:`, updateError.message);
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(
    `[admin-reset-password] Senha de ${userId} (team:${targetProfile.team_id}) ` +
    `redefinida por ${callerUser.id} (${callerProfile.role}, team:${callerProfile.team_id})`
  );

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
