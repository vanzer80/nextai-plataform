import { supabase } from '@/src/lib/supabase';

// Callers inspecionam { data, error } inline — funções retornam o resultado
// BRUTO do supabase, sem throw (lift verbatim).

export function getApiKeys() {
  return supabase.rpc('get_api_keys');
}

export function getApiUsageStats(days = 7) {
  return supabase.rpc('get_api_usage_stats', { p_days: days });
}

export function createApiKey(name: string, scopes: string[], expiresAt: string | null) {
  return supabase.rpc('create_api_key', {
    p_name: name,
    p_scopes: scopes,
    p_expires_at: expiresAt,
  });
}

export function revokeApiKey(id: string) {
  return supabase.rpc('revoke_api_key', { p_key_id: id });
}
