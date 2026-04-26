export type OrcamentoStatus = 'rascunho' | 'enviado' | 'aprovado' | 'rejeitado';

export interface OrcamentoItem {
  id: string;
  orcamento_id: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
  created_at: string;
}

export interface Orcamento {
  id: string;
  report_id: string | null;
  client_id: string;
  technician_id: string;
  status: OrcamentoStatus;
  titulo: string | null;
  observacoes: string | null;
  rejection_reason: string | null;
  validade: string | null;
  desconto_pct: number;
  created_at: string;
  updated_at: string;
  clients?: {
    name: string;
    cnpj: string | null;
    cidade: string | null;
    estado: string | null;
    logradouro: string | null;
    numero: string | null;
    bairro: string | null;
    contato_nome: string | null;
    contato_telefone: string | null;
    contato_email: string | null;
  } | null;
  users?: { full_name: string } | null;
  service_reports?: { os_number: string | null } | null;
}

export interface OrcamentoComItens extends Orcamento {
  orcamento_itens: OrcamentoItem[];
}

export interface CreateOrcamentoPayload {
  report_id?: string | null;
  client_id: string;
  technician_id: string;
  titulo?: string;
  observacoes?: string;
  validade?: string | null;
  desconto_pct?: number;
  itens: Array<{
    descricao: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
  }>;
}

export interface UpdateOrcamentoPayload {
  report_id?: string | null;
  client_id?: string;
  titulo?: string;
  observacoes?: string;
  validade?: string | null;
  desconto_pct?: number;
  itens: Array<{
    descricao: string;
    quantidade: number;
    unidade: string;
    valor_unitario: number;
  }>;
}

export const ORCAMENTO_STATUS_LABEL: Record<OrcamentoStatus, string> = {
  rascunho: 'Rascunho',
  enviado: 'Enviado',
  aprovado: 'Aprovado',
  rejeitado: 'Rejeitado',
};

export const ORCAMENTO_STATUS_COLOR: Record<OrcamentoStatus, string> = {
  rascunho: 'bg-slate-100 text-slate-700',
  enviado: 'bg-blue-100 text-blue-800',
  aprovado: 'bg-emerald-100 text-emerald-800',
  rejeitado: 'bg-rose-100 text-rose-800',
};
