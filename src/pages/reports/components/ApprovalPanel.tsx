import { useState } from 'react';
import { CheckCircle2, XCircle, RotateCcw, Loader2, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { processReportAction } from '@/src/services/reportService';
import type { ReportAction } from '@/src/services/reportService';
import type { ServiceReport } from '@/src/types/reports';

interface ApprovalPanelProps {
  report: ServiceReport;
  onSuccess: () => void;
}

type Mode = ReportAction | null;

const ACTION_CONFIG = {
  approve: {
    label: 'Aprovar',
    icon: CheckCircle2,
    buttonClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    needsComment: false,
    confirmLabel: 'Confirmar aprovação',
    placeholder: '',
    successMessage: 'Relatório aprovado com sucesso!',
  },
  return: {
    label: 'Devolver',
    icon: RotateCcw,
    buttonClass: 'border-orange-300 text-orange-700 hover:bg-orange-50',
    confirmClass: 'bg-orange-600 hover:bg-orange-700 text-white',
    needsComment: true,
    confirmLabel: 'Confirmar devolução',
    placeholder: 'Descreva o que precisa ser corrigido pelo técnico...',
    successMessage: 'Relatório devolvido para ajuste.',
  },
  reject: {
    label: 'Reprovar',
    icon: XCircle,
    buttonClass: 'border-rose-300 text-rose-700 hover:bg-rose-50',
    confirmClass: 'bg-rose-600 hover:bg-rose-700 text-white',
    needsComment: true,
    confirmLabel: 'Confirmar reprovação',
    placeholder: 'Informe o motivo da reprovação...',
    successMessage: 'Relatório reprovado.',
  },
} as const;

export default function ApprovalPanel({ report, onSuccess }: ApprovalPanelProps) {
  const [mode, setMode] = useState<Mode>(null);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);

  const canProcess = report.status === 'pending_review' || report.status === 'returned';
  if (!canProcess) return null;

  const handleSelect = (action: ReportAction) => {
    setMode(action);
    setComment('');
  };

  const handleCancel = () => {
    setMode(null);
    setComment('');
  };

  const handleConfirm = async () => {
    if (!mode) return;
    const cfg = ACTION_CONFIG[mode];
    if (cfg.needsComment && !comment.trim()) {
      toast.warning('Informe um comentário antes de confirmar.');
      return;
    }

    setLoading(true);
    try {
      await processReportAction(report.id, mode, comment.trim() || undefined);
      toast.success(cfg.successMessage);
      setMode(null);
      setComment('');
      onSuccess();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar ação.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border-2 border-blue-200 bg-blue-50/60 p-4 space-y-3">
      <p className="text-xs font-bold text-blue-800 uppercase tracking-wide">Ação do Gestor</p>

      {/* Botões de ação */}
      {!mode && (
        <div className="flex gap-2 flex-wrap">
          {(['approve', 'return', 'reject'] as ReportAction[]).map(action => {
            const cfg = ACTION_CONFIG[action];
            const Icon = cfg.icon;
            return (
              <Button
                key={action}
                type="button"
                variant={action === 'approve' ? 'default' : 'outline'}
                onClick={() => handleSelect(action)}
                className={`flex-1 h-10 rounded-xl text-sm font-semibold gap-1.5 ${cfg.buttonClass}`}
              >
                <Icon className="h-4 w-4" />
                {cfg.label}
              </Button>
            );
          })}
        </div>
      )}

      {/* Painel de confirmação */}
      {mode && (() => {
        const cfg = ACTION_CONFIG[mode];
        const Icon = cfg.icon;
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <Icon className="h-4 w-4" />
              {cfg.label} — {report.os_number ? `OS ${report.os_number}` : 'este relatório'}
            </div>

            {cfg.needsComment && (
              <Textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder={cfg.placeholder}
                className="min-h-[90px] resize-none rounded-xl bg-white border-slate-300 text-sm focus-visible:ring-blue-600"
                autoFocus
              />
            )}

            {!cfg.needsComment && (
              <p className="text-sm text-slate-600">
                Confirme a aprovação do relatório. Uma notificação será enviada ao técnico.
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={loading || (cfg.needsComment && !comment.trim())}
                className={`flex-1 h-10 rounded-xl text-sm font-semibold gap-1.5 ${cfg.confirmClass}`}
              >
                {loading
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Processando...</>
                  : <><Icon className="h-4 w-4" /> {cfg.confirmLabel}</>
                }
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={handleCancel}
                disabled={loading}
                className="h-10 px-4 rounded-xl text-sm text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </Button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
