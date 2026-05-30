import { Fragment, useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, AlertTriangle, Calendar, MapPin, Wrench,
  Stethoscope, ClipboardList, Camera, PenLine, History,
  CheckCircle2, XCircle, Loader2, FileDown, SquarePen, Send, Copy, RotateCcw, Receipt,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { useReportDetail } from '@/src/hooks/useReportDetail';
import ReportStatusBadge from './components/ReportStatusBadge';
import AttachmentGrid from './components/AttachmentGrid';
import ApprovalPanel from './components/ApprovalPanel';
import type { ReportChecklistItem, ReportStatusHistory } from '@/src/types/reports';
import { REPORT_STATUS_LABEL } from '@/src/types/reports';
import { gerarPdfRelatorio } from '@/src/utils/gerarPdfRelatorio';
import { resubmitReport, reopenReport } from '@/src/services/reportService';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';

const REVIEWER_ROLES = ['Gestor', 'Supervisor', 'Admin', 'Master'] as const;

// ── Helpers ───────────────────────────────────────────────────

function fmtDate(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }); } catch { return d; }
}

function fmtTime(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), 'HH:mm', { locale: ptBR }); } catch { return d; }
}

function fmtDateTime(d: string | null) {
  if (!d) return '—';
  try { return format(parseISO(d), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }); } catch { return d; }
}

// ── Sub-components ────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  if (!value && value !== 0) return null;
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function ChecklistItemRow({ item }: { item: ReportChecklistItem }) {
  const value = (() => {
    if (item.item_type === 'boolean') return item.value_boolean == null ? null : item.value_boolean ? 'Sim' : 'Não';
    if (item.item_type === 'text') return item.value_text;
    if (item.item_type === 'number') return item.value_number?.toString();
    if (item.item_type === 'select') return item.value_option;
    if (item.item_type === 'photo') return item.attachment_url ? 'Foto anexada' : null;
    return null;
  })();

  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border last:border-0">
      <p className="text-sm text-foreground/90 flex-1">{item.label}</p>
      <div className="flex items-center gap-1.5 shrink-0">
        {item.is_conformant === true && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
        {item.is_conformant === false && <XCircle className="h-3.5 w-3.5 text-rose-500" />}
        <span className="text-xs font-medium text-muted-foreground">{value ?? '—'}</span>
      </div>
    </div>
  );
}

const STATUS_HISTORY_COLOR: Record<string, string> = {
  draft:          'bg-muted-foreground',
  pending_review: 'bg-amber-500',
  returned:       'bg-orange-500',
  approved:       'bg-emerald-500',
  rejected:       'bg-rose-500',
};

