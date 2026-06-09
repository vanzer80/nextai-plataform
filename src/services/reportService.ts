import { supabase } from '@/src/lib/supabase';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';
import type { EvidenceFile, ReportChecklistItem } from '@/src/types/reports';
import { generateUUID } from '@/src/lib/uuid';

export interface SubmitReportPayload {
  formValues: ReportFormValues;
  technicianId: string;
  teamId: string;
  localDraftId: string;
  checklistAnswers: Record<string, Partial<ReportChecklistItem>>;
  attachments: EvidenceFile[];
  technicianSignature: string | null;
  clientSignature: string | null;
  clientSignerName: string;
  clientLocationId?: string | null;
}

function toTimestamp(date: string | undefined, time: string | undefined | null): string | null {
  if (!time || !date) return null;
  if (time.includes('T')) return time; // already a full datetime string
  // normalize: "HH:MM" → "HH:MM:00", "HH:MM:SS" → keep as-is
  const normalized = time.split(':').length === 2 ? `${time}:00` : time;
  return `${date}T${normalized}`;
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

async function uploadSignature(
  teamId: string,
  reportId: string,
  signerType: 'technician' | 'client',
  dataUrl: string,
): Promise<string> {
  const path = `${teamId}/reports/${reportId}/signatures/${signerType}_${Date.now()}.png`;
  const blob = dataUrlToBlob(dataUrl);
  const { error } = await supabase.storage
    .from('reports_media')
    .upload(path, blob, { contentType: 'image/png', upsert: false });
  if (error) throw error;
  return path;
}

async function uploadAttachment(teamId: string, reportId: string, evidence: EvidenceFile): Promise<string> {
  const ext = evidence.file.name.split('.').pop() ?? 'jpg';
  const path = `${teamId}/reports/${reportId}/attachments/${evidence.id}.${ext}`;
  const { error } = await supabase.storage
    .from('reports_media')
    .upload(path, evidence.file, { contentType: evidence.file.type, upsert: false });
  if (error) throw error;
  return path;
}

export type ReportAction = 'approve' | 'reject' | 'return';

export async function processReportAction(
  reportId: string,
  action: ReportAction,
  comment?: string,
): Promise<void> {
  const { data, error } = await supabase.rpc('process_report_action', {
    p_report_id: reportId,
    p_action:    action,
    p_comment:   comment ?? null,
  });

  if (error) throw error;
  if (data && !data.success) throw new Error(data.error ?? 'Erro desconhecido');
}

export async function submitReport(payload: SubmitReportPayload): Promise<string> {
  const {
    formValues,
    technicianId,
    teamId,
    localDraftId,
    checklistAnswers,
    attachments,
    technicianSignature,
    clientSignature,
    clientSignerName,
    clientLocationId,
  } = payload;

  // Pre-generate report ID so Storage paths are known before the DB transaction
  const reportId = generateUUID();

  // 1. Upload all Storage files in parallel (outside the DB transaction)
  const [signatureRows, attachmentRows] = await Promise.all([
    uploadSignatures(teamId, reportId, technicianSignature, clientSignature, clientSignerName),
    uploadAttachments(teamId, reportId, technicianId, attachments),
  ]);

  // 2. Build checklist payload
  const checklistRows = Object.entries(checklistAnswers)
    .filter(([, ans]) => ans.template_item_id)
    .map(([itemId, ans]) => ({
      template_item_id: ans.template_item_id ?? itemId,
      label: ans.label ?? '',
      item_type: ans.item_type ?? null,
      value_boolean: ans.value_boolean ?? null,
      value_text: ans.value_text ?? null,
      value_number: ans.value_number ?? null,
      value_option: ans.value_option ?? null,
      attachment_url: ans.attachment_url ?? null,
      is_conformant: ans.is_conformant ?? null,
    }));

  // 3. Single atomic RPC — all DB inserts in one transaction
  const { data, error } = await supabase.rpc('submit_report', {
    p_report: {
      id: reportId,
      technician_id: technicianId,
      local_draft_id: localDraftId,
      description: formValues.services_performed || formValues.reported_problem || formValues.final_diagnosis || '',
      service_type: formValues.service_type,
      service_date: formValues.service_date,
      os_number: formValues.os_number || null,
      started_at: toTimestamp(formValues.service_date, formValues.started_at),
      finished_at: toTimestamp(formValues.service_date, formValues.finished_at),
      client_id: formValues.client_id || null,
      site_location: formValues.site_location || null,
      client_location_id: clientLocationId || null,
      asset_id: formValues.asset_id || null,
      asset_name_manual: formValues.asset_name_manual || null,
      geo_lat: formValues.geo_lat ?? null,
      geo_lng: formValues.geo_lng ?? null,
      geo_accuracy: formValues.geo_accuracy ?? null,
      geo_captured_at: formValues.geo_captured_at || null,
      reported_problem: formValues.reported_problem || null,
      preliminary_diagnosis: formValues.preliminary_diagnosis || null,
      final_diagnosis: formValues.final_diagnosis || null,
      internal_notes: formValues.internal_notes || null,
      services_performed: formValues.services_performed || null,
      parts_used: formValues.parts_used || null,
      pending_issues: formValues.pending_issues || null,
      technical_recommendation: formValues.technical_recommendation || null,
      priority: formValues.priority ?? 'normal',
    },
    p_attachments: attachmentRows,
    p_signatures: signatureRows,
    p_checklist: checklistRows,
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? 'Erro ao salvar relatório');

  return data.report_id as string;
}

async function uploadSignatures(
  teamId: string,
  reportId: string,
  technicianSig: string | null,
  clientSig: string | null,
  clientSignerName: string,
): Promise<object[]> {
  const rows: object[] = [];

  if (technicianSig) {
    const path = await uploadSignature(teamId, reportId, 'technician', technicianSig);
    rows.push({ signature_type: 'technician', image_url: path, signer_name: null });
  }
  if (clientSig) {
    const path = await uploadSignature(teamId, reportId, 'client', clientSig);
    rows.push({ signature_type: 'client', image_url: path, signer_name: clientSignerName || null });
  }

  return rows;
}

async function uploadAttachments(
  teamId: string,
  reportId: string,
  technicianId: string,
  attachments: EvidenceFile[],
): Promise<object[]> {
  if (attachments.length === 0) return [];

  const paths = await Promise.all(attachments.map(att => uploadAttachment(teamId, reportId, att)));

  return paths.map((path, i) => ({
    uploaded_by: technicianId,
    url: path,
    filename: attachments[i].file.name,
    mime_type: attachments[i].file.type,
    caption: attachments[i].caption || null,
  }));
}
