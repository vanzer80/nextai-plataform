import { supabase } from '@/src/lib/supabase';

// Service do SuperMaster (platform). Self-contained: embora reset/delete usem as
// mesmas Edge Functions do admin, mantém-se separado para não acoplar platform a
// admin. A maioria retorna o { data, error } bruto (callers checam inline);
// exceção: fetchTenantOptions retorna o array `data` direto (erro ignorado, como o original).

export function listPlatformUsers(tenantId: string | null) {
  return supabase.functions.invoke('platform-list-users', { body: { tenant_id: tenantId || null } });
}

export async function fetchTenantOptions() {
  const { data } = await supabase
    .from('tenants')
    .select('id, name, slug')
    .order('name', { ascending: true });
  return data;
}

// admin-create-user no contexto platform inclui team_id (cria em qualquer tenant).
export function platformCreateUser(body: {
  email: string;
  password: string;
  full_name: string;
  role: string;
  team_id: string;
}) {
  return supabase.functions.invoke('admin-create-user', { body });
}

export function platformUpdateUser(userId: string, fullName: string, role: string) {
  return supabase.functions.invoke('platform-update-user', {
    body: { userId, full_name: fullName, role },
  });
}

export function platformResetPassword(userId: string, newPassword: string) {
  return supabase.functions.invoke('admin-reset-password', {
    body: { userId, new_password: newPassword },
  });
}

export function platformDeleteUser(userId: string) {
  return supabase.functions.invoke('admin-delete-user', { body: { userId } });
}
