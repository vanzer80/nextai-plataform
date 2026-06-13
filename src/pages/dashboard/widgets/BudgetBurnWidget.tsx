import { useEffect, useState } from 'react';
import { TrendingUp, Loader2, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { getBudgetBurn } from '@/src/services/budgetService';
import type { BudgetBurnRow } from '@/src/types/budget';
import { PERIOD_LABELS } from '@/src/types/budget';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function StatusColor(pct: number): string {
  if (pct >= 100) return 'bg-destructive';
  if (pct >= 80)  return 'bg-amber-500';
  return 'bg-emerald-500';
}

interface Props {
  isLoading?: boolean;
}

export function BudgetBurnWidget({ isLoading: parentLoading }: Props) {
  const [rows, setRows] = useState<BudgetBurnRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBudgetBurn()
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const isLoading = parentLoading || loading;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          Burn Rate de Budget
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum budget configurado.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map(row => (
              <div key={row.category} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-medium text-foreground">{row.category}</span>
                    <span className="text-muted-foreground">
                      · {PERIOD_LABELS[row.period_type]}
                    </span>
                    {row.pct_used >= 100 && (
                      <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    )}
                    {row.pct_used >= 80 && row.pct_used < 100 && (
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    )}
                  </div>
                  <span className={`font-bold ${row.pct_used >= 100 ? 'text-destructive' : row.pct_used >= 80 ? 'text-amber-600' : 'text-foreground'}`}>
                    {row.pct_used.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${StatusColor(row.pct_used)}`}
                    style={{ width: `${Math.min(100, row.pct_used)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>{BRL.format(row.used_amount)} usados</span>
                  <span>limite {BRL.format(row.limit_amount)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
