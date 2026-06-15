import { supabase } from '@/src/lib/supabase';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';
import type {
  EvidenceFile, ReportChecklistItem,
  ServiceReport, ReportStatusHistory, ReportAttachment, ReportSignature,
} from '@/src/types/reports';
import { generateUUID } from '@/src/lib/uuid';
import { withTimeout } from '@/src/lib/withTimeout';
import { enqueue } from '@/src/lib/reportIndexedDB';

// Cada upload de mídia tem teto de tempo — rede de campo ruim não pode travar o envio.
const UPLOAD_TIMEOUT_MS = 15_000;

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
  const { error } = await withTimeout<{ error: { message: string } | null }>(
    supabase.storage.from('reports_media').upload(path, blob, { contentType: 'image/png', upsert: false }),
    UPLOAD_TIMEOUT_MS,
  );
  if (error) throw error;
  return path;
}

async function uploadAttachment(teamId: string, reportId: string, evidence: EvidenceFile): Promise<string> {
  const ext = evidence.file.name.split('.').pop() ?? 'jpg';
  const path = `${teamId}/reports/${reportId}/attachments/${evidence.id}.${ext}`;
  const { error } = await withTimeout<{ error: { message: string } | null }>(
    supabase.storage.from('reports_media').upload(path, evidence.file, { contentType: evidence.file.type, upsert: false }),
    UPLOAD_TIMEOUT_MS,
  );
  if (error) throw error;
  return path;
}

export type ReportAction = 'approve' | 'reject' | 'return';

export interface ResubmitPayload {
  reportId: string;
  reported_problem?: string;
  preliminary_diagnosis?: string;
  final_diagnosis?: string;
  services_performed?: string;
  parts_used?: string;
  pending_issues?: string;
  technical_recommendation?: string;
  internal_notes?: string;
}

export async function resubmitReport({ reportId, ...patch }: ResubmitPayload): Promise<void> {
  const { data, error } = await supabase.rpc('resubmit_report', {
    p_report_id: reportId,
    p_patch: patch,
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? 'Erro ao reenviar OS');
}

export async function reopenReport(reportId: string): Promise<void> {
  const { data, error } = await supabase.rpc('reopen_report', { p_report_id: reportId });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? 'Erro ao reabrir OS');
}

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
  const [signatureRows, attachmentResult] = await Promise.all([
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
    p_attachments: attachmentResult.rows,
    p_signatures: signatureRows,
    p_checklist: checklistRows,
  });

  if (error) throw error;
  if (!data?.success) throw new Error(data?.error ?? 'Erro ao salvar relatório');

  const finalReportId = data.report_id as string;

  // Fotos que falharam/estouraram o timeout: a OS já foi criada com as que subiram;
  // as restantes vão para a fila offline e sobem no próximo sync (técnico não bloqueia).
  if (attachmentResult.failed.length > 0) {
    await enqueueFailedAttachments(finalReportId, teamId, technicianId, attachmentResult.failed);
  }

  return finalReportId;
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

interface AttachmentUploadResult {
  rows: object[];
  failed: EvidenceFile[];
}

async function uploadAttachments(
  teamId: string,
  reportId: string,
  technicianId: string,
  attachments: EvidenceFile[],
): Promise<AttachmentUploadResult> {
  if (attachments.length === 0) return { rows: [], failed: [] };

  // allSettled: uma foto que falhe ou estoure o timeout não derruba a OS inteira.
  const settled = await Promise.allSettled(
    attachments.map(att => uploadAttachment(teamId, reportId, att)),
  );

  const rows: object[] = [];
  const failed: EvidenceFile[] = [];
  settled.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      rows.push({
        uploaded_by: technicianId,
        url: res.value,
        filename: attachments[i].file.name,
        mime_type: attachments[i].file.type,
        caption: attachments[i].caption || null,
      });
    } else {
      failed.push(attachments[i]);
    }
  });
  return { rows, failed };
}

async function enqueueFailedAttachments(
  reportId: string,
  teamId: string,
  technicianId: string,
  failed: EvidenceFile[],
): Promise<void> {
  for (const ev of failed) {
    await enqueue({
      type: 'uploadAttachment',
      localDraftId: reportId,
      payload: {
        reportId,
        teamId,
        technicianId,
        attachmentId: ev.id,
        file: ev.file,
        caption: ev.caption || null,
      } satisfies UploadAttachmentJob,
      retries: 0,
      createdAt: Date.now(), // sobrescrito por enqueue(); presente só p/ satisfazer o tipo
    });
  }
}

