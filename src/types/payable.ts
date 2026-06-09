// ── Contas a Pagar types ──────────────────────────────────────────────────────

export type PayableStatus = 'rascunho' | 'pendente' | 'aprovado' | 'pago' | 'rejeitado' | 'cancelado';
export type ApprovalLevel = 'gestor' | 'admin' | 'master';
export type PayableTipo =
  | 'fornecedor' | 'reembolso' | 'material' | 'servico' | 'imposto'
  | 'aluguel'   | 'salario'   | 'folha_pagamento' | 'outro';
export type FormaPagamento = 'pix' | 'boleto' | 'ted' | 'doc' | 'cheque' | 'dinheiro' | 'cartao' | 'outro';

export interface Payable {
  id: string;
  team_id: string;

  tipo: PayableTipo;
  categoria?: string;
  descricao: string;
  observacoes?: string;

  reimbursement_id?:  string | null;
  material_id?:       string | null;
  orcamento_id?:      string | null;
  payroll_period_id?: string | null;
  supplier_id?:       string | null;

  valor_total:     number;
  moeda:           string;
  numero_parcelas: number;

  data_emissao:    string;
  data_vencimento: string;
  data_pagamento?: string | null;

  nota_fiscal?: string | null;
  nf_numero?:   string | null;
  nf_chave?:    string | null;

  status:          PayableStatus;
  approval_level?: ApprovalLevel | null;
  submitted_by?:   string | null;
  submitted_at?:   string | null;
  approved_by?:    string | null;
  approved_at?:    string | null;
  rejected_by?:    string | null;
  rejected_at?:    string | null;
  rejection_reason?: string | null;
  paid_by?:        string | null;
  paid_at?:        string | null;

  forma_pagamento?: FormaPagamento | null;
  pix_key?:         string | null;
  banco_destino?:   string | null;
  agencia_destino?: string | null;
  conta_destino?:   string | null;

  created_at: string;
  updated_at: string;

  // Joined
  supplier?: { id: string; name: string; cnpj?: string } | null;
  installments?: PayableInstallment[];
  comments?: PayableComment[];
}

export interface PayableInstallment {
  id: string;
  payable_id: string;
  team_id: string;
  numero: number;
  valor: number;
  data_vencimento: string;
  data_pagamento?: string | null;
  status: 'pendente' | 'pago' | 'atrasado';
  comprovante_url?: string | null;
  paid_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PayableComment {
  id: string;
  payable_id: string;
  team_id: string;
  user_id?: string | null;
  content: string;
  is_system: boolean;
  created_at: string;
  // Joined
  user?: { full_name?: string } | null;
}

export interface CreatePayableDTO {
  tipo: PayableTipo;
  categoria?: string;
  descricao: string;
  observacoes?: string;
  valor_total: number;
  numero_parcelas?: number;
  data_emissao?: string;
  data_vencimento: string;
  supplier_id?: string | null;
  nota_fiscal?: string;
  nf_numero?: string;
  forma_pagamento?: FormaPagamento;
  pix_key?: string;
  banco_destino?: string;
  agencia_destino?: string;
  conta_destino?: string;
}

// ── Aging / Cashflow ──────────────────────────────────────────────────────────

export interface AgingBucket {
  bucket: string;
  count: number;
  total_valor: number;
  min_venc: string;
  max_venc: string;
}

export interface CashflowWeek {
  semana: string;
  total_previsto: number;
  total_pago: number;
}

export interface PayableKPIs {
  a_vencer:    number;
  vencido:     number;
  pago_mes:    number;
  total_aprovado: number;
  count_pendente: number;
}
