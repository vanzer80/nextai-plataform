import { ClipboardList, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';

interface Props {
  isLoading: boolean;
  count: number;
  isTeamReports: boolean;
}

export function ReportsKpiWidget({ isLoading, count, isTeamReports }: Props) {
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isTeamReports ? 'OS Abertas (Geral)' : 'Minhas OS Pendentes'}
        </CardTitle>
        <ClipboardList className="h-4 w-4 text-primary opacity-80" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-16 mb-2 rounded-lg" />
        ) : (
          <div className="text-3xl font-extrabold text-foreground">{count}</div>
        )}
        {isLoading ? (
          <Skeleton className="h-4 w-24 rounded" />
        ) : (
          <p className="text-xs text-muted-foreground font-medium flex items-center mt-1">
            <Clock className="mr-1 h-3 w-3" /> Atualizado agora
          </p>
        )}
      </CardContent>
    </Card>
  );
}
