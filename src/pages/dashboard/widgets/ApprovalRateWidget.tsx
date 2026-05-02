import { CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  isLoading: boolean;
  approvalRate: number | null;
}

export function ApprovalRateWidget({ isLoading, approvalRate }: Props) {
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Taxa de Aprovação
        </CardTitle>
        <CheckCircle className="h-4 w-4 text-emerald-600 dark:text-emerald-400 opacity-80" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20 mb-2 rounded-lg" />
        ) : (
          <div className="text-3xl font-extrabold text-foreground">
            {approvalRate === null ? '—' : `${approvalRate.toFixed(1)}%`}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1 font-medium">Eficiência do faturamento (30d)</p>
      </CardContent>
    </Card>
  );
}
