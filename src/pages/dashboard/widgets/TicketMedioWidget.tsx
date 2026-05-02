import { TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  isLoading: boolean;
  avgTicket: number;
}

export function TicketMedioWidget({ isLoading, avgTicket }: Props) {
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Ticket Médio (Aprovados 30d)
        </CardTitle>
        <TrendingUp className="h-4 w-4 text-primary opacity-80" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-24 mb-2 rounded-lg" />
        ) : (
          <div className="text-3xl font-extrabold text-foreground">
            R$ {avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
        )}
        <p className="text-xs text-muted-foreground mt-1 font-medium">Por solicitação aprovada</p>
      </CardContent>
    </Card>
  );
}
