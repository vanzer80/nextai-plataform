import { supabase } from '@/src/lib/supabase';

// Lista de tenants (SuperMaster). Lança o erro bruto; caller usa try/catch.
export async function fetchPlatformTenants() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, name, slug, primary_color, logo_url, created_at, users!users_team_id_fkey(count)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Upload do logo no bucket público tenant-assets (upsert no mesmo path por slug);
// o `?v=` força refresh de cache/CDN entre trocas. Lança em erro de upload.
export async function uploadTenantLogo(file: File, slug: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${slug}/logo.${ext}`;
  const { error } = await supabase.storage
    .from('tenant-assets')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Erro ao fazer upload do logo: ${error.message}`);
  const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

// Edge Function de provisionamento (cria tenant + admin). Retorna { data, error } bruto.
export function provisionTenant(body: {
  tenant: { name: string; slug: string; primary_color: string; logo_url: string | null };
  admin: { full_name: string; email: string; password: string };
}) {
  return supabase.functions.invoke('admin-provision-tenant', { body });
}

// Edição cross-tenant via RPC SECURITY DEFINER (UPDATE direto é bloqueado por RLS).
export function updateTenantBranding(
  id: string,
  name: string,
  primaryColor: string,
  logoUrl: string | null,
) {
  return supabase.rpc('update_tenant_branding', {
    p_tenant_id: id,
    p_name: name,
    p_primary_color: primaryColor,
    p_logo_url: logoUrl,
  });
}

export function runStorageBackfill() {
  return supabase.functions.invoke('storage-backfill-mopar');
}
