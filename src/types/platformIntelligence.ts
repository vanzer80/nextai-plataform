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
