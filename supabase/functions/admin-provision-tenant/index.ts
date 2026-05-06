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

const SLUG_RE = /^[a-z][a-z0-9-]{2,49}$/;
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Não autorizado." }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // 1. Validate caller JWT
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user: caller }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !caller) return json({ error: "Token inválido." }, 401);

  // 2. Only Master can provision tenants
  const { data: profile, error: profileErr } = await callerClient
    .from("users")
    .select("role")
    .eq("id", caller.id)
    .maybeSingle();

  if (profileErr || !profile) return json({ error: "Perfil não encontrado." }, 401);
  if (profile.role !== "Master") return json({ error: "Permissão negada. Apenas Master pode criar tenants." }, 403);

  // 3. Parse + validate body
  let body: {
    tenant?: { name?: string; slug?: string; primary_color?: string };
    admin?: { email?: string; password?: string; full_name?: string };
  };
  try { body = await req.json(); }
  catch { return json({ error: "JSON inválido." }, 400); }

  const { tenant, admin } = body ?? {};

  if (!tenant?.name || tenant.name.trim().length < 3 || tenant.name.trim().length > 100)
    return json({ error: "tenant.name deve ter entre 3 e 100 caracteres." }, 400);

  if (!tenant?.slug || !SLUG_RE.test(tenant.slug))
    return json({ error: "tenant.slug deve ser lowercase, iniciar com letra, só letras/números/hífens, 3–50 chars." }, 400);

  const primaryColor = tenant.primary_color && HEX_RE.test(tenant.primary_color)
    ? tenant.primary_color
    : "#0066CC";

  if (!admin?.email || !admin?.password || !admin?.full_name)
    return json({ error: "Campos obrigatórios: admin.email, admin.password, admin.full_name." }, 400);

  if (admin.password.length < 8)
    return json({ error: "admin.password deve ter pelo menos 8 caracteres." }, 400);

  const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 4. Check slug uniqueness
  const { data: existing } = await supabaseAdmin
    .from("tenants")
    .select("id")
    .eq("slug", tenant.slug)
    .maybeSingle();

  if (existing) return json({ error: `Slug "${tenant.slug}" já está em uso.` }, 409);

  // 5. Create tenant row
  const { data: newTenant, error: tenantErr } = await supabaseAdmin
    .from("tenants")
    .insert({ name: tenant.name.trim(), slug: tenant.slug, primary_color: primaryColor })
    .select("id")
    .single();

  if (tenantErr || !newTenant)
    return json({ error: `Erro ao criar tenant: ${tenantErr?.message}` }, 500);

  const tenantId = newTenant.id;

  // 6. Create auth user — on failure, rollback tenant row
  const { data: newUser, error: userErr } = await supabaseAdmin.auth.admin.createUser({
    email: admin.email,
    password: admin.password,
    user_metadata: { full_name: admin.full_name },
    email_confirm: true,
  });

  if (userErr || !newUser.user) {
    await supabaseAdmin.from("tenants").delete().eq("id", tenantId);
    return json({ error: `Erro ao criar usuário: ${userErr?.message ?? "falha no Auth"}` }, 400);
  }

  // 7. Wait for handle_new_user trigger then set role + team_id
  await new Promise(resolve => setTimeout(resolve, 2000));

  const { error: updateErr } = await supabaseAdmin
    .from("users")
    .update({ full_name: admin.full_name, role: "Master", team_id: tenantId })
    .eq("id", newUser.user.id);

  if (updateErr) {
    console.error(`[admin-provision-tenant] tenant ${tenantId} criado, usuário ${newUser.user.id} criado, mas UPDATE falhou:`, updateErr.message);
    return json({
      success: true,
      warning: `Tenant criado mas role/team_id não gravado: ${updateErr.message}`,
      tenantId,
      userId: newUser.user.id,
      slug: tenant.slug,
    });
  }

  console.log(`[admin-provision-tenant] tenant=${tenantId} slug=${tenant.slug} admin=${newUser.user.id} criado por ${caller.id}`);

  return json({ success: true, tenantId, userId: newUser.user.id, slug: tenant.slug });
});
