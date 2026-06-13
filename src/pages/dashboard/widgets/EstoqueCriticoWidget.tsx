import { Package, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { EstoqueKpis } from '../useDashboardData';

interface Props {
  isLoading: boolean;
  kpis: EstoqueKpis | null;
}

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function EstoqueCriticoWidget({ isLoading, kpis }: Props) {
  const hasCriticos = (kpis?.criticos ?? 0) > 0;

  return (
    <Card className={`shadow-sm border-border ${hasCriticos ? 'border-rose-300 dark:border-rose-800' : ''}`}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Estoque Crítico
        </CardTitle>
        <Package className={`h-4 w-4 opacity-80 ${hasCriticos ? 'text-rose-500' : 'text-orange-400'}`} />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-16 mb-2 rounded-lg" />
            <Skeleton className="h-4 w-36 rounded" />
          </>
        ) : (
          <>
            <div className={`text-3xl font-extrabold ${hasCriticos ? 'text-rose-600' : 'text-foreground'}`}>
              {hasCriticos && <AlertTriangle className="inline h-6 w-6 mr-1 mb-0.5" />}
              {kpis?.criticos ?? 0}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              item{(kpis?.criticos ?? 0) !== 1 ? 's' : ''} abaixo do mínimo · {kpis?.total_itens ?? 0} total
            </p>
            {kpis && kpis.valor_total > 0 && (
              <p className="text-xs text-sky-600 dark:text-sky-400 font-medium mt-1">
                Estoque: {BRL.format(kpis.valor_total)}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
