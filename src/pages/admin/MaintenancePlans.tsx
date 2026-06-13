import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import {
  CalendarClock, Plus, Pencil, Trash2, Play, Power, Loader2, Wrench,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Label } from '@/src/components/ui/label';
import { Input } from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/src/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/src/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/src/components/ui/alert-dialog';
import {
  getMaintenancePlans,
  createMaintenancePlan,
  updateMaintenancePlan,
  setMaintenancePlanActive,
  deleteMaintenancePlan,
  runDueMaintenanceOrders,
} from '@/src/services/maintenancePlanService';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { useClients } from '@/src/hooks/useClients';
import { useServiceTypes } from '@/src/hooks/useServiceTypes';
import { useTechnicians } from '@/src/hooks/useTechnicians';
import type { MaintenancePlan, CreateMaintenancePlanDTO, FrequencyType } from '@/src/types/maintenancePlan';
import { FREQUENCY_LABEL, FREQUENCY_DAYS } from '@/src/types/maintenancePlan';

const PRIORITY_OPTIONS = [
  { value: 'baixa',   label: 'Baixa'   },
  { value: 'normal',  label: 'Normal'  },
  { value: 'alta',    label: 'Alta'    },
  { value: 'critica', label: 'Crítica' },
];

const FREQUENCY_OPTIONS: { value: FrequencyType; label: string }[] = [
  { value: 'diario',       label: 'Diário (1 dia)'        },
  { value: 'semanal',      label: 'Semanal (7 dias)'      },
  { value: 'quinzenal',    label: 'Quinzenal (14 dias)'   },
  { value: 'mensal',       label: 'Mensal (30 dias)'      },
  { value: 'trimestral',   label: 'Trimestral (90 dias)'  },
  { value: 'personalizado',label: 'Personalizado…'        },
];

const EMPTY_FORM: CreateMaintenancePlanDTO = {
  name: '',
  description: null,
  service_type: '',
  client_id: null,
  asset_id: null,
  asset_name_manual: null,
  site_location: null,
  priority: 'normal',
  frequency_type: 'mensal',
  frequency_days: 30,
  lead_days: 1,
  next_due_at: new Date().toISOString().split('T')[0],
  assigned_technician_id: null,
  is_active: true,
  created_by: null,
};