export interface UploadAttachmentJob {
  reportId: string;
  teamId: string;
  technicianId: string;
  attachmentId: string;
  file: File;
  caption: string | null;
}

/**
 * Reprocessa um anexo que falhou no submit (re-enfileirado): upload + vínculo em
 * report_attachments para o report já existente. Idempotente por `id = attachmentId`.
 */
export async function uploadAndLinkAttachment(job: UploadAttachmentJob): Promise<void> {
  const ext = job.file.name.split('.').pop() ?? 'jpg';
  const path = `${job.teamId}/reports/${job.reportId}/attachments/${job.attachmentId}.${ext}`;

  const { error: upErr } = await withTimeout<{ error: { message: string } | null }>(
    supabase.storage.from('reports_media').upload(path, job.file, { contentType: job.file.type, upsert: true }),
    UPLOAD_TIMEOUT_MS,
  );
  if (upErr) throw upErr;

  // RLS report_attachments_insert exige uploaded_by = auth.uid().
  const { data: auth } = await supabase.auth.getUser();
  const { error: insErr } = await supabase.from('report_attachments').upsert(
    {
      id: job.attachmentId,
      report_id: job.reportId,
      uploaded_by: auth.user?.id ?? null,
      url: path,
      filename: job.file.name,
      mime_type: job.file.type,
      caption: job.caption,
    },
    { onConflict: 'id' },
  );
  if (insErr) throw insErr;
}

// Reserva atômica do número da OS (variante authenticated — recebe p_team_id).
export async function reserveOsNumber(teamId: string): Promise<string> {
  const { data, error } = await supabase.rpc('reserve_os_number', { p_team_id: teamId });
  if (error) throw error;
  return data as string;
}

// Assina URLs do bucket reports_media (alinhadas por índice; '' para falha — caller faz fallback).
export async function signReportMediaUrls(paths: string[]): Promise<string[]> {
  if (paths.length === 0) return [];
  const { data } = await supabase.storage
    .from('reports_media')
    .createSignedUrls(paths, 3600);
  return (data ?? []).map(d => d.signedUrl ?? '');
}

// Detalhe completo da OS: 5 reads em paralelo + assinatura de URLs. Lança apenas se o report falhar.
export async function fetchReportDetail(id: string): Promise<{
  report: ServiceReport;
  history: ReportStatusHistory[];
  attachments: ReportAttachment[];
  signatures: ReportSignature[];
  checklistItems: ReportChecklistItem[];
}> {
  const [reportRes, historyRes, attachmentsRes, signaturesRes, checklistRes] =
    await Promise.all([
      supabase
        .from('service_reports')
        .select('*, clients(name), users:technician_id(full_name), equipments(name)')
        .eq('id', id)
        .single(),
      supabase
        .from('report_status_history')
        .select('*')
        .eq('report_id', id)
        .order('created_at', { ascending: true }),
      supabase
        .from('report_attachments')
        .select('*')
        .eq('report_id', id),
      supabase
        .from('report_signatures')
        .select('*')
        .eq('report_id', id),
      supabase
        .from('report_checklist_items')
        .select('*')
        .eq('report_id', id)
        .order('created_at', { ascending: true }),
    ]);

  if (reportRes.error) throw reportRes.error;

  const rawAttachments = (attachmentsRes.data ?? []) as ReportAttachment[];
  const rawSignatures = (signaturesRes.data ?? []) as ReportSignature[];

  const [attUrls, sigUrls] = await Promise.all([
    signReportMediaUrls(rawAttachments.map(a => a.url)),
    signReportMediaUrls(rawSignatures.map(s => s.image_url)),
  ]);

  return {
    report: reportRes.data as ServiceReport,
    history: (historyRes.data ?? []) as ReportStatusHistory[],
    attachments: rawAttachments.map((a, i) => ({ ...a, url: attUrls[i] || a.url })),
    signatures: rawSignatures.map((s, i) => ({ ...s, image_url: sigUrls[i] || s.image_url })),
    checklistItems: (checklistRes.data ?? []) as ReportChecklistItem[],
  };
}
