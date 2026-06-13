import { Briefcase } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Skeleton } from '@/src/components/ui/skeleton';
import type { PieEntry } from '../useDashboardData';

interface Props {
  isLoading: boolean;
  pieData: PieEntry[];
  isTeamFinance: boolean;
}

export function ReimbursementsPieWidget({ isLoading, pieData, isTeamFinance }: Props) {
  return (
    <Card className="shadow-sm border-border h-full flex flex-col min-w-0">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
          {isTeamFinance ? 'Despesas por Categoria (30d)' : 'Meus Gastos por Categoria (30d)'}
          <Briefcase className="h-4 w-4 text-muted-foreground" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 w-full min-h-[300px] min-w-0 flex flex-col items-center justify-center p-0">
        {isLoading ? (
          <div className="w-full h-full flex items-center justify-center relative">
            <Skeleton className="h-48 w-48 rounded-full" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-24 w-24 bg-card rounded-full" />
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={pieData} innerRadius={65} outerRadius={90} paddingAngle={5} dataKey="value" stroke="none">
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Volume']}
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--popover)', color: 'var(--popover-foreground)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
        {!isLoading && (
          <div className="grid grid-cols-2 gap-x-2 gap-y-3 w-full px-6 mb-4">
            {pieData.map((item, i) => (
              <div key={i} className="flex items-center text-xs text-muted-foreground">
                <span className="w-2.5 h-2.5 rounded-full mr-2 shrink-0" style={{ backgroundColor: item.fill }} />
                <span className="truncate">{item.name}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
