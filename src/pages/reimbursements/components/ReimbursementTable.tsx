import React from 'react';
import { CheckCircle, RotateCcw, XCircle, Pencil, Paperclip, User as UserIcon } from 'lucide-react';
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Link } from 'react-router-dom';

interface ReimbursementTableProps {
  data: any[];
  isManager: boolean;
  user: any;
  getStatusBadge: (status: string) => React.ReactNode;
  onAction: (id: string, action: 'Aprovado' | 'Rejeitado' | 'Revisao') => void;
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
  onSelectOne
}: ReimbursementTableProps) {
  const allSelected = data.length > 0 && data.every(item => selectedIds.includes(item.id));
  const someSelected = selectedIds.length > 0 && !allSelected;
  return (
    <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden mt-4 overflow-x-auto">
      <Table className="min-w-[850px]">
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
            {isManager && <TableHead className="font-semibold text-slate-700">Colaborador</TableHead>}
            <TableHead className="font-semibold text-foreground">Categoria</TableHead>
            <TableHead className="font-semibold text-foreground">Descrição</TableHead>
            <TableHead className="font-semibold text-foreground font-numeric text-right">Valor</TableHead>
            <TableHead className="font-semibold text-foreground text-center">Anexo</TableHead>
            <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
            <TableHead className="font-semibold text-foreground text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item) => (
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

              <TableCell className="text-right">
                <div className="flex items-center justify-end gap-2">
                  {isManager && (item.status === 'Pendente' || item.status === 'Revisao') && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); onAction(item.id, 'Aprovado'); }}
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 h-8 px-2"
                      >
                        <CheckCircle className="h-4 w-4 xl:mr-1" />
                        <span className="hidden xl:inline">Aprovar</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReturn(item);
                        }}
                        className="text-orange-600 border-orange-200 hover:bg-orange-50 h-8 px-2"
                      >
                        <RotateCcw className="h-4 w-4 xl:mr-1" />
                        <span className="hidden xl:inline">Ajuste</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenReject(item);
                        }}
                        className="text-rose-600 border-rose-200 hover:bg-rose-50 h-8 px-2"
                      >
                        <XCircle className="h-4 w-4 xl:mr-1" />
                        <span className="hidden xl:inline">Reprovar</span>
                      </Button>
                    </>
                  )}
                  {(item.status === 'Pendente' || item.status === 'Revisao') && item.user_id === user?.id && (
                    <Link
                      to={`/reimbursements/${item.id}/edit`}
                      className="inline-flex items-center justify-center whitespace-nowrap rounded-[min(var(--radius-md),12px)] transition-colors text-amber-600 font-semibold hover:bg-amber-50 py-1 h-8 px-2"
                    >
                      <Pencil className="h-4 w-4 xl:mr-1" />
                      <span className="hidden xl:inline">Editar</span>
                    </Link>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onOpenDetails(item)} className="text-blue-600 font-semibold hover:bg-blue-50 h-8 px-2">
                    Detalhes
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {data.length === 0 && (
            <TableRow>
               <TableCell colSpan={isManager ? 8 : 7} className="text-center p-8 text-slate-500">
                 Nenhum reembolso encontrado.
               </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
