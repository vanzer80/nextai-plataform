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

// Read do próprio tenant (Master/Admin) para popular o Perfil Comercial. Lança o erro bruto.
export async function fetchOwnTenantCommercial(tenantId: string): Promise<{
  name: string | null; razao_social: string | null; cnpj: string | null; ie: string | null;
  email_contato: string | null; phone: string | null; website: string | null; sector: string | null;
  address_zip: string | null; address_street: string | null; address_number: string | null;
  address_complement: string | null; address_neighborhood: string | null; address_city: string | null;
  address_state: string | null; address_country: string | null;
}> {
  const { data, error } = await supabase
    .from('tenants')
    .select('name, razao_social, cnpj, ie, email_contato, phone, website, sector, address_zip, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_country')
    .eq('id', tenantId)
    .single();
  if (error) throw error;
  return data;
}

// Master/Admin edita a PRÓPRIA empresa via RPC SECURITY DEFINER (UPDATE direto bloqueado por RLS;
// a RPC restringe internamente as colunas — nunca name/slug/primary_color/logo_url/is_platform/is_active).
// Retorna { data, error } bruto: o caller mantém o `if (error) throw error` (contrato de erro preservado).
export function updateOwnTenantCommercial(params: {
  p_razao_social: string | null;
  p_cnpj: string | null;
  p_ie: string | null;
  p_email_contato: string | null;
  p_phone: string | null;
  p_website: string | null;
  p_sector: string | null;
  p_address_zip: string | null;
  p_address_street: string | null;
  p_address_number: string | null;
  p_address_complement: string | null;
  p_address_neighborhood: string | null;
  p_address_city: string | null;
  p_address_state: string | null;
  p_address_country: string | null;
}) {
  return supabase.rpc('update_own_tenant_commercial', params);
}