function HistoryTimeline({ history }: { history: ReportStatusHistory[] }) {
  if (history.length === 0) return <p className="text-sm text-muted-foreground py-2">Sem histórico registrado.</p>;

  return (
    <ol className="relative border-l border-border space-y-5 pl-5">
      {history.map(h => (
        <li key={h.id} className="relative">
          <span className={`absolute -left-[22px] top-1 h-3 w-3 rounded-full ring-2 ring-background ${STATUS_HISTORY_COLOR[h.to_status] ?? 'bg-muted-foreground'}`} />
          <p className="text-xs font-bold text-foreground/90">
            {REPORT_STATUS_LABEL[h.to_status]}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{fmtDateTime(h.created_at)}</p>
          {h.comment && (
            <p className="text-xs text-muted-foreground mt-1 bg-muted rounded-lg px-3 py-2 border border-border">
              {h.comment}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

// ── Main ──────────────────────────────────────────────────────

export default function ReportDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { report, history, attachments, signatures, checklistItems, loading, error, refresh } =
    useReportDetail(id);

  const isReviewer = REVIEWER_ROLES.includes(user?.role as typeof REVIEWER_ROLES[number]);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  // ── Correção inline para OS devolvidas ───────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [isSendingCorrection, setIsSendingCorrection] = useState(false);
  const [editData, setEditData] = useState({
    reported_problem: '',
    preliminary_diagnosis: '',
    final_diagnosis: '',
    services_performed: '',
    parts_used: '',
    pending_issues: '',
    technical_recommendation: '',
    internal_notes: '',
  });

  useEffect(() => {
    if (isEditing && report) {
      setEditData({
        reported_problem:         report.reported_problem ?? '',
        preliminary_diagnosis:    report.preliminary_diagnosis ?? '',
        final_diagnosis:          report.final_diagnosis ?? '',
        services_performed:       report.services_performed ?? '',
        parts_used:               report.parts_used ?? '',
        pending_issues:           report.pending_issues ?? '',
        technical_recommendation: report.technical_recommendation ?? '',
        internal_notes:           report.internal_notes ?? '',
      });
    }
  }, [isEditing, report]);

  // ── Reabrir OS reprovada ─────────────────────────────────────
  const [isReopening, setIsReopening] = useState(false);
  const [isSubmittingReopen, setIsSubmittingReopen] = useState(false);

  const handleReopen = useCallback(async () => {
    if (!report) return;
    setIsSubmittingReopen(true);
    try {
      await reopenReport(report.id);
      toast.success('OS reaberta para correção.', {
        description: 'Use o formulário de correção para ajustar e reenviar.',
      });
      setIsReopening(false);
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reabrir OS.');
    } finally {
      setIsSubmittingReopen(false);
    }
  }, [report, refresh]);

  const handleSubmitCorrection = useCallback(async () => {
    if (!report) return;
    setIsSendingCorrection(true);
    try {
      await resubmitReport({ reportId: report.id, ...editData });
      toast.success('OS reenviada para revisão.', {
        description: 'O gestor será notificado para nova análise.',
      });
      setIsEditing(false);
      refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao reenviar OS.');
    } finally {
      setIsSendingCorrection(false);
    }
  }, [report, editData, refresh]);

  const handleExportPdf = async () => {
    if (!report) return;
    setIsPdfLoading(true);
    try {
      await gerarPdfRelatorio({ report, checklistItems, signatures, attachments, tenantName: tenant?.name ?? 'Portal', tenantLogoUrl: tenant?.logoUrl ?? null });
    } finally {
      setIsPdfLoading(false);
    }
  };

  // Realtime: recarrega quando o status do relatório muda
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`report_detail_${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'report_status_history', filter: `report_id=eq.${id}` },
        () => refresh(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, refresh]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm">Carregando OS...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium">{error ?? 'OS não encontrada.'}</p>
        <Button variant="outline" onClick={() => navigate('/reports')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para lista
        </Button>
      </div>
    );
  }

  const clientName = report.clients?.name ?? null;
  const techName = report.users?.full_name ?? null;
  const assetName = report.equipments?.name ?? report.asset_name_manual ?? null;
  const hasDiagnosis = report.reported_problem || report.preliminary_diagnosis || report.final_diagnosis || report.internal_notes;
  const hasExecution = report.services_performed || report.parts_used || report.pending_issues || report.technical_recommendation;

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto pb-10 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/reports')}
          className="h-10 w-10 shrink-0 rounded-full hover:bg-muted mt-0.5"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap" data-onboarding="detail-status">
            <ReportStatusBadge status={report.status} />
            {report.service_type && (
              <span className="text-xs text-muted-foreground font-medium">{report.service_type}</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground mt-1 leading-tight">
            {report.os_number ? `OS ${report.os_number}` : 'OS sem número'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(report.service_date)}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Duplicar — disponível para todos os status */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/reports/new?duplicateFrom=${report.id}`)}
            className="gap-1.5 rounded-xl"
            title="Usar esta OS como base para uma nova"
          >
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Duplicar</span>
          </Button>

          {/* Gerar Orçamento */}
          {report.status !== 'draft' && ['Gestor', 'Supervisor', 'Admin', 'Master', 'Técnico'].includes(user?.role ?? '') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/orcamentos/novo?fromOS=${report.id}`)}
              className="gap-1.5 rounded-xl"
            >
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Orçamento</span>
            </Button>
          )}

          {/* PDF — apenas para OS aprovadas */}
          {report.status === 'approved' && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPdf}
              disabled={isPdfLoading}
              data-onboarding="detail-pdf"
              className="gap-1.5 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700/60 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
            >
              {isPdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              <span className="hidden sm:inline">PDF</span>
            </Button>
          )}
        </div>
      </div>

      {/* Painel de aprovação — visível apenas para gestores */}
      {isReviewer && (
        <div data-onboarding="detail-aprovacao">
          <ApprovalPanel report={report} onSuccess={refresh} />
        </div>
      )}

      {/* Alerta de devolução + form de correção inline */}
      {report.status === 'returned' && (
        <>
          {report.reviewer_comment && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-100/70 dark:bg-amber-500/15 p-4 flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">OS devolvida para ajuste</p>
                <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">{report.reviewer_comment}</p>
              </div>
            </div>
          )}

          {/* Form de correção — visível apenas para o técnico responsável */}
          {user?.id === report.technician_id && (
            <Card className="shadow-sm border-orange-200 dark:border-orange-700/40">
              <CardHeader className="pb-3 border-b border-orange-200 dark:border-orange-700/40 bg-orange-50/60 dark:bg-orange-900/20 rounded-t-xl">
                <CardTitle className="text-base flex items-center gap-2 text-orange-800 dark:text-orange-300">
                  <SquarePen className="h-4 w-4" />
                  Corrigir e Reenviar OS
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {!isEditing ? (
                  <Button
                    onClick={() => setIsEditing(true)}
                    className="w-full h-11 rounded-xl font-semibold bg-orange-600 hover:bg-orange-700 text-white gap-2"
                  >
                    <SquarePen className="h-4 w-4" />
                    Abrir para correção
                  </Button>
                ) : (
                  <div className="space-y-4">
                    {(
                      [
                        { key: 'reported_problem',         label: 'Problema relatado' },
                        { key: 'preliminary_diagnosis',    label: 'Diagnóstico preliminar' },
                        { key: 'final_diagnosis',          label: 'Diagnóstico final' },
                        { key: 'services_performed',       label: 'Serviços executados' },
                        { key: 'parts_used',               label: 'Peças / Materiais' },
                        { key: 'pending_issues',           label: 'Pendências' },
                        { key: 'technical_recommendation', label: 'Recomendação técnica' },
                        { key: 'internal_notes',           label: 'Notas internas' },
                      ] as const
                    ).map(({ key, label }) => (
                      <div key={key} className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
                        <Textarea
                          value={editData[key]}
                          onChange={e => setEditData(prev => ({ ...prev, [key]: e.target.value }))}
                          placeholder={label}
                          className="resize-none rounded-xl bg-background border-input text-sm focus-visible:ring-ring min-h-[72px]"
                        />
                      </div>
                    ))}

                    <div className="flex gap-3 pt-2">
                      <Button
                        onClick={handleSubmitCorrection}
                        disabled={isSendingCorrection}
                        className="flex-1 h-11 rounded-xl font-semibold bg-orange-600 hover:bg-orange-700 text-white gap-2"
                      >
                        {isSendingCorrection
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Reenviando...</>
                          : <><Send className="h-4 w-4" /> Reenviar para revisão</>
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        onClick={() => setIsEditing(false)}
                        disabled={isSendingCorrection}
                        className="h-11 px-4 rounded-xl text-sm"
                      >
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* OS reprovada — alerta + opção de reabrir para o técnico */}
      {report.status === 'rejected' && (
        <>
          {report.reviewer_comment && (
            <div className="rounded-xl border border-rose-300 dark:border-rose-500/40 bg-rose-100/70 dark:bg-rose-500/15 p-4 flex gap-3">
              <XCircle className="h-5 w-5 text-rose-700 dark:text-rose-300 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-rose-800 dark:text-rose-300">OS reprovada</p>
                <p className="text-sm text-rose-800 dark:text-rose-300 mt-0.5">{report.reviewer_comment}</p>
              </div>
            </div>
          )}

          {user?.id === report.technician_id && (
            <Card className="shadow-sm border-rose-200 dark:border-rose-700/40">
              <CardHeader className="pb-3 border-b border-rose-200 dark:border-rose-700/40 bg-rose-50/60 dark:bg-rose-900/20 rounded-t-xl">
                <CardTitle className="text-base flex items-center gap-2 text-rose-800 dark:text-rose-300">
                  <RotateCcw className="h-4 w-4" />
                  Contestar reprovação
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {!isReopening ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted-foreground">
                      Reabra a OS para corrigi-la e reenviá-la para revisão. O histórico de reprovação é preservado.
                    </p>
                    <Button
                      onClick={() => setIsReopening(true)}
                      className="w-full h-11 rounded-xl font-semibold gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      <RotateCcw className="h-4 w-4" />
                      Reabrir OS para correção
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-medium text-foreground">Confirma a reabertura desta OS?</p>
                    <p className="text-xs text-muted-foreground">A OS voltará ao status "Devolvida" e você poderá corrigi-la e reenviar.</p>
                    <div className="flex gap-3">
                      <Button
                        onClick={handleReopen}
                        disabled={isSubmittingReopen}
                        className="flex-1 h-11 rounded-xl font-semibold gap-2 bg-rose-600 hover:bg-rose-700 text-white"
                      >
                        {isSubmittingReopen
                          ? <><Loader2 className="h-4 w-4 animate-spin" /> Reabrindo...</>
                          : <><RotateCcw className="h-4 w-4" /> Confirmar reabertura</>
                        }
                      </Button>
                      <Button variant="ghost" onClick={() => setIsReopening(false)} disabled={isSubmittingReopen} className="h-11 px-4 rounded-xl">
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Identificação */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" />
            Identificação
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label="Tipo de serviço" value={report.service_type} />
          <Field label="Data" value={fmtDate(report.service_date)} />
          <Field label="Número OS" value={report.os_number} />
          {techName && <Field label="Técnico" value={techName} />}
          <Field label="Hora início" value={report.started_at ? fmtTime(report.started_at) : null} />
          <Field label="Hora término" value={report.finished_at ? fmtTime(report.finished_at) : null} />
          {report.total_minutes != null && (
            <Field label="Duração" value={`${report.total_minutes} min`} />
          )}
          {clientName && <Field label="Cliente" value={clientName} />}
          {report.site_location && (
            <div className="col-span-2">
              <Field label="Local / Unidade" value={report.site_location} />
            </div>
          )}
          {assetName && (
            <div className="col-span-2">
              <Field label="Equipamento" value={assetName} />
            </div>
          )}
          {report.geo_lat != null && report.geo_lng != null && (
            <div className="col-span-2 space-y-0.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Geolocalização</p>
              <a
                href={`https://maps.google.com/?q=${report.geo_lat},${report.geo_lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
              >
                <MapPin className="h-3.5 w-3.5" />
                {report.geo_lat.toFixed(5)}, {report.geo_lng.toFixed(5)}
                {report.geo_accuracy && (
                  <span className="text-muted-foreground">(±{Math.round(report.geo_accuracy)}m)</span>
                )}
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Diagnóstico */}
      {hasDiagnosis && (
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <Stethoscope className="h-4 w-4 text-primary" />
              Diagnóstico Técnico
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <Field label="Problema relatado pelo cliente" value={report.reported_problem} />
            <Field label="Diagnóstico preliminar" value={report.preliminary_diagnosis} />
            <Field label="Diagnóstico final" value={report.final_diagnosis} />
            <Field label="Notas internas" value={report.internal_notes} />
          </CardContent>
        </Card>
      )}

      {/* Execução */}
      {hasExecution && (
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Execução do Serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <Field label="Serviços executados" value={report.services_performed} />
            <Field label="Peças / Materiais utilizados" value={report.parts_used} />
            <Field label="Pendências" value={report.pending_issues} />
            <Field label="Recomendação técnica" value={report.technical_recommendation} />
          </CardContent>
        </Card>
      )}

      {/* Checklist */}
      {checklistItems.length > 0 && (
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              Checklist
              <span className="ml-auto text-xs font-normal text-muted-foreground">{checklistItems.length} itens</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2 pb-2">
            {checklistItems.map(item => (
              <Fragment key={item.id}>
                <ChecklistItemRow item={item} />
              </Fragment>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Evidências */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
          <CardTitle className="text-base flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Evidências Fotográficas
            <span className="ml-auto text-xs font-normal text-muted-foreground">{attachments.length}/4</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <AttachmentGrid attachments={attachments} />
        </CardContent>
      </Card>

      {/* Assinaturas */}
      {signatures.length > 0 && (
        <Card className="shadow-sm border-border" data-onboarding="detail-assinaturas">
          <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <PenLine className="h-4 w-4 text-primary" />
              Assinaturas
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">
            {signatures.map(sig => (
              <div key={sig.id} className="space-y-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {sig.signature_type === 'technician' ? 'Técnico' :
                   sig.signature_type === 'client' ? 'Cliente' : 'Supervisor'}
                  {sig.signer_name && ` — ${sig.signer_name}`}
                </p>
                <div className="rounded-xl border border-border overflow-hidden bg-card">
                  <img
                    src={sig.image_url}
                    alt={`Assinatura ${sig.signature_type}`}
                    className="w-full h-[120px] object-contain p-2"
                  />
                </div>
                {sig.signed_at && (
                  <p className="text-[11px] text-muted-foreground">{fmtDateTime(sig.signed_at)}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Histórico de status */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Histórico
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 pb-3">
          <HistoryTimeline history={history} />
        </CardContent>
      </Card>

    </div>
  );
}
