import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  isLoading: boolean;
  productivity: number;
  isTeamReports: boolean;
}

export function ProductivityWidget({ isLoading, productivity, isTeamReports }: Props) {
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isTeamReports ? 'Índice da Equipe (Semana)' : 'Minha Produtividade'}
        </CardTitle>
        <TrendingUp className="h-4 w-4 text-primary opacity-80" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20 mb-2 rounded-lg" />
        ) : (
          <div className="text-3xl font-extrabold text-foreground">{productivity}%</div>
        )}
        {isLoading ? (
          <Skeleton className="h-4 w-28 rounded" />
        ) : (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium flex items-center mt-1">
            <TrendingUp className="mr-1 h-3 w-3" /> Produtividade base estimada
          </p>
        )}
      </CardContent>
    </Card>
  );
}
