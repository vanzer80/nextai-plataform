import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALLOWED_ROLES = ["Master", "Admin", "Gestor"];

// Numeric rank — caller can only create roles strictly below their own rank
const ROLE_RANK: Record<string, number> = {
  Master: 5, Admin: 4, Gestor: 3, Supervisor: 2,
  Financeiro: 2, Comprador: 2, Administrativo: 2, Tecnico: 1,
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
    .select("role, team_id")
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
  // team_id é aceito no body mas ignorado em favor do team_id do caller —
  // evita que um Gestor crie usuários em outro tenant.
  let body: { email?: string; password?: string; full_name?: string; role?: string; team_id?: string };
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
  const VALID_APP_ROLES = ["Master", "Admin", "Gestor", "Supervisor", "Financeiro", "Comprador", "Administrativo", "Tecnico"];
  if (!VALID_APP_ROLES.includes(role)) {
    return new Response(JSON.stringify({ error: `Role invalido: ${role}` }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // 4b. Prevenir escalada de privilégio: caller não pode criar role de nível >= ao seu
  const callerRank = ROLE_RANK[profile.role] ?? 0;
  const targetRank = ROLE_RANK[role] ?? 0;
  if (targetRank >= callerRank) {
    return new Response(JSON.stringify({ error: "Permissao negada. Voce nao pode criar um perfil com nivel igual ou superior ao seu." }), {
      status: 403,
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

  // 6. Aguardar trigger e então atualizar role + full_name + team_id
  // O trigger handle_new_user cria a linha em public.users automaticamente.
  // Aguardamos até 2s para o trigger propagar antes do UPDATE.
  // team_id vem sempre do perfil do caller — garante que o novo usuário
  // pertence ao mesmo tenant de quem está criando, sem aceitar valor externo.
  await new Promise(resolve => setTimeout(resolve, 2000));

  const { error: updateError } = await supabaseAdmin
    .from("users")
    .update({ full_name, role, team_id: profile.team_id ?? null })
    .eq("id", newUser.user.id);

  if (updateError) {
    console.error(`[admin-create-user] Auth criado (${newUser.user.id}) mas UPDATE falhou:`, updateError.message);
    return new Response(JSON.stringify({
      error: `Usuario criado no Auth, mas role/team_id nao gravado: ${updateError.message}`,
      userId: newUser.user.id,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  console.log(`[admin-create-user] Usuario ${newUser.user.id} (${role}, team:${profile.team_id}) criado por ${callerUser.id} (${profile.role})`);

  return new Response(JSON.stringify({ success: true, userId: newUser.user.id }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
