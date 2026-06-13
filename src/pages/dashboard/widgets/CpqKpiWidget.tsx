import { FileText, TrendingUp, TrendingDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { CpqKpis } from '../useDashboardData';

interface Props {
  isLoading: boolean;
  kpis: CpqKpis | null;
}

export function CpqKpiWidget({ isLoading, kpis }: Props) {
  const taxa = kpis && kpis.total_periodo > 0
    ? Math.round((kpis.aprovados / kpis.total_periodo) * 100)
    : null;

  const trend = kpis && kpis.total_anterior > 0
    ? Math.round(((kpis.total_periodo - kpis.total_anterior) / kpis.total_anterior) * 100)
    : null;

  const TrendIcon = trend !== null && trend < 0 ? TrendingDown : TrendingUp;

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Orçamentos (CPQ)
        </CardTitle>
        <FileText className="h-4 w-4 text-violet-500 opacity-80" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16 mb-2 rounded-lg" />
            <Skeleton className="h-4 w-32 rounded" />
          </>
        ) : (
          <>
            <div className="flex items-end gap-2">
              <span className="text-3xl font-extrabold text-foreground">{kpis?.total_periodo ?? 0}</span>
              {trend !== null && (
                <span className={`text-xs font-semibold mb-1 flex items-center gap-0.5 ${trend >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                  <TrendIcon className="h-3 w-3" />
                  {trend >= 0 ? '+' : ''}{trend}%
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-muted-foreground">
              <span className="text-emerald-600 font-medium">{kpis?.aprovados ?? 0} aprovados</span>
              <span>{kpis?.pendentes ?? 0} pendentes</span>
              {(kpis?.expirados ?? 0) > 0 && (
                <span className="text-amber-600 font-medium">{kpis!.expirados} expirados</span>
              )}
              {taxa !== null && (
                <span className="font-medium">{taxa}% conversão</span>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
