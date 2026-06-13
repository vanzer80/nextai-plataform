import { supabase } from '@/src/lib/supabase';

// Service do SuperMaster (platform) para tenants. Funções retornam o { data, error }
// bruto quando o caller inspeciona inline; as que o caller consome direto lançam o
// erro bruto (preservando o tratamento `(err as Error).message` dos callers).

// Upload de logo — variante platform com cache-bust ?t= (o admin usa ?v=).
export async function uploadTenantLogo(file: File, slug: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${slug}/logo.${ext}`;
  const { error } = await supabase.storage
    .from('tenant-assets')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Erro ao fazer upload do logo: ${error.message}`);
  const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

// get_platform_tenants: com p_include_deleted (tela de gestão) ou sem args (dropdowns).
export function getPlatformTenants(includeDeleted?: boolean) {
  return includeDeleted === undefined
    ? supabase.rpc('get_platform_tenants')
    : supabase.rpc('get_platform_tenants', { p_include_deleted: includeDeleted });
}

export async function getTenantCommercialDetail(id: string) {
  const { data, error } = await supabase
    .from('tenants')
    .select('name, primary_color, razao_social, cnpj, ie, email_contato, phone, website, sector, address_zip, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_country')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export function provisionTenant(body: {
  tenant: { name: string; slug: string; primary_color: string; logo_url: string | null };
  admin: { full_name: string; email: string; password: string };
}) {
  return supabase.functions.invoke('admin-provision-tenant', { body });
}

// update_tenant_commercial (SECURITY DEFINER, is_platform_master). O caller monta o
// objeto p_* (preservado verbatim caso a caso); aqui é só pass-through do RPC.
export function updateTenantCommercial(params: Record<string, unknown>) {
  return supabase.rpc('update_tenant_commercial', params);
}

// UPDATE direto na linha do tenant: próprio tenant do SuperMaster (settings) ou toggle is_active.
export function updateTenant(id: string, fields: Record<string, unknown>) {
  return supabase.from('tenants').update(fields).eq('id', id);
}

export function softDeleteTenant(id: string) {
  return supabase.rpc('soft_delete_tenant', { p_tenant_id: id });
}

export function hardDeleteTenant(tenantId: string, confirmSlug: string) {
  return supabase.functions.invoke('admin-delete-tenant', { body: { tenantId, confirmSlug } });
}

export function restoreTenant(id: string) {
  return supabase.rpc('restore_tenant', { p_tenant_id: id });
}
