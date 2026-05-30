import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, Wrench, ChevronRight, Timer, AlertTriangle } from 'lucide-react';
import { differenceInMinutes, parseISO as _parseISO } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReportStatusBadge from './ReportStatusBadge';
import SyncStatusIndicator from './SyncStatusIndicator';
import type { ServiceReport } from '@/src/types/reports';
import type { SyncStatus } from '@/src/lib/reportIndexedDB';
import { getAgingInfo, AGING_CLASSES } from '@/src/lib/aging';

interface ReportCardProps {
  report: ServiceReport;
  localSyncStatus?: SyncStatus;
}

function initials(name?: string | null) {
  if (!name) return 'T';
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export default function ReportCard({ report, localSyncStatus }: ReportCardProps) {
  const clientName = report.clients?.name ?? 'Cliente não informado';
  const techName = report.users?.full_name ?? 'Técnico';
  const assetName = report.equipments?.name ?? null;

  const dateLabel = report.service_date
    ? format(parseISO(report.service_date), "dd 'de' MMM, yyyy", { locale: ptBR })
    : format(parseISO(report.created_at), "dd 'de' MMM, yyyy", { locale: ptBR });

  const aging = report.status === 'pending_review'
    ? getAgingInfo(report.created_at, 2, 5)
    : null;

  const slaInfo = (() => {
    if (!report.sla_due_at) return null;
    const minutesLeft = differenceInMinutes(_parseISO(report.sla_due_at), new Date());
    if (minutesLeft < 0) return { label: 'SLA vencido', cls: 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300', icon: 'breached' };
    const hoursLeft = Math.floor(minutesLeft / 60);
    const minsLeft  = minutesLeft % 60;
    const label = hoursLeft > 0 ? `SLA ${hoursLeft}h ${minsLeft}min` : `SLA ${minsLeft}min`;
    const cls = minutesLeft < 60
      ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300'
      : minutesLeft < 240
        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300'
        : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300';
    return { label, cls, icon: 'ok' };
  })();

  return (
    <Card className="overflow-hidden shadow-sm border-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="p-4">
        {/* Status + Data */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 flex-wrap" data-onboarding="os-status-badge">
            <ReportStatusBadge status={report.status} />
            {report.os_number && (
              <span className="inline-flex items-center gap-1 text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                {report.os_number}
              </span>
            )}
            {report.service_type && (
              <span className="text-xs text-muted-foreground font-medium">{report.service_type}</span>
            )}
            {aging && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${AGING_CLASSES[aging.level]}`}>
                <Timer className="h-3 w-3" /> {aging.label} aguardando
              </span>
            )}
            {slaInfo && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${slaInfo.cls}`}>
                {slaInfo.icon === 'breached'
                  ? <AlertTriangle className="h-3 w-3" />
                  : <Clock className="h-3 w-3" />}
                {slaInfo.label}
              </span>
            )}
          </div>
          <div className="flex items-center text-muted-foreground text-xs shrink-0 gap-1">
            <Clock className="h-3.5 w-3.5" />
            {dateLabel}
          </div>
        </div>

        {/* OS + Local */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary shrink-0" />
            <span className="text-sm font-bold text-foreground leading-tight">
              {clientName}
              {report.site_location && (
                <span className="font-normal text-muted-foreground"> — {report.site_location}</span>
              )}
            </span>
          </div>

          {assetName && (
            <div className="flex items-center gap-2 pl-6">
              <Wrench className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">{assetName}</span>
            </div>
          )}

          {report.reported_problem && (
            <p className="text-xs text-muted-foreground line-clamp-2 pl-6 mt-1">
              "{report.reported_problem}"
            </p>
          )}
        </div>

        {/* Rodapé: técnico + sync + link */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-muted text-muted-foreground font-bold">
                {initials(techName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground font-medium">{techName}</span>
            {localSyncStatus && localSyncStatus !== 'synced' && (
              <SyncStatusIndicator status={localSyncStatus} />
            )}
          </div>

          <Link
            to={`/reports/${report.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
          >
            Detalhes <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
