// ── Corpus IA (anonimizado) ───────────────────────────────────────────────────

export interface PlatformIntelligenceStats {
  total_reports: number;
  reports_with_diag: number;
  total_kb: number;
  tenants_contributing: number;
  by_service_type: { service_type: string; n: number }[];
}

export interface PlatformDiagnosticRow {
  report_id: string;
  tenant_id: string;
  service_type: string | null;
  status: string;
  reported_problem: string | null;
  preliminary_diagnosis: string | null;
  final_diagnosis: string | null;
  technical_recommendation: string | null;
  services_performed: string | null;
  parts_used: string | null;
  service_date: string | null;
  created_at: string;
}

export interface PlatformKbRow {
  article_id: string;
  tenant_id: string;
  title: string;
  content: string;
  service_type: string | null;
  tags: string[];
  view_count: number;
  created_at: string;
}

export interface CorpusFilters {
  tenantId?: string | null;
  serviceType?: string | null;
  limit?: number;
  offset?: number;
}

// ── Acesso bruto: 13 tabelas operacionais ─────────────────────────────────────

export interface PlatformReportRow {
  id: string;
  team_id: string;
  os_number: string | null;
  service_type: string | null;
  status: string;
  technician_id: string;
  client_id: string | null;
  service_date: string | null;
  reported_problem: string | null;
  final_diagnosis: string | null;
  services_performed: string | null;
  priority: string;
  created_at: string;
  updated_at: string;
}

export interface PlatformReimbursementRow {
  id: string;
  team_id: string;
  category: string;
  amount: number;
  status: string;
  description: string | null;
  client_id: string | null;
  maintenance_type: string | null;
  branch: string | null;
  favorecido: string | null;
  created_at: string;
}

export interface PlatformClientRow {
  id: string;
  team_id: string;
  name: string;
  cnpj: string | null;
  cidade: string | null;
  estado: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  created_at: string;
}

export interface PlatformOrcamentoRow {
  id: string;
  team_id: string;
  client_id: string;
  status: string;
  titulo: string | null;
  desconto_pct: number;
  validade: string | null;
  version: number;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformEquipmentRow {
  id: string;
  team_id: string;
  client_id: string | null;
  name: string;
  type: string | null;
  status: string;
  manufacturer: string | null;
  model: string | null;
  serial_number: string | null;
  installation_date: string | null;
  warranty_until: string | null;
  maintenance_interval_days: number | null;
  last_maintenance_at: string | null;
  acquisition_cost: number | null;
  acquisition_date: string | null;
  useful_life_years: number | null;
  created_at: string;
}

export interface PlatformMaterialRow {
  id: string;
  team_id: string;
  request_number: string;
  maintenance_type: string;
  status: string;
  especificacao_tecnica: string;
  quantity: number | null;
  prazo: string;
  urgency: string | null;
  client_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformChecklistItemRow {
  id: string;
  report_id: string;
  label: string;
  item_type: string;
  value_boolean: boolean | null;
  value_text: string | null;
  value_number: number | null;
  value_option: string | null;
  is_conformant: boolean | null;
  created_at: string;
}

export interface PlatformAttachmentRow {
  id: string;
  report_id: string;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  created_at: string;
}

export interface PlatformStatusHistoryRow {
  id: string;
  report_id: string;
  from_status: string | null;
  to_status: string;
  comment: string | null;
  created_at: string;
}

export interface PlatformSignatureRow {
  id: string;
  report_id: string;
  signature_type: string;
  signer_name: string | null;
  signer_role: string | null;
  signed_at: string;
}

export interface PlatformReimbursementHistoryRow {
  id: string;
  reimbursement_id: string;
  old_status: string | null;
  new_status: string;
  reason: string | null;
  created_at: string;
}

export interface PlatformClientLocationRow {
  id: string;
  client_id: string;
  nome: string;
  logradouro: string | null;
  cidade: string | null;
  estado: string | null;
  created_at: string;
}

export interface PlatformNotificationRow {
  id: string;
  team_id: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

// ── ExportResource union (15 recursos) ────────────────────────────────────────

export type ExportResource =
  | 'diagnostics'
  | 'kb'
  | 'reports'
  | 'reimbursements'
  | 'clients'
  | 'orcamentos'
  | 'equipments'
  | 'materials'
  | 'checklist_items'
  | 'attachments'
  | 'status_history'
  | 'signatures'
  | 'reimbursement_history'
  | 'client_locations'
  | 'notifications';
