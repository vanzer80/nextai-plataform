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

// ── Raw data interfaces (SuperMaster full access) ────────────────────────────

export interface PlatformReportRow {
  id: string;
  team_id: string;
  os_number: string | null;
  status: string;
  service_type: string | null;
  priority: string | null;
  service_date: string | null;
  technician_name: string | null;
  client_name: string | null;
  site_location: string | null;
  reported_problem: string | null;
  preliminary_diagnosis: string | null;
  final_diagnosis: string | null;
  technical_recommendation: string | null;
  services_performed: string | null;
  parts_used: string | null;
  internal_notes: string | null;
  pending_issues: string | null;
  geo_lat: number | null;
  geo_lng: number | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlatformReimbursementRow {
  id: string;
  team_id: string;
  status: string;
  category: string | null;
  amount: number;
  description: string | null;
  favorecido: string | null;
  pix_key: string | null;
  submitter_name: string | null;
  client_name: string | null;
  expense_date: string | null;
  branch: string | null;
  rejection_reason: string | null;
  paid_at: string | null;
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
  observacoes: string | null;
  created_at: string;
}

export interface PlatformOrcamentoRow {
  id: string;
  team_id: string;
  status: string;
  titulo: string;
  client_name: string | null;
  technician_name: string | null;
  total_value: number;
  validade: string | null;
  observacoes: string | null;
  signer_name: string | null;
  signer_email: string | null;
  signed_at: string | null;
  created_at: string;
}

export interface PlatformEquipmentRow {
  id: string;
  team_id: string;
  name: string;
  type: string | null;
  serial_number: string | null;
  manufacturer: string | null;
  model: string | null;
  status: string | null;
  client_name: string | null;
  installation_date: string | null;
  warranty_until: string | null;
  maintenance_interval_days: number | null;
  last_maintenance_at: string | null;
  created_at: string;
}

export interface PlatformMaterialRow {
  id: string;
  team_id: string;
  request_number: string | null;
  status: string;
  urgency: string | null;
  item: string;
  quantity: number;
  requester_name: string | null;
  client_name: string | null;
  reason: string | null;
  especificacao_tecnica: string | null;
  maintenance_type: string | null;
  prazo: string | null;
  purchase_price: number | null;
  supplier_name: string | null;
  created_at: string;
}

export interface RawFilters {
  tenantId?: string | null;
  limit?: number;
  offset?: number;
}

export type ExportResource =
  | 'diagnostics' | 'kb'
  | 'reports' | 'reimbursements' | 'clients'
  | 'orcamentos' | 'equipments' | 'materials';
