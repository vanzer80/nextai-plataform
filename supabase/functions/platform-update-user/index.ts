import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

  const supabaseUrl    = Deno.env.get("SUPABASE_URL")!;
  const anonKey        = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Busca perfil do caller
  const { data: callerProfile } = await supabaseAdmin
    .from("users")
    .select("role, team_id")
    .eq("id", callerUser.id)
    .maybeSingle();

  if (!callerProfile) {
    return new Response(JSON.stringify({ error: "Perfil nao encontrado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Somente SuperMaster (Master + tenant is_platform) pode usar esta rota
  const { data: callerTenant } = await supabaseAdmin
    .from("tenants")
    .select("is_platform")
    .eq("id", callerProfile.team_id)
    .maybeSingle();

  const isSuperMaster = callerProfile.role === "Master" && callerTenant?.is_platform === true;

  if (!isSuperMaster) {
    return new Response(JSON.stringify({ error: "Permissao negada. Apenas SuperMaster pode usar esta operacao." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: { userId?: string; full_name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { userId, full_name, role } = body;

  if (!userId || typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "userId e obrigatorio." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!full_name || full_name.trim().length < 3) {
    return new Response(JSON.stringify({ error: "full_name deve ter no minimo 3 caracteres." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!role || typeof role !== "string") {
    return new Response(JSON.stringify({ error: "role e obrigatorio." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ full_name: full_name.trim(), role })
    .eq("id", userId);

  if (updateError) {
    console.error(`[platform-update-user] Falha ao atualizar ${userId}:`, updateError.message);
    return new Response(JSON.stringify({ error: updateError.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[platform-update-user] Usuarios ${userId} atualizado por SuperMaster ${callerUser.id}`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
