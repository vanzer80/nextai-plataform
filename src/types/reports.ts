export type ReportStatus = 'draft' | 'pending_review' | 'returned' | 'approved' | 'rejected';

export type ServiceType = 'Preventiva' | 'Corretiva' | 'Instalação' | 'Vistoria' | 'Emergência';

export type ChecklistItemType = 'boolean' | 'text' | 'number' | 'photo' | 'select';

export type SignatureType = 'technician' | 'client' | 'supervisor';

// ── service_reports ───────────────────────────────────────────

export interface ServiceReport {
  id: string;
  os_number: string | null;
  service_type: ServiceType | null;
  status: ReportStatus;

  technician_id: string;
  client_id: string | null;
  asset_id: string | null;
  asset_name_manual: string | null;
  site_location: string | null;

  service_date: string | null;        // DATE → YYYY-MM-DD string
  started_at: string | null;          // TIMESTAMPTZ
  finished_at: string | null;         // TIMESTAMPTZ
  total_minutes: number | null;       // GENERATED STORED

  reported_problem: string | null;
  preliminary_diagnosis: string | null;
  final_diagnosis: string | null;
  services_performed: string | null;
  parts_used: string | null;
  pending_issues: string | null;
  technical_recommendation: string | null;
  internal_notes: string | null;

  geo_lat: number | null;
  geo_lng: number | null;
  geo_accuracy: number | null;
  geo_captured_at: string | null;

  reviewer_id: string | null;
  reviewer_comment: string | null;
  reviewed_at: string | null;

  local_draft_id: string | null;
  last_synced_at: string | null;

  created_at: string;
  updated_at: string;

  // Joins opcionais (retornados por select com relações)
  clients?: { name: string } | null;
  users?: { full_name: string } | null;
  equipments?: { name: string } | null;
}

// ── report_status_history ─────────────────────────────────────

export interface ReportStatusHistory {
  id: string;
  report_id: string;
  from_status: ReportStatus | null;
  to_status: ReportStatus;
  changed_by: string;
  comment: string | null;
  created_at: string;

  users?: { full_name: string } | null;
}

// ── report_attachments ────────────────────────────────────────

export interface ReportAttachment {
  id: string;
  report_id: string;
  uploaded_by: string;
  url: string;
  filename: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  caption: string | null;
  created_at: string;
}

// ── report_signatures ─────────────────────────────────────────

export interface ReportSignature {
  id: string;
  report_id: string;
  signature_type: SignatureType;
  signer_name: string | null;
  signer_role: string | null;
  image_url: string;
  geo_lat: number | null;
  geo_lng: number | null;
  signed_at: string;
}

// ── checklist_templates ───────────────────────────────────────

export interface ChecklistTemplate {
  id: string;
  name: string;
  description: string | null;
  service_type: ServiceType | null;
  asset_category: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  items?: ChecklistTemplateItem[];
}

// ── checklist_template_items ──────────────────────────────────

export interface ChecklistTemplateItem {
  id: string;
  template_id: string;
  order_index: number;
  label: string;
  description: string | null;
  item_type: ChecklistItemType;
  options: string[] | null;    // JSONB → array de strings para tipo 'select'
  is_required: boolean;
  created_at: string;
}

// ── report_checklist_items ────────────────────────────────────

export interface ReportChecklistItem {
  id: string;
  report_id: string;
  template_item_id: string | null;
  label: string;
  item_type: ChecklistItemType;
  value_boolean: boolean | null;
  value_text: string | null;
  value_number: number | null;
  value_option: string | null;
  attachment_url: string | null;
  is_conformant: boolean | null;
  created_at: string;
}

// ── DTOs (para criação/edição) ────────────────────────────────

export type CreateServiceReportDTO = Omit<
  ServiceReport,
  'id' | 'created_at' | 'updated_at' | 'total_minutes' | 'clients' | 'users' | 'equipments'
>;

export type UpdateServiceReportDTO = Partial<CreateServiceReportDTO>;

// ── Helpers ───────────────────────────────────────────────────

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  draft:          'Rascunho',
  pending_review: 'Aguardando Revisão',
  returned:       'Devolvido',
  approved:       'Aprovado',
  rejected:       'Reprovado',
};

export const REPORT_STATUS_COLOR: Record<ReportStatus, string> = {
  draft:          'bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300',
  pending_review: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  returned:       'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300',
  approved:       'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300',
  rejected:       'bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300',
};

// ── Evidências (fotos capturadas no Step 6) ───────────────────

export interface EvidenceFile {
  id: string;        // crypto.randomUUID() local
  file: File;
  preview: string;   // URL.createObjectURL(file)
  caption: string;
}

export const SERVICE_TYPE_OPTIONS: ServiceType[] = [
  'Preventiva',
  'Corretiva',
  'Instalação',
  'Vistoria',
  'Emergência',
];
