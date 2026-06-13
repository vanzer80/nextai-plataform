import { CalendarDays, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { AgendaKpis } from '../useDashboardData';

interface Props {
  isLoading: boolean;
  kpis: AgendaKpis | null;
}

export function AgendaHojeWidget({ isLoading, kpis }: Props) {
  const hasAlert = (kpis?.criticas_abertas ?? 0) > 0 || (kpis?.vencidas_sla ?? 0) > 0;

  return (
    <Card className={`shadow-sm border-border ${hasAlert ? 'border-amber-300 dark:border-amber-700' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Agenda Hoje
        </CardTitle>
        <CalendarDays className={`h-4 w-4 opacity-80 ${hasAlert ? 'text-amber-500' : 'text-sky-500'}`} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16 mb-2 rounded-lg" />
            <Skeleton className="h-4 w-36 rounded" />
          </>
        ) : (
          <>
            <div className="text-3xl font-extrabold text-foreground">{kpis?.os_hoje ?? 0}</div>
            <p className="text-xs text-muted-foreground mt-0.5">
              OS agendadas · {kpis?.tecnicos_hoje ?? 0} técnico{(kpis?.tecnicos_hoje ?? 0) !== 1 ? 's' : ''} alocado{(kpis?.tecnicos_hoje ?? 0) !== 1 ? 's' : ''}
            </p>
            {hasAlert && (
              <div className="flex gap-3 mt-2 text-xs">
                {(kpis?.criticas_abertas ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-rose-600 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    {kpis!.criticas_abertas} crítica{kpis!.criticas_abertas !== 1 ? 's' : ''}
                  </span>
                )}
                {(kpis?.vencidas_sla ?? 0) > 0 && (
                  <span className="flex items-center gap-1 text-amber-600 font-medium">
                    <AlertTriangle className="h-3 w-3" />
                    {kpis!.vencidas_sla} SLA vencido{kpis!.vencidas_sla !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
