import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, ShieldCheck, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useServiceTypes } from '@/src/hooks/useServiceTypes';
import {
  getSlaPolicies, createSlaPolicy, updateSlaPolicy, deleteSlaPolicy,
} from '@/src/services/slaPolicyService';
import type { SlaPolicy, CreateSlaPolicyDTO, SlaPriority } from '@/src/types/slaPolicy';
import { SLA_PRIORITY_LABEL, SLA_PRIORITY_COLOR } from '@/src/types/slaPolicy';
import { useState as useLocalState, useEffect, useCallback } from 'react';

const PRIORITIES: SlaPriority[] = ['baixa', 'normal', 'alta', 'critica'];

const EMPTY_FORM: CreateSlaPolicyDTO = {
  service_type: null,
  priority: 'normal',
  hours_to_respond: 4,
  hours_to_resolve: 24,
  is_active: true,
};

export default function SlaManagement() {
  const [policies, setPolicies] = useLocalState<SlaPolicy[]>([]);
  const [loading, setLoading] = useLocalState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SlaPolicy | null>(null);
  const [form, setForm] = useState<CreateSlaPolicyDTO>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SlaPolicy | null>(null);
  const { types: serviceTypes } = useServiceTypes();

  const load = useCallback(async () => {
    setLoading(true);
    try { setPolicies(await getSlaPolicies()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: SlaPolicy) => {
    setEditing(p);
    setForm({
      service_type: p.service_type,
      priority: p.priority,
      hours_to_respond: p.hours_to_respond,
      hours_to_resolve: p.hours_to_resolve,
      is_active: p.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.priority) return;
    setSaving(true);
    try {
      if (editing) {
        const updated = await updateSlaPolicy(editing.id, form);
        setPolicies(ps => ps.map(p => p.id === updated.id ? updated : p));
        toast.success('Política de SLA atualizada.');
      } else {
        const created = await createSlaPolicy(form);
        setPolicies(ps => [...ps, created]);
        toast.success('Política de SLA criada.');
      }
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
      await deleteSlaPolicy(deleteTarget.id);
      setPolicies(ps => ps.filter(p => p.id !== deleteTarget.id));
      toast.success('Política removida.');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDeleteTarget(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Políticas de SLA
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure os prazos de resposta e resolução por tipo de serviço e prioridade.
          </p>
        </div>
        <Button onClick={openCreate} className="h-10 rounded-xl gap-2">
          <Plus className="h-4 w-4" /> Nova Política
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : policies.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <ShieldCheck className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">Nenhuma política configurada</p>
            <p className="text-sm text-muted-foreground">Crie políticas para ativar o SLA nas OS.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {policies.map(p => (
            <Card key={p.id} className={`shadow-sm border-border hover:shadow-md transition-shadow ${!p.is_active ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold">
                    {p.service_type ?? 'Todos os tipos'}
                  </CardTitle>
                  <Badge className={SLA_PRIORITY_COLOR[p.priority]}>
                    {SLA_PRIORITY_LABEL[p.priority]}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-3.5 w-3.5 shrink-0" />
                  <span>Resposta: <strong className="text-foreground">{p.hours_to_respond}h</strong></span>
                  <span className="text-border">·</span>
                  <span>Resolução: <strong className="text-foreground">{p.hours_to_resolve}h</strong></span>
                </div>
                <p className="text-xs text-muted-foreground">{p.is_active ? 'Ativa' : 'Inativa'}</p>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="h-8 rounded-lg flex-1" onClick={() => openEdit(p)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-rose-600 hover:text-rose-700" onClick={() => setDeleteTarget(p)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog Create/Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Política de SLA' : 'Nova Política de SLA'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Tipo de Serviço</Label>
              <Select
                value={form.service_type ?? '__all__'}
                onValueChange={v => setForm(f => ({ ...f, service_type: v === '__all__' ? null : v }))}
              >
                <SelectTrigger className="h-11 rounded-xl bg-muted border-input">
                  <SelectValue placeholder="Todos os tipos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os tipos</SelectItem>
                  {serviceTypes.map(t => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade <span className="text-rose-500">*</span></Label>
              <Select
                value={form.priority}
                onValueChange={v => setForm(f => ({ ...f, priority: v as SlaPriority }))}
              >
                <SelectTrigger className="h-11 rounded-xl bg-muted border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(pr => (
                    <SelectItem key={pr} value={pr}>{SLA_PRIORITY_LABEL[pr]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Horas p/ Resposta</Label>
                <Input
                  type="number" min={1} value={form.hours_to_respond}
                  onChange={e => setForm(f => ({ ...f, hours_to_respond: Number(e.target.value) }))}
                  className="h-11 rounded-xl bg-muted border-input"
                />
              </div>
              <div className="space-y-2">
                <Label>Horas p/ Resolução</Label>
                <Input
                  type="number" min={1} value={form.hours_to_resolve}
                  onChange={e => setForm(f => ({ ...f, hours_to_resolve: Number(e.target.value) }))}
                  className="h-11 rounded-xl bg-muted border-input"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={form.is_active}
                onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))}
              />
              <Label htmlFor="is_active">Política ativa</Label>
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
            <AlertDialogTitle>Remover política de SLA?</AlertDialogTitle>
            <AlertDialogDescription>
              A política <strong>{SLA_PRIORITY_LABEL[deleteTarget?.priority ?? 'normal']}</strong> —{' '}
              {deleteTarget?.service_type ?? 'todos os tipos'} será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-rose-600 hover:bg-rose-700 text-white">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
