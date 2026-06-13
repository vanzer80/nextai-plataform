import { supabase } from '@/src/lib/supabase';
import { extractStoragePath, batchSignedUrls } from '@/src/lib/storage';
import { withTimeout } from '@/src/lib/withTimeout';

export type ReimbursementAction = 'Aprovado' | 'Rejeitado' | 'Revisao' | 'Pago';

export interface ReimbursementHistoryItem {
  id: string;
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
  changed_by: string;
}

const RECEIPT_BUCKET = 'reimbursements_media';

// Lista paginada com resolução de signed URLs dos comprovantes.
// RLS filtra por tenant; gestor vê todos, técnico só os próprios (eq user_id).
export async function fetchReimbursements(params: {
  page: number;
  itemsPerPage: number;
  isManager: boolean;
  userId?: string;
}) {
  const { page, itemsPerPage, isManager, userId } = params;
  let query = supabase
    .from('reimbursements')
    .select(`
      id, created_at, category, amount, status, receipt_url,
      user_id, description, maintenance_type, client_id, branch, budget,
      favorecido, pix_key, rejection_reason, revision_reason,
      paid_at, paid_by,
      clients(name),
      users:user_id(full_name)
    `)
    .order('created_at', { ascending: false })
    .range(page * itemsPerPage, (page + 1) * itemsPerPage - 1);

  if (!isManager) {
    query = query.eq('user_id', userId);
  }

  const { data: result, error } = await query;
  if (error) throw error;

  const rows = result ?? [];
  const rawItems = rows.map(item => ({
    ...item,
    users: Array.isArray(item.users) ? item.users[0] : item.users,
  }));

  const uniquePaths: string[] = [...new Set<string>(
    rawItems
      .filter(item => typeof item.receipt_url === 'string')
      .map(item => extractStoragePath(item.receipt_url as string, RECEIPT_BUCKET))
  )];
  const signedMap = await batchSignedUrls(uniquePaths, RECEIPT_BUCKET);

  const items = rawItems.map(item => ({
    ...item,
    receipt_url: item.receipt_url
      ? (signedMap[extractStoragePath(item.receipt_url, RECEIPT_BUCKET)] || item.receipt_url)
      : null,
  }));

  return { items, hasMore: rows.length === itemsPerPage };
}

// Ação de status via RPC. Retorna o resultado bruto { data, error } para que
// cada chamador (ação única vs. lote) aplique sua própria política de erro.
export function processReimbursementAction(
  id: string,
  action: ReimbursementAction,
  reason: string | null,
) {
  return supabase.rpc('process_reimbursement_action', {
    p_reimbursement_id: id,
    p_action: action,
    p_reason: reason,
  });
}

// Assina mudanças realtime na tabela; devolve função de cleanup.
export function subscribeReimbursements(handlers: {
  onInsert: (row: Record<string, any>) => void;
  onUpdate: (newRow: Record<string, any>, oldRow: Record<string, any>) => void;
  onDelete: (oldRow: Record<string, any>) => void;
}): () => void {
  const channel = supabase.channel('realtime_reimbursements')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'reimbursements' }, (payload) => {
      if (payload.eventType === 'INSERT') {
        handlers.onInsert(payload.new);
      } else if (payload.eventType === 'UPDATE') {
        handlers.onUpdate(payload.new, payload.old);
      } else if (payload.eventType === 'DELETE') {
        handlers.onDelete(payload.old);
      }
    })
    .subscribe();

  return () => { supabase.removeChannel(channel); };
}

export async function getReimbursementById(id: string) {
  const { data, error } = await supabase
    .from('reimbursements')
    .select('*')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

// Checagem de comprovante duplicado por hash. Retorna a linha existente ou null.
export async function findReimbursementByReceiptHash(hash: string) {
  const { data } = await supabase
    .from('reimbursements')
    .select('id, created_at')
    .eq('receipt_hash', hash)
    .maybeSingle();
  return data;
}

export async function uploadReceipt(filePath: string, file: File): Promise<void> {
  const { error } = await withTimeout(
    supabase.storage.from(RECEIPT_BUCKET).upload(filePath, file),
    30000,
  ) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error('Falha no upload: ' + error.message);
}

export async function createReimbursement(payload: Record<string, unknown>): Promise<void> {
  const { error } = await withTimeout(
    supabase.from('reimbursements').insert(payload),
    30000,
  ) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
}

export async function updateReimbursement(id: string, payload: Record<string, unknown>): Promise<void> {
  const { error } = await withTimeout(
    supabase.from('reimbursements').update(payload).eq('id', id),
    30000,
  ) as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
}

export async function getReimbursementHistory(reimbursementId: string): Promise<ReimbursementHistoryItem[]> {
  const { data, error } = await supabase
    .from('reimbursement_history')
    .select('*')
    .eq('reimbursement_id', reimbursementId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Valores de reembolsos do colaborador na categoria (exceto rejeitados e o atual),
// para cálculo de anomalia. Silencioso em erro (retorna []), como o original.
export async function getReimbursementAmountsForAnomaly(
  userId: string,
  category: string,
  excludeId: string,
): Promise<number[]> {
  const { data } = await supabase
    .from('reimbursements')
    .select('amount')
    .eq('user_id', userId)
    .eq('category', category)
    .neq('status', 'Rejeitado')
    .neq('id', excludeId);
  return (data ?? []).map(r => Number(r.amount));
}
