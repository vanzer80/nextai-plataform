import { supabase } from '@/src/lib/supabase';
import type { PurchaseOrder, GeneratePOInput } from '@/src/types/purchaseOrder';

const PO_SELECT = `
  *, suppliers(name, contato_email),
  issued_by_user:issued_by(full_name),
  items:purchase_order_items(*)
`;

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(PO_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getPurchaseOrdersByRequest(requestId: string): Promise<PurchaseOrder[]> {
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(PO_SELECT)
    .eq('request_id', requestId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function generatePurchaseOrder(
  requestId: string,
  items: GeneratePOInput[],
  notes?: string,
): Promise<{ po_id: string; po_number: string }> {
  const { data, error } = await supabase.rpc('generate_purchase_order', {
    p_request_id: requestId,
    p_items: items,
    p_notes: notes ?? null,
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Erro ao gerar PO.');
  return { po_id: data.po_id, po_number: data.po_number };
}

export async function updatePOStatus(
  poId: string,
  status: 'recebido' | 'cancelado',
): Promise<void> {
  const patch: Record<string, unknown> = { status };
  if (status === 'recebido') patch.received_at = new Date().toISOString();
  const { error } = await supabase.from('purchase_orders').update(patch).eq('id', poId);
  if (error) throw new Error(error.message);
}
