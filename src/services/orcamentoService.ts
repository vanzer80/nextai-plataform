import { supabase } from '@/src/lib/supabase';
import type {
  Orcamento,
  OrcamentoComItens,
  OrcamentoVersion,
  OrcamentoStatus,
  CreateOrcamentoPayload,
  UpdateOrcamentoPayload,
} from '@/src/types/orcamento';

const ORCAMENTO_SELECT = `
  id, report_id, client_id, technician_id, status, titulo, observacoes,
  rejection_reason, validade, desconto_pct, created_at, updated_at,
  version, signed_at, signer_name, signer_email,
  client_location_id, site_location,
  clients(name, cnpj, cidade, estado, logradouro, numero, bairro, contato_nome, contato_telefone, contato_email),
  users:technician_id(full_name),
  service_reports:report_id(os_number, service_type, service_date, status)
`;

const PAGE_SIZE = 20;

export interface OrcamentosFilter {
  status?: OrcamentoStatus | '';
  client_id?: string;
}

export async function listarOrcamentos(
  filter: OrcamentosFilter = {},
  pageIndex = 0,
): Promise<Orcamento[]> {
  let query = supabase
    .from('orcamentos')
    .select(ORCAMENTO_SELECT)
    .order('created_at', { ascending: false })
    .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

  if (filter.status) query = query.eq('status', filter.status);
  if (filter.client_id) query = query.eq('client_id', filter.client_id);

  const { data, error } = await query as { data: unknown; error: { message: string } | null };
  if (error) throw new Error(error.message);
  return (data ?? []) as Orcamento[];
}

export async function buscarOrcamento(id: string): Promise<OrcamentoComItens | null> {
  const { data, error } = await supabase
    .from('orcamentos')
    .select(`
      ${ORCAMENTO_SELECT},
      signature_data_url,
      orcamento_itens(id, descricao, quantidade, unidade, valor_unitario, created_at)
    `)
    .eq('id', id)
    .maybeSingle() as { data: unknown; error: { message: string } | null };

  if (error) throw new Error(error.message);
  return data as OrcamentoComItens | null;
}

export async function criarOrcamento(payload: CreateOrcamentoPayload): Promise<string> {
  const { data, error } = await supabase.rpc('create_orcamento', {
    p_orcamento: {
      report_id:          payload.report_id ?? null,
      client_id:          payload.client_id,
      technician_id:      payload.technician_id,
      titulo:             payload.titulo || null,
      observacoes:        payload.observacoes || null,
      validade:           payload.validade ?? null,
      desconto_pct:       payload.desconto_pct ?? 0,
      client_location_id: payload.client_location_id ?? null,
      site_location:      payload.site_location || null,
    },
    p_itens: payload.itens.map(item => ({
      descricao:      item.descricao,
      quantidade:     item.quantidade,
      unidade:        item.unidade || 'un',
      valor_unitario: item.valor_unitario,
    })),
  }) as { data: { success: boolean; id?: string; error?: string } | null; error: { message: string } | null };

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Falha ao criar orçamento.');
  return data.id!;
}

export async function atualizarOrcamento(
  id: string,
  payload: UpdateOrcamentoPayload,
  changedBy?: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('update_orcamento', {
    p_id: id,
    p_orcamento: {
      report_id:          payload.report_id ?? null,
      client_id:          payload.client_id,
      titulo:             payload.titulo || null,
      observacoes:        payload.observacoes || null,
      validade:           payload.validade ?? null,
      desconto_pct:       payload.desconto_pct ?? 0,
      client_location_id: payload.client_location_id ?? null,
      site_location:      payload.site_location || null,
    },
    p_itens: payload.itens.map(item => ({
      descricao:      item.descricao,
      quantidade:     item.quantidade,
      unidade:        item.unidade || 'un',
      valor_unitario: item.valor_unitario,
    })),
    p_changed_by: changedBy ?? null,
  }) as { data: { success: boolean; version?: number; error?: string } | null; error: { message: string } | null };

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Falha ao atualizar orçamento.');
}

export async function assinarOrcamento(
  orcamentoId: string,
  signerName: string,
  signerEmail: string,
  signatureDataUrl: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('sign_orcamento', {
    p_orcamento_id:       orcamentoId,
    p_signer_name:        signerName,
    p_signer_email:       signerEmail,
    p_signature_data_url: signatureDataUrl,
    p_ip:                 null,
  }) as { data: { success: boolean; error?: string } | null; error: { message: string } | null };

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Falha ao assinar orçamento.');
}

export async function listarVersoes(orcamentoId: string): Promise<OrcamentoVersion[]> {
  const { data, error } = await supabase
    .from('orcamento_versions')
    .select('id, version, titulo, observacoes, validade, desconto_pct, itens, changed_by, changed_at, users:changed_by(full_name)')
    .eq('orcamento_id', orcamentoId)
    .order('version', { ascending: false }) as { data: unknown; error: { message: string } | null };

  if (error) throw new Error(error.message);
  return (data ?? []) as OrcamentoVersion[];
}

export async function atualizarStatus(
  id: string,
  status: OrcamentoStatus,
  rejection_reason?: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('process_orcamento_status', {
    p_orcamento_id: id,
    p_new_status:   status,
    p_comment:      rejection_reason || null,
  }) as { data: { success: boolean; error?: string } | null; error: { message: string } | null };

  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error ?? 'Falha ao atualizar status.');

  // Persiste rejection_reason no campo da tabela (o RPC salva no histórico; o campo denormalizado facilita exibição)
  if (status === 'rejeitado' && rejection_reason !== undefined) {
    await supabase.from('orcamentos').update({ rejection_reason: rejection_reason || null }).eq('id', id);
  }
}

export async function excluirOrcamento(id: string): Promise<void> {
  const { error } = await supabase
    .from('orcamentos')
    .delete()
    .eq('id', id) as { data: unknown; error: { message: string } | null };

  if (error) throw new Error(error.message);
}
