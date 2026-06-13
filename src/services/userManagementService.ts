import { supabase } from '@/src/lib/supabase';

// NOTA: o filtro .eq('team_id', teamId) é mantido VERBATIM do original. A RLS já
// isola por tenant; remover seria behavior change fora do escopo de um lift.
export async function fetchTeamUsers(teamId: string) {
  const { data, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status, team_id, created_at, linked_client_id')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Sem checagem de erro (silencioso), como o original (.then(({data}) => ...)).
export async function fetchClientsForLinking() {
  const { data } = await supabase.from('clients').select('id, name').order('name');
  return data ?? [];
}

export function adminCreateUser(body: { email: string; password: string; full_name: string; role: string }) {
  return supabase.functions.invoke('admin-create-user', { body });
}

// Busca o id do usuário recém-criado por email. Silencioso (só desestrutura data).
export async function findUserIdByEmail(email: string) {
  const { data } = await supabase.from('users').select('id').eq('email', email).single();
  return data;
}

export async function linkUserToClient(userId: string, clientId: string) {
  await supabase.from('users').update({ linked_client_id: clientId }).eq('id', userId);
}

export async function updateUser(id: string, updates: Record<string, string | null>) {
  const { error } = await supabase.from('users').update(updates).eq('id', id);
  if (error) throw error;
}

export function adminResetPassword(userId: string, newPassword: string) {
  return supabase.functions.invoke('admin-reset-password', {
    body: { userId, new_password: newPassword },
  });
}

export function adminDeleteUser(userId: string) {
  return supabase.functions.invoke('admin-delete-user', { body: { userId } });
}
