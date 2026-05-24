import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, FileText, Trash2, Send, CheckCircle, DollarSign, XCircle, ChevronRight, Pencil } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getExpenseReports, createExpenseReport, updateExpenseReport,
  deleteExpenseReport, submitExpenseReport, reviewExpenseReport,
} from '@/src/services/expenseReportService';
import type { ExpenseReport, ExpenseReportStatus } from '@/src/types/expenseReport';
import { EXPENSE_STATUS_LABEL, EXPENSE_STATUS_COLOR } from '@/src/types/expenseReport';

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('pt-BR');
}

function fmtCurrency(n: number | null | undefined): string {
  if (n == null) return '—';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n);
}

function getTotal(report: ExpenseReport): number {
  return (report.reimbursements ?? []).reduce((s, r) => s + (Number(r.amount) || 0), 0);
}

export default function ExpenseReports() {
  const { user } = useAuth();
  const isManager = ['Gestor', 'Admin', 'Financeiro', 'Master', 'Supervisor'].includes(user?.role ?? '');

  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseReport | null>(null);
  const [form, setForm] = useState({ title: '', period_start: '', period_end: '' });
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ExpenseReport | null>(null);
  const [rejectTarget, setRejectTarget] = useState<ExpenseReport | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [actioning, setActioning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { setReports(await getExpenseReports()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ title: '', period_start: '', period_end: '' });
    setDialogOpen(true);
  };

  const openEdit = (r: ExpenseReport) => {
    setEditing(r);
    setForm({ title: r.title, period_start: r.period_start ?? '', period_end: r.period_end ?? '' });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title.trim()) { toast.error('Título obrigatório.'); return; }
    setSaving(true);
    try {
      const dto = { title: form.title.trim(), period_start: form.period_start || null, period_end: form.period_end || null };
      if (editing) {
        await updateExpenseReport(editing.id, dto);
        toast.success('Relatório atualizado.');
      } else {
        await createExpenseReport(dto);
        toast.success('Relatório criado.');
      }
      await load();
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpenseReport(deleteTarget.id);
      setReports(rs => rs.filter(r => r.id !== deleteTarget.id));
      toast.success('Relatório removido.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleAction = async (report: ExpenseReport, action: 'submit' | 'aprovar' | 'rejeitar' | 'pagar', reason?: string) => {
    setActioning(report.id + action);
    try {
      if (action === 'submit') {
        await submitExpenseReport(report.id);
        toast.success('Relatório submetido para aprovação.');
      } else {
        await reviewExpenseReport(report.id, action as any, reason);
        toast.success(
          action === 'aprovar' ? 'Relatório aprovado.' :
          action === 'pagar'   ? 'Pagamento registrado.' :
          'Relatório rejeitado.'
        );
      }
      await load();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActioning(null);
      setRejectTarget(null);
      setRejectReason('');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <FileText className="h-6 w-6 text-primary" /> Relatórios de Despesas
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Agrupe reembolsos por viagem ou período para aprovação em lote.
          </p>
        </div>
        <Button onClick={openCreate} className="h-10 rounded-xl gap-2">
          <Plus className="h-4 w-4" /> Novo Relatório
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : reports.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">Nenhum relatório de despesas</p>
            <p className="text-sm text-muted-foreground">Crie um relatório para agrupar reembolsos por viagem.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const total = getTotal(r);
            const count = r.reimbursements?.length ?? 0;
            const isOwn = r.user_id === user?.id;
            const busy = actioning?.startsWith(r.id);

            return (
              <Card key={r.id} className="shadow-sm border-border hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{r.title}</span>
                        <Badge className={EXPENSE_STATUS_COLOR[r.status]}>
                          {EXPENSE_STATUS_LABEL[r.status]}
                        </Badge>
                      </div>
                      {isManager && r.users?.full_name && (
                        <p className="text-xs text-muted-foreground">{r.users.full_name}</p>
                      )}
                      {(r.period_start || r.period_end) && (
                        <p className="text-xs text-muted-foreground">
                          {fmtDate(r.period_start)} — {fmtDate(r.period_end)}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {count} reembolso{count !== 1 ? 's' : ''} · Total: <strong className="text-foreground">{fmtCurrency(total)}</strong>
                      </p>
                      {r.rejection_reason && (
                        <p className="text-xs text-rose-600 italic">Motivo: {r.rejection_reason}</p>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap shrink-0">
                      {/* Owner actions */}
                      {isOwn && r.status === 'rascunho' && (
                        <>
                          <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1" onClick={() => openEdit(r)}>
                            <Pencil className="h-3.5 w-3.5" /> Editar
                          </Button>
                          <Button size="sm" className="h-8 rounded-lg gap-1" onClick={() => handleAction(r, 'submit')} disabled={!!busy}>
                            <Send className="h-3.5 w-3.5" /> Submeter
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-lg text-rose-600" onClick={() => setDeleteTarget(r)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}

                      {/* Manager actions */}
                      {isManager && r.status === 'submetido' && (
                        <>
                          <Button size="sm" className="h-8 rounded-lg gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => handleAction(r, 'aprovar')} disabled={!!busy}>
                            <CheckCircle className="h-3.5 w-3.5" /> Aprovar
                          </Button>
                          <Button size="sm" variant="outline" className="h-8 rounded-lg gap-1 text-rose-600" onClick={() => { setRejectTarget(r); setRejectReason(''); }}>
                            <XCircle className="h-3.5 w-3.5" /> Rejeitar
                          </Button>
                        </>
                      )}
                      {isManager && r.status === 'aprovado' && (
                        <Button size="sm" className="h-8 rounded-lg gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleAction(r, 'pagar')} disabled={!!busy}>
                          <DollarSign className="h-3.5 w-3.5" /> Marcar como Pago
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Reimbursements preview */}
                  {count > 0 && (
                    <div className="mt-3 pt-3 border-t border-border space-y-1">
                      {(r.reimbursements ?? []).slice(0, 3).map(rem => (
                        <div key={rem.id} className="flex items-center justify-between text-xs text-muted-foreground">
                          <span className="truncate">{rem.description}</span>
                          <span className="shrink-0 ml-2 font-medium text-foreground">{fmtCurrency(rem.amount)}</span>
                        </div>
                      ))}
                      {count > 3 && (
                        <p className="text-xs text-muted-foreground flex items-center gap-0.5">
                          +{count - 3} mais <ChevronRight className="h-3 w-3" />
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Relatório' : 'Novo Relatório de Despesas'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Título <span className="text-rose-500">*</span></Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Ex: Viagem São Paulo — Mar/2026"
                className="h-11 rounded-xl bg-muted"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Período início</Label>
                <Input
                  type="date"
                  value={form.period_start}
                  onChange={e => setForm(f => ({ ...f, period_start: e.target.value }))}
                  className="h-11 rounded-xl bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Período fim</Label>
                <Input
                  type="date"
                  value={form.period_end}
                  onChange={e => setForm(f => ({ ...f, period_end: e.target.value }))}
                  className="h-11 rounded-xl bg-muted"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="rounded-xl">Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="rounded-xl">
              {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover relatório?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.title}</strong> será removido. Os reembolsos vinculados não serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white">Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={open => { if (!open) { setRejectTarget(null); setRejectReason(''); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejeitar relatório</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da rejeição de <strong>{rejectTarget?.title}</strong>.
            </p>
            <Textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo..."
              className="rounded-xl bg-muted resize-none min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="rounded-xl">Cancelar</Button>
            <Button
              onClick={() => rejectTarget && handleAction(rejectTarget, 'rejeitar', rejectReason)}
              className="rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
            >
              Confirmar Rejeição
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
