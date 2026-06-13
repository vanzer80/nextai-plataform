import { Star } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';

interface Props {
  isLoading: boolean;
  csatAvg: number | null;
  responseCount: number;
}

export function CsatWidget({ isLoading, csatAvg, responseCount }: Props) {
  const isLow = csatAvg !== null && csatAvg < 3.5;
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-semibold text-muted-foreground">Satisfação do Cliente</CardTitle>
        <Star className="h-4 w-4 text-amber-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-9 w-20" />
        ) : (
          <div className={`text-3xl font-extrabold ${isLow ? 'text-destructive' : 'text-foreground'}`}>
            {csatAvg === null ? '—' : `${csatAvg.toFixed(1)} ★`}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1 font-medium">
          {responseCount > 0 ? `${responseCount} avaliações (30d)` : 'Nenhuma avaliação ainda'}
        </p>
      </CardContent>
    </Card>
  );
}
