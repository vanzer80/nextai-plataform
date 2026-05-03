import { Fragment, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  ArrowLeft, AlertTriangle, Calendar, MapPin, Wrench,
  Stethoscope, ClipboardList, Camera, PenLine, History,
  CheckCircle2, XCircle, Loader2, FileDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useReportDetail } from '@/src/hooks/useReportDetail';
import ReportStatusBadge from './components/ReportStatusBadge';
import AttachmentGrid from './components/AttachmentGrid';
import ApprovalPanel from './components/ApprovalPanel';
import type { ReportChecklistItem, ReportStatusHistory } from '@/src/types/reports';
import { REPORT_STATUS_LABEL } from '@/src/types/reports';
import { gerarPdfRelatorio } from '@/src/utils/gerarPdfRelatorio';

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
  const { report, history, attachments, signatures, checklistItems, loading, error, refresh } =
    useReportDetail(id);

  const isReviewer = REVIEWER_ROLES.includes(user?.role as typeof REVIEWER_ROLES[number]);
  const [isPdfLoading, setIsPdfLoading] = useState(false);

  const handleExportPdf = async () => {
    if (!report) return;
    setIsPdfLoading(true);
    try {
      await gerarPdfRelatorio({ report, checklistItems, signatures, attachments });
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
        <p className="text-sm">Carregando relatório...</p>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-muted-foreground">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-sm font-medium">{error ?? 'Relatório não encontrado.'}</p>
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
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto pb-10">

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
          <div className="flex items-center gap-2 flex-wrap">
            <ReportStatusBadge status={report.status} />
            {report.service_type && (
              <span className="text-xs text-muted-foreground font-medium">{report.service_type}</span>
            )}
          </div>
          <h1 className="text-xl font-bold text-foreground mt-1 leading-tight">
            {report.os_number ? `OS ${report.os_number}` : 'Relatório sem OS'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(report.service_date)}</p>
        </div>
        {report.status === 'approved' && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportPdf}
            disabled={isPdfLoading}
            className="shrink-0 gap-1.5 rounded-xl border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700/60 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
          >
            {isPdfLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <FileDown className="h-4 w-4" />}
            <span className="hidden sm:inline">Exportar PDF</span>
          </Button>
        )}
      </div>

      {/* Painel de aprovação — visível apenas para gestores */}
      {isReviewer && (
        <ApprovalPanel report={report} onSuccess={refresh} />
      )}

      {/* Alerta de devolução */}
      {report.status === 'returned' && report.reviewer_comment && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-500/40 bg-amber-100/70 dark:bg-amber-500/15 p-4 flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Relatório devolvido para ajuste</p>
            <p className="text-sm text-amber-800 dark:text-amber-300 mt-0.5">{report.reviewer_comment}</p>
          </div>
        </div>
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
        <Card className="shadow-sm border-border">
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
