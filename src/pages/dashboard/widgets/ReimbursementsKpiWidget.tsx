import { DollarSign, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';

interface Props {
  isLoading: boolean;
  sum: number;
  isTeamFinance: boolean;
}

export function ReimbursementsKpiWidget({ isLoading, sum, isTeamFinance }: Props) {
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {isTeamFinance ? 'Reembolsos Pendentes' : 'Meus Reembolsos Aprovados'}
        </CardTitle>
        {isTeamFinance ? (
          <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400 opacity-80" />
        ) : (
          <Receipt className="h-4 w-4 text-emerald-600 dark:text-emerald-400 opacity-80" />
        )}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24 mb-2 rounded-lg" />
        ) : (
          <div className="text-3xl font-extrabold text-foreground">
            R$ {sum.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        )}
        {isLoading ? (
          <Skeleton className="h-4 w-32 rounded" />
        ) : (
          <p className={`text-xs font-medium flex items-center mt-1 rounded-md px-2 py-0.5 w-fit ${
            isTeamFinance
              ? 'bg-amber-100/70 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300'
              : 'bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
          }`}>
            {isTeamFinance ? 'Aguardando aprovação' : 'Pronto para pagamento'}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