export default function MaintenancePlans() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const clients = useClients();
  const { types: serviceTypes } = useServiceTypes();
  const technicians = useTechnicians();

  const [plans, setPlans] = useState<MaintenancePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MaintenancePlan | null>(null);
  const [form, setForm] = useState<CreateMaintenancePlanDTO>({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MaintenancePlan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPlans(await getMaintenancePlans());
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar planos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, created_by: user?.id ?? null });
    setDialogOpen(true);
  };

  const openEdit = (plan: MaintenancePlan) => {
    setEditing(plan);
    setForm({
      name: plan.name,
      description: plan.description,
      service_type: plan.service_type,
      client_id: plan.client_id,
      asset_id: plan.asset_id,
      asset_name_manual: plan.asset_name_manual,
      site_location: plan.site_location,
      priority: plan.priority,
      frequency_type: plan.frequency_type,
      frequency_days: plan.frequency_days,
      lead_days: plan.lead_days,
      next_due_at: plan.next_due_at,
      assigned_technician_id: plan.assigned_technician_id,
      is_active: plan.is_active,
      created_by: plan.created_by,
    });
    setDialogOpen(true);
  };

  const handleFrequencyTypeChange = (ft: FrequencyType) => {
    setForm(prev => ({
      ...prev,
      frequency_type: ft,
      frequency_days: ft !== 'personalizado' ? FREQUENCY_DAYS[ft] : prev.frequency_days,
    }));
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.service_type) {
      toast.warning('Preencha o nome e o tipo de serviço.');
      return;
    }
    if (!form.assigned_technician_id && !form.created_by) {
      toast.warning('Selecione um técnico responsável.');
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await updateMaintenancePlan(editing.id, form);
        toast.success('Plano atualizado.');
      } else {
        await createMaintenancePlan(form, tenant?.id ?? '');
        toast.success('Plano criado. A primeira OS será gerada automaticamente no dia programado.');
      }
      setDialogOpen(false);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (plan: MaintenancePlan) => {
    try {
      await setMaintenancePlanActive(plan.id, !plan.is_active);
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao atualizar.');
      return;
    }
    toast.success(plan.is_active ? 'Plano pausado.' : 'Plano reativado.');
    load();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMaintenancePlan(deleteTarget.id);
      toast.success('Plano excluído.');
      load();
    } catch (e: any) {
      toast.error(e?.message ?? 'Erro ao excluir.');
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const count = await runDueMaintenanceOrders();
      toast.success(`${count} OS criada(s) com sucesso.`);
      load();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao executar.');
    } finally {
      setRunning(false);
    }
  };

  const fmtDate = (d: string) => {
    try { return format(parseISO(d), 'dd/MM/yyyy', { locale: ptBR }); } catch { return d; }
  };

  return (
    <div className="flex flex-col gap-5 w-full pb-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Manutenção Preventiva</h1>
          <p className="text-sm text-muted-foreground">
            OS criadas automaticamente conforme a frequência configurada (padrão SAP PM)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleRunNow} disabled={running} className="gap-1.5 rounded-xl h-10">
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            <span className="hidden sm:inline">Executar agora</span>
          </Button>
          <Button data-onboarding="manut-novo" onClick={openCreate} className="gap-1.5 rounded-xl h-10">
            <Plus className="h-4 w-4" /> Novo Plano
          </Button>
        </div>
      </div>

      {/* Lista de planos */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : plans.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card rounded-xl border border-dashed border-border">
          <CalendarClock className="h-10 w-10 mb-4 text-muted-foreground/60" />
          <p className="text-sm font-medium">Nenhum plano configurado.</p>
          <p className="text-xs mt-1">Crie o primeiro plano de manutenção preventiva.</p>
        </div>
      ) : (
        <div data-onboarding="manut-grid" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {plans.map(plan => (
            <Card key={plan.id} className={`shadow-sm border-border transition-opacity ${plan.is_active ? '' : 'opacity-60'}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold text-foreground leading-snug">{plan.name}</CardTitle>
                  <Badge variant={plan.is_active ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                    {plan.is_active ? 'Ativo' : 'Pausado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Wrench className="h-3.5 w-3.5 shrink-0" />
                  <span>{plan.service_type}</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                  <span>{FREQUENCY_LABEL[plan.frequency_type]} · próximo {fmtDate(plan.next_due_at)}</span>
                </div>
                {plan.clients?.name && (
                  <p className="text-xs text-muted-foreground truncate">{plan.clients.name}</p>
                )}
                {plan.users?.full_name && (
                  <p className="text-xs text-primary font-medium truncate">Técnico: {plan.users.full_name}</p>
                )}

                <div className="flex items-center gap-2 pt-2 border-t border-border">
                  <Button variant="ghost" size="sm" onClick={() => openEdit(plan)} className="h-8 gap-1 text-xs flex-1">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleActive(plan)} className="h-8 gap-1 text-xs flex-1">
                    <Power className="h-3.5 w-3.5" /> {plan.is_active ? 'Pausar' : 'Ativar'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(plan)} className="h-8 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog de Criação / Edição */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Plano' : 'Novo Plano de Manutenção'}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Nome do plano <span className="text-rose-500">*</span></Label>
              <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Manutenção preventiva compressores" className="rounded-xl" />
            </div>

            {/* Tipo de Serviço */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Tipo de serviço <span className="text-rose-500">*</span></Label>
              <Select value={form.service_type}
                onValueChange={v => setForm(p => ({ ...p, service_type: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {serviceTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Frequência */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Frequência</Label>
                <Select value={form.frequency_type}
                  onValueChange={v => handleFrequencyTypeChange(v as FrequencyType)}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {form.frequency_type === 'personalizado' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">Intervalo (dias)</Label>
                  <Input type="number" min={1} value={form.frequency_days}
                    onChange={e => setForm(p => ({ ...p, frequency_days: Number(e.target.value) }))}
                    className="rounded-xl" />
                </div>
              )}
            </div>

            {/* Próximo vencimento + Lead days */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Próximo vencimento</Label>
                <Input type="date" value={form.next_due_at}
                  onChange={e => setForm(p => ({ ...p, next_due_at: e.target.value }))}
                  className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-semibold">Criar com antecedência (dias)</Label>
                <Input type="number" min={0} max={30} value={form.lead_days}
                  onChange={e => setForm(p => ({ ...p, lead_days: Number(e.target.value) }))}
                  className="rounded-xl" />
              </div>
            </div>

            {/* Prioridade */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Prioridade</Label>
              <Select value={form.priority}
                onValueChange={v => setForm(p => ({ ...p, priority: v as MaintenancePlan['priority'] }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITY_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Técnico responsável */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Técnico responsável <span className="text-rose-500">*</span></Label>
              <Select value={form.assigned_technician_id ?? '__none__'}
                onValueChange={v => setForm(p => ({ ...p, assigned_technician_id: v === '__none__' ? null : v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione um técnico" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem atribuição —</SelectItem>
                  {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Cliente */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Cliente</Label>
              <Select value={form.client_id ?? '__none__'}
                onValueChange={v => setForm(p => ({ ...p, client_id: v === '__none__' ? null : v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Sem cliente —</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Local */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Local / Unidade</Label>
              <Input value={form.site_location ?? ''}
                onChange={e => setForm(p => ({ ...p, site_location: e.target.value || null }))}
                placeholder="Ex: Planta A — Sala de máquinas" className="rounded-xl" />
            </div>

            {/* Equipamento manual */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Equipamento</Label>
              <Input value={form.asset_name_manual ?? ''}
                onChange={e => setForm(p => ({ ...p, asset_name_manual: e.target.value || null }))}
                placeholder="Ex: Compressor Atlas Copco GA37" className="rounded-xl" />
            </div>

            {/* Descrição / checklist */}
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Descrição / procedimentos</Label>
              <Textarea value={form.description ?? ''}
                onChange={e => setForm(p => ({ ...p, description: e.target.value || null }))}
                placeholder="Descreva os procedimentos a serem seguidos…"
                className="resize-none rounded-xl min-h-[80px]" />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Salvando…</> : 'Salvar plano'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* AlertDialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir plano de manutenção?</AlertDialogTitle>
            <AlertDialogDescription>
              O plano "{deleteTarget?.name}" será removido permanentemente. OS já geradas por ele não são afetadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
