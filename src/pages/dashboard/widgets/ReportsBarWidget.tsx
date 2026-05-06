import { useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import type { BarEntry } from '../useDashboardData';

interface Props {
  isLoading: boolean;
  barData: BarEntry[];
  isTeamReports: boolean;
}

export function ReportsBarWidget({ isLoading, barData, isTeamReports }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="shadow-sm border-border h-full flex flex-col min-w-0">
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base font-semibold text-foreground flex items-center justify-between">
          Balanço de Relatórios (Últimos 7 dias)
          <Button variant="ghost" size="sm" className="h-8 text-xs text-primary hover:bg-accent" onClick={() => navigate('/reports')}>
            Ver todos <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-[300px] w-full min-w-0 pt-4">
        {isLoading ? (
          <div className="w-full h-full flex items-end gap-2 pb-6">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="flex-1 flex gap-1 justify-center items-end h-full">
                <Skeleton className="w-[45%] rounded-md" style={{ height: `${(i * 13 + 20) % 80 + 20}%` }} />
                <Skeleton className="w-[45%] rounded-md" style={{ height: `${(i * 17 + 30) % 80 + 20}%` }} />
              </div>
            ))}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={barData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--color-muted-foreground)' }} allowDecimals={false} />
              <Tooltip
                cursor={{ fill: 'var(--accent)' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--popover)', color: 'var(--popover-foreground)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
              />
              <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }} />
              <Bar dataKey="criados" name="Criados" fill="var(--chart-2)" radius={[4, 4, 0, 0]} barSize={isTeamReports ? 24 : 32} />
              <Bar dataKey="concluidos" name="Concluídos" fill="var(--chart-1)" radius={[4, 4, 0, 0]} barSize={isTeamReports ? 24 : 32} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
