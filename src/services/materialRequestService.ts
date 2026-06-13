import { supabase } from '@/src/lib/supabase';
import { extractStoragePath, batchSignedUrls } from '@/src/lib/storage';
import { withTimeout } from '@/src/lib/withTimeout';
import type { PurchaseRequest } from '@/src/types/materialRequest';

const MEDIA_BUCKET = 'materials_media';

const LIST_SELECT = `
  id, request_number, tech_id, item, quantity, urgency, reason, status, created_at, updated_at,
  cidade, client_id, loja, maintenance_type, prazo, especificacao_tecnica,
  foto_url, link_referencia, obs,
  comprador_response, comprador_id, processed_at, purchase_price, purchase_link,
  logistics_type, supplier_name, pickup_address,
  clients(name),
  users:tech_id(full_name)
`;

// Lista todas as solicitações (RLS isola: técnico vê as suas, comprador vê todas)
// e resolve foto_url para signed URLs.
export async function fetchMaterialRequests(): Promise<PurchaseRequest[]> {
  const { data, error } = await supabase
    .from('material_requests')
    .select(LIST_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw error;

  const rawItems = (data as PurchaseRequest[]) || [];
  const fotoPaths = [...new Set(
    rawItems
      .filter(r => typeof r.foto_url === 'string')
      .map(r => extractStoragePath(r.foto_url as string, MEDIA_BUCKET))
      .filter(Boolean),
  )];
  const signedMap = fotoPaths.length > 0
    ? await batchSignedUrls(fotoPaths, MEDIA_BUCKET)
    : {};
  return rawItems.map(r => ({
    ...r,
    foto_url: r.foto_url
      ? (signedMap[extractStoragePath(r.foto_url, MEDIA_BUCKET)] || r.foto_url)
      : r.foto_url,
  }));
}

export function subscribeMaterialRequests(userId: string, onChange: () => void): () => void {
  const channel = supabase
    .channel(`material_requests_${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'material_requests' }, () => {
      onChange();
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

export async function getMaterialRequestById(id: string) {
  const { data, error } = await supabase
    .from('material_requests')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function uploadMaterialPhoto(path: string, file: File): Promise<void> {
  const { error } = await withTimeout(
    supabase.storage.from(MEDIA_BUCKET).upload(path, file),
    30000,
  ) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error('Erro no upload da foto: ' + error.message);
}

export async function createMaterialRequest(payload: Record<string, unknown>): Promise<void> {
  const { error } = await withTimeout(
    supabase.from('material_requests').insert(payload),
    30000,
  ) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
}

export async function updateMaterialRequest(id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await withTimeout(
    supabase.from('material_requests').update(payload).eq('id', id),
    30000,
  ) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
}

export async function notifyCompradores(title: string, message: string): Promise<void> {
  await supabase.rpc('notify_compradores', { p_title: title, p_message: message });
}

// Comprador processa a solicitação: atualiza status (sem withTimeout, como no original)
// e notifica o técnico. Erro do update propaga; falha da notificação é silenciosa.
export async function processMaterialRequest(
  id: string,
  payload: Record<string, unknown>,
  techId: string,
  notification: { title: string; message: string },
): Promise<void> {
  const { error } = await supabase.from('material_requests').update(payload).eq('id', id);
  if (error) throw error;
  await supabase.from('notifications').insert({ user_id: techId, ...notification });
}
