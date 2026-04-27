import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ["Master", "Admin", "Gestor"];

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

  // 1. Validar JWT do chamador (quem está pedindo a criação)
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

  // 2. Verificar se o chamador tem role autorizado
  const { data: profile, error: profileError } = await callerClient
    .from("users")
    .select("role")
    .eq("id", callerUser.id)
    .maybeSingle();

  if (profileError || !profile) {
    return new Response(JSON.stringify({ error: "Perfil nao encontrado." }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!ALLOWED_ROLES.includes(profile.role)) {
    return new Response(JSON.stringify({ error: "Permissao negada. Apenas Master, Admin ou Gestor." }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 3. Validar body da requisição
  let body: { email?: string; password?: string; full_name?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "JSON invalido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { email, password, full_name, role } = body;

  if (!email || !password || !full_name || !role) {
    return new Response(JSON.stringify({ error: "Campos obrigatorios: email, password, full_name, role." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4. Validar que o role solicitado é um valor permitido no sistema
  const VALID_APP_ROLES = ["Master", "Admin", "Gestor", "Supervisor", "Financeiro", "Comprador", "Administrativo", "Tecnico de Campo"];
  if (!VALID_APP_ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: `Role invalido: ${role}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 5. Criar usuário com service_role (bypassa confirmação de email)
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    user_metadata: { full_name },
    email_confirm: true,
  });

  if (createError || !newUser.user) {
    console.error("[admin-create-user] Falha ao criar no auth:", createError?.message);
    return new Response(JSON.stringify({ error: createError?.message ?? "Falha ao criar usuario no Auth." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 6. Aguardar trigger e então atualizar role + full_name
  // O trigger handle_new_user cria a linha em public.users automaticamente.
  // Aguardamos até 2s para o trigger propagar antes do UPDATE.
  await new Promise(resolve => setTimeout(resolve, 2000));

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ full_name, role })
    .eq("id", newUser.user.id);

  if (updateError) {
    console.error(`[admin-create-user] Auth criado (${newUser.user.id}) mas UPDATE falhou:`, updateError.message);
    return new Response(JSON.stringify({
      error: `Usuario criado no Auth, mas role nao gravado: ${updateError.message}`,
      userId: newUser.user.id,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[admin-create-user] Usuario ${newUser.user.id} (${role}) criado por ${callerUser.id} (${profile.role})`);

  return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
