import { Link } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Clock, MapPin, Wrench, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import ReportStatusBadge from './ReportStatusBadge';
import SyncStatusIndicator from './SyncStatusIndicator';
import type { ServiceReport } from '@/src/types/reports';
import type { SyncStatus } from '@/src/lib/reportIndexedDB';

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

  return (
    <Card className="overflow-hidden shadow-sm border-slate-200 hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        {/* Status + Data */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <ReportStatusBadge status={report.status} />
            {report.service_type && (
              <span className="text-xs text-slate-500 font-medium">{report.service_type}</span>
            )}
          </div>
          <div className="flex items-center text-slate-400 text-xs shrink-0 gap-1">
            <Clock className="h-3.5 w-3.5" />
            {dateLabel}
          </div>
        </div>

        {/* OS + Local */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-blue-600 shrink-0" />
            <span className="text-sm font-bold text-slate-900 leading-tight">
              {clientName}
              {report.site_location && (
                <span className="font-normal text-slate-500"> — {report.site_location}</span>
              )}
            </span>
          </div>

          {(assetName || report.os_number) && (
            <div className="flex items-center gap-2 pl-6">
              <Wrench className="h-3.5 w-3.5 text-slate-400 shrink-0" />
              <span className="text-xs text-slate-600">
                {assetName ?? ''}
                {assetName && report.os_number ? ' · ' : ''}
                {report.os_number ? `OS ${report.os_number}` : ''}
              </span>
            </div>
          )}

          {report.reported_problem && (
            <p className="text-xs text-slate-500 line-clamp-2 pl-6 mt-1">
              "{report.reported_problem}"
            </p>
          )}
        </div>

        {/* Rodapé: técnico + sync + link */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-[10px] bg-slate-200 text-slate-700 font-bold">
                {initials(techName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-slate-600 font-medium">{techName}</span>
            {localSyncStatus && localSyncStatus !== 'synced' && (
              <SyncStatusIndicator status={localSyncStatus} />
            )}
          </div>

          <Link
            to={`/reports/${report.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
          >
            Detalhes <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
