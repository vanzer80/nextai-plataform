import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ExternalLink, Loader2, TrendingDown, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Badge } from '@/src/components/ui/badge';
import { getEquipmentReports } from '@/src/services/equipmentService';
import { maintenanceStatus, calculateLifecycle } from '@/src/types/equipment';
import type { Equipment, EquipmentReport } from '@/src/types/equipment';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const STATUS_LABELS: Record<string, string> = {
  draft: 'Rascunho', pending_review: 'Aguardando', returned: 'Devolvida',
  approved: 'Aprovada', rejected: 'Reprovada',
};
const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
  draft: 'outline', pending_review: 'secondary', returned: 'secondary',
  approved: 'default', rejected: 'destructive',
};

const MAINT_CONFIG = {
  vencida:   { label: 'Preventiva vencida',  className: 'bg-destructive/15 text-destructive border-destructive/30' },
  proxima:   { label: 'Preventiva próxima',  className: 'bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/20 dark:text-amber-400' },
  ok:        { label: 'Manutenção em dia',   className: 'bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400' },
  'sem-dados': { label: '',                  className: '' },
};

function fmtDate(d: string | null | undefined) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
}

interface Props {
  equipment: Equipment | null;
  open: boolean;
  onClose: () => void;
}

export default function EquipmentDetailDialog({ equipment, open, onClose }: Props) {
  const navigate = useNavigate();
  const [reports, setReports] = useState<EquipmentReport[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!equipment || !open) return;
    setLoading(true);
    getEquipmentReports(equipment.id)
      .then(setReports)
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [equipment?.id, open]);

  if (!equipment) return null;

  const ms = maintenanceStatus(equipment);
  const msConfig = MAINT_CONFIG[ms];
  const lifecycle = calculateLifecycle(equipment, 0);

  const warrantyExpired = equipment.warranty_until
    ? new Date(equipment.warranty_until) < new Date()
    : false;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {equipment.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {/* Dados do ativo */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <div><span className="text-muted-foreground">Cliente</span><p className="font-medium">{equipment.clients?.name ?? '—'}</p></div>
            <div><span className="text-muted-foreground">Tipo</span><p className="font-medium">{equipment.type ?? '—'}</p></div>
            <div><span className="text-muted-foreground">Fabricante</span><p className="font-medium">{equipment.manufacturer ?? '—'}</p></div>
            <div><span className="text-muted-foreground">Modelo</span><p className="font-medium">{equipment.model ?? '—'}</p></div>
            <div><span className="text-muted-foreground">Nº Série</span><p className="font-medium">{equipment.serial_number ?? '—'}</p></div>
            <div>
              <span className="text-muted-foreground">Garantia até</span>
              <p className={`font-medium ${warrantyExpired ? 'text-destructive' : ''}`}>
                {equipment.warranty_until ? `${fmtDate(equipment.warranty_until)}${warrantyExpired ? ' (vencida)' : ''}` : '—'}
              </p>
            </div>
            <div><span className="text-muted-foreground">Instalação</span><p className="font-medium">{fmtDate(equipment.installation_date)}</p></div>
            <div><span className="text-muted-foreground">Últ. manutenção</span><p className="font-medium">{fmtDate(equipment.last_maintenance_at)}</p></div>
            {equipment.maintenance_interval_days && (
              <div className="col-span-2">
                <span className="text-muted-foreground">Intervalo preventiva</span>
                <p className="font-medium">{equipment.maintenance_interval_days} dias</p>
              </div>
            )}
          </div>

          {ms !== 'sem-dados' && (
            <div className={`text-xs font-semibold px-3 py-1.5 rounded-full border inline-block ${msConfig.className}`}>
              {msConfig.label}
            </div>
          )}

          {/* Ciclo de Vida Financeiro */}
          {lifecycle && (
            <div className="pt-1">
              <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <TrendingDown className="h-4 w-4 text-primary" />
                Ciclo de Vida Financeiro
              </h3>
              <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Valor Contábil</span>
                  <p className="font-medium">{BRL.format(lifecycle.currentBookValue)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Custo de Aquisição</span>
                  <p className="font-medium">{BRL.format(equipment.acquisition_cost ?? 0)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Depreciação Acum.</span>
                  <p className="font-medium">{BRL.format(lifecycle.totalDepreciation)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Vida Útil Restante</span>
                  <p className={`font-medium ${lifecycle.yearsRemaining <= 0 ? 'text-destructive' : lifecycle.yearsRemaining <= 1 ? 'text-amber-600' : ''}`}>
                    {lifecycle.yearsRemaining <= 0 ? 'Esgotada' : `${lifecycle.yearsRemaining.toFixed(1)} anos`}
                  </p>
                </div>
              </div>
              {lifecycle.yearsRemaining <= 0 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-destructive bg-destructive/10 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Vida útil encerrada — considere substituição ou reavaliação.
                </div>
              )}
              {lifecycle.yearsRemaining > 0 && lifecycle.yearsRemaining <= 1 && (
                <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/20 rounded-lg px-3 py-1.5">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                  Menos de 1 ano de vida útil restante.
                </div>
              )}
            </div>
          )}

          {/* Histórico de OS */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Histórico de OS</h3>
            {loading ? (
              <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : reports.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma OS vinculada a este equipamento.</p>
            ) : (
              <div className="space-y-2">
                {reports.map(r => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { onClose(); navigate(`/reports/${r.id}`); }}
                    className="w-full flex items-center justify-between text-left p-3 rounded-lg border border-border hover:bg-muted transition-colors group"
                  >
                    <div>
                      <p className="text-sm font-medium">{r.os_number ? `OS ${r.os_number}` : r.id.slice(0, 8).toUpperCase()}</p>
                      <p className="text-xs text-muted-foreground">{fmtDate(r.service_date ?? r.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={STATUS_VARIANTS[r.status] ?? 'outline'} className="text-xs">
                        {STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
