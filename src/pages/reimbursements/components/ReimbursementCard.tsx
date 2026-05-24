import React from 'react';
import { Receipt, Pencil, Timer } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { getAgingInfo, AGING_CLASSES } from '@/src/lib/aging';

interface ReimbursementCardProps {
  item: any;
  user: any;
  getStatusBadge: (status: string) => React.ReactNode;
  onOpenDetails: (item: any) => void;
  isManager: boolean;
}

export default function ReimbursementCard({
  item,
  user,
  getStatusBadge,
  onOpenDetails,
  isManager
}: ReimbursementCardProps) {
  const aging = (item.status === 'Pendente' || item.status === 'Revisao')
    ? getAgingInfo(item.created_at, 3, 7)
    : null;

  return (
    <Card
      className="shadow-sm border-border mb-3 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]"
      onClick={() => onOpenDetails(item)}
    >
      <CardContent className="p-4 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground">
            {new Date(item.created_at).toLocaleDateString()}
          </span>
          <div className="flex items-center gap-2">
            {aging && (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${AGING_CLASSES[aging.level]}`}>
                <Timer className="h-3 w-3" /> {aging.label}
              </span>
            )}
            {getStatusBadge(item.status)}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 bg-muted rounded-full flex items-center justify-center shrink-0">
            <Receipt className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-foreground leading-tight truncate">{item.category}</h3>
            {isManager && <p className="text-sm text-muted-foreground leading-tight mt-0.5 truncate">{item.users?.full_name}</p>}
          </div>
          <div className="flex flex-col items-end shrink-0">
            <p className="text-lg font-extrabold text-foreground">
              R$ {Number(item.amount).toFixed(2).replace('.', ',')}
            </p>
            {(item.status === 'Pendente' || item.status === 'Revisao') && item.user_id === user?.id && (
              <Link
                to={`/reimbursements/${item.id}/edit`}
                className="inline-flex items-center justify-center whitespace-nowrap rounded-[min(var(--radius-md),12px)] transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 h-7 text-amber-600 dark:text-amber-400 font-semibold hover:bg-amber-50 dark:hover:bg-amber-900/30 hover:text-amber-700 dark:hover:text-amber-300 px-2 -mr-2"
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil className="h-3.5 w-3.5 mr-1" /> Editar
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
