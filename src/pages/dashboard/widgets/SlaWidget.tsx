import { ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  isLoading: boolean;
  slaRate: number | null;
}

export function SlaWidget({ isLoading, slaRate }: Props) {
  const isLow = slaRate !== null && slaRate < 80;

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Cumprimento de SLA
        </CardTitle>
        <ShieldCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400 opacity-80" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20 mb-2 rounded-lg" />
        ) : (
          <div className={`text-3xl font-extrabold ${isLow ? 'text-destructive' : 'text-foreground'}`}>
            {slaRate === null ? '—' : `${slaRate.toFixed(1)}%`}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1 font-medium">OS dentro do prazo contratual (30d)</p>
      </CardContent>
    </Card>
  );
}
