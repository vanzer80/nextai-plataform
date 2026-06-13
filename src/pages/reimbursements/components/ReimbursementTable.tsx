import React from 'react';
import { CheckCircle, RotateCcw, XCircle, Pencil, Paperclip, Eye, MoreHorizontal, Banknote } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '@/src/components/ui/table';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from '@/src/components/ui/dropdown-menu';

interface ReimbursementTableProps {
  data: any[];
  isManager: boolean;
  user: any;
  getStatusBadge: (status: string) => React.ReactNode;
  onAction: (id: string, action: 'Aprovado' | 'Rejeitado' | 'Revisao' | 'Pago') => void;
  canPay: boolean;
  onOpenDetails: (item: any) => void;
  onOpenReject: (item: any) => void;
  onOpenReturn: (item: any) => void;
  selectedIds: string[];
  onSelectAll: (checked: boolean) => void;
  onSelectOne: (id: string, checked: boolean) => void;
}

export default function ReimbursementTable({
  data,
  isManager,
  user,
  getStatusBadge,
  onAction,
  onOpenDetails,
  onOpenReject,
  onOpenReturn,
  selectedIds,
  onSelectAll,
  onSelectOne,
  canPay
}: ReimbursementTableProps) {
  const navigate = useNavigate();
  const allSelected = data.length > 0 && data.every(item => selectedIds.includes(item.id));
  const someSelected = selectedIds.length > 0 && !allSelected;
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-4 overflow-x-auto">
      <Table className="min-w-[720px]">
        <TableHeader className="bg-muted/40">
          <TableRow className="hover:bg-transparent border-border">
            {isManager && (
              <TableHead className="w-[50px]">
                <input
                  type="checkbox"
                  className="rounded border-input w-4 h-4"
                  checked={allSelected}
                  onChange={(e) => onSelectAll(e.target.checked)}
                />
              </TableHead>
            )}
            <TableHead className="font-semibold text-foreground w-[120px]">Data</TableHead>
            {isManager && <TableHead className="font-semibold text-slate-700 w-[160px]">Colaborador</TableHead>}
            <TableHead className="font-semibold text-foreground w-[130px]">Categoria</TableHead>
            <TableHead className="font-semibold text-foreground">Descrição</TableHead>
            <TableHead className="font-semibold text-foreground font-numeric text-right w-[100px]">Valor</TableHead>
            <TableHead className="font-semibold text-foreground text-center w-[60px]">Anexo</TableHead>
            <TableHead className="font-semibold text-foreground text-center w-[120px]">Status</TableHead>
            <TableHead className="font-semibold text-foreground text-center w-[70px]">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => {
            const canModerate = isManager && (item.status === 'Pendente' || item.status === 'Revisao');
            const canMarkPaid = canPay && item.status === 'Aprovado';
            const canEdit = (item.status === 'Pendente' || item.status === 'Revisao') && item.user_id === user?.id;
            return (
            <TableRow key={item.id} className={`hover:bg-muted/30 border-border transition-colors ${selectedIds.includes(item.id) ? 'bg-primary/5' : ''}`}>
              {isManager && (
                <TableCell>
                  <input
                    type="checkbox"
                    className="rounded border-input w-4 h-4"
                    checked={selectedIds.includes(item.id)}
                    onChange={(e) => onSelectOne(item.id, e.target.checked)}
                    onClick={(e) => e.stopPropagation()}
                  />
                </TableCell>
              )}
              <TableCell className="font-medium text-muted-foreground text-sm">
                {new Date(item.created_at).toLocaleDateString()}
              </TableCell>

              {isManager && (
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6">
                      <AvatarFallback className="text-[10px] bg-muted text-foreground font-bold">
                        {item.users?.full_name?.slice(0, 2).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-foreground font-medium truncate max-w-[120px]">
                      {item.users?.full_name || 'Desconhecido'}
                    </span>
                  </div>
                </TableCell>
              )}

              <TableCell>
                <span className="text-sm font-semibold text-foreground">{item.category}</span>
              </TableCell>

              <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                {item.description}
              </TableCell>

              <TableCell className="text-right font-bold text-foreground whitespace-nowrap">
                R$ {Number(item.amount).toFixed(2).replace('.', ',')}
              </TableCell>

              <TableCell className="text-center">
                {item.receipt_url ? (
                  <a
                    href={item.receipt_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center justify-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-800 hover:bg-blue-50 py-1 px-3 rounded-full transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Paperclip className="h-4 w-4" />
                  </a>
                ) : (
                  <span className="text-slate-300">-</span>
                )}
              </TableCell>

              <TableCell className="text-center">
                {getStatusBadge(item.status)}
              </TableCell>

              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                <DropdownMenu>
                  <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44 rounded-xl">
                    <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => onOpenDetails(item)}>
                      <Eye className="h-4 w-4" /> Detalhes
                    </DropdownMenuItem>

                    {canEdit && (
                      <DropdownMenuItem
                        className="cursor-pointer gap-2 text-amber-600"
                        onClick={() => navigate(`/reimbursements/${item.id}/edit`)}
                      >
                        <Pencil className="h-4 w-4" /> Editar
                      </DropdownMenuItem>
                    )}

                    {canModerate && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-emerald-600"
                          onClick={() => onAction(item.id, 'Aprovado')}
                        >
                          <CheckCircle className="h-4 w-4" /> Aprovar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-orange-600"
                          onClick={() => onOpenReturn(item)}
                        >
                          <RotateCcw className="h-4 w-4" /> Ajuste
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-rose-600"
                          onClick={() => onOpenReject(item)}
                        >
                          <XCircle className="h-4 w-4" /> Reprovar
                        </DropdownMenuItem>
                      </>
                    )}

                    {canMarkPaid && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer gap-2 text-violet-600"
                          onClick={() => onAction(item.id, 'Pago')}
                        >
                          <Banknote className="h-4 w-4" /> Marcar como Pago
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
            );
          })}
          {data.length === 0 && (
            <TableRow>
               <TableCell colSpan={isManager ? 9 : 7} className="text-center p-8 text-slate-500">
                 Nenhum reembolso encontrado.
               </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
