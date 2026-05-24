import { useState } from 'react';
import { Plus, Wrench, Loader2, Pencil, Trash2, Eye, AlertTriangle, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { useEquipments } from '@/src/hooks/useEquipments';
import { useClients } from '@/src/hooks/useClients';
import { createEquipment, updateEquipment, deleteEquipment } from '@/src/services/equipmentService';
import { maintenanceStatus } from '@/src/types/equipment';
import type { Equipment, CreateEquipmentDTO } from '@/src/types/equipment';
import EquipmentDetailDialog from './components/EquipmentDetailDialog';

// ── Manutenção status badge ───────────────────────────────────────────────────

const MAINT_CONFIG = {
  vencida:     { label: 'Vencida',  className: 'bg-destructive/15 text-destructive border-destructive/30 border' },
  proxima:     { label: 'Próxima',  className: 'bg-amber-100 text-amber-700 border border-amber-300 dark:bg-amber-900/20 dark:text-amber-400' },
  ok:          { label: 'Em dia',   className: 'bg-emerald-100 text-emerald-700 border border-emerald-300 dark:bg-emerald-900/20 dark:text-emerald-400' },
  'sem-dados': { label: '—',        className: 'text-muted-foreground' },
};

const STATUS_LABELS: Record<string, string> = {
  ativo: 'Ativo', inativo: 'Inativo', manutencao: 'Em Manutenção',
};

// ── Form draft ────────────────────────────────────────────────────────────────

const EMPTY_DRAFT: CreateEquipmentDTO = {
  client_id: null, name: '', type: null, serial_number: null,
  status: 'ativo', manufacturer: null, model: null,
  installation_date: null, warranty_until: null,
  maintenance_interval_days: null, last_maintenance_at: null,
  acquisition_cost: null, acquisition_date: null,
  useful_life_years: null, residual_value: 0,
};

function nullify(v: string): string | null { return v.trim() || null; }
function nullifyNum(v: string): number | null { const n = parseInt(v); return isNaN(n) ? null : n; }
function nullifyFloat(v: string): number | null { const n = parseFloat(v.replace(',', '.')); return isNaN(n) ? null : n; }

// ── Main component ────────────────────────────────────────────────────────────

export default function EquipmentManagement() {
  const { equipments, loading, reload } = useEquipments();
  const clients = useClients();

  const [formOpen, setFormOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<Equipment | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState<CreateEquipmentDTO>(EMPTY_DRAFT);

  const overdueCount = equipments.filter(e => maintenanceStatus(e) === 'vencida').length;

  const openCreate = () => {
    setSelected(null);
    setDraft(EMPTY_DRAFT);
    setFormOpen(true);
  };

  const openEdit = (eq: Equipment) => {
    setSelected(eq);
    setDraft({
      client_id: eq.client_id,
      name: eq.name,
      type: eq.type,
      serial_number: eq.serial_number,
      status: eq.status,
      manufacturer: eq.manufacturer,
      model: eq.model,
      installation_date: eq.installation_date,
      warranty_until: eq.warranty_until,
      maintenance_interval_days: eq.maintenance_interval_days,
      last_maintenance_at: eq.last_maintenance_at,
      acquisition_cost: eq.acquisition_cost,
      acquisition_date: eq.acquisition_date,
      useful_life_years: eq.useful_life_years,
      residual_value: eq.residual_value ?? 0,
    });
    setFormOpen(true);
  };

  const openDetail = (eq: Equipment) => {
    setSelected(eq);
    setDetailOpen(true);
  };

  const openDelete = (eq: Equipment) => {
    setSelected(eq);
    setDeleteOpen(true);
  };

  const set = (field: keyof CreateEquipmentDTO, value: unknown) =>
    setDraft(prev => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!draft.name.trim()) { toast.warning('O nome do equipamento é obrigatório.'); return; }
    setSaving(true);
    try {
      const payload: CreateEquipmentDTO = {
        ...draft,
        name: draft.name.trim(),
        type: nullify(draft.type ?? ''),
        serial_number: nullify(draft.serial_number ?? ''),
        manufacturer: nullify(draft.manufacturer ?? ''),
        model: nullify(draft.model ?? ''),
      };
      if (selected) {
        await updateEquipment(selected.id, payload);
        toast.success('Equipamento atualizado.');
      } else {
        await createEquipment(payload);
        toast.success('Equipamento cadastrado.');
      }
      setFormOpen(false);
      reload();
    } catch {
      toast.error('Erro ao salvar equipamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setDeleting(true);
    try {
      await deleteEquipment(selected.id);
      toast.success('Equipamento removido.');
      setDeleteOpen(false);
      reload();
    } catch {
      toast.error('Erro ao remover equipamento. Verifique se há OS vinculadas.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-6 animate-in fade-in duration-300">

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wrench className="h-6 w-6 text-primary" />
            Equipamentos
          </h1>
          <p className="text-sm text-muted-foreground">
            Gerencie os ativos e acompanhe manutenções preventivas.
            {overdueCount > 0 && (
              <span className="ml-2 font-semibold text-destructive">
                {overdueCount} preventiva{overdueCount > 1 ? 's' : ''} vencida{overdueCount > 1 ? 's' : ''}.
              </span>
            )}
          </p>
        </div>
        <Button onClick={openCreate} data-onboarding="eq-novo" className="h-11 px-6 rounded-xl font-semibold gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Novo Equipamento
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : equipments.length === 0 ? (
          <div className="flex flex-col items-center py-20 gap-3 text-muted-foreground">
            <Wrench className="h-10 w-10 opacity-30" />
            <p className="text-sm font-medium">Nenhum equipamento cadastrado.</p>
            <p className="text-xs">Cadastre o primeiro equipamento clicando em "Novo Equipamento".</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="hidden sm:table-cell">Cliente</TableHead>
                <TableHead className="hidden md:table-cell">Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Preventiva</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {equipments.map(eq => {
                const ms = maintenanceStatus(eq);
                const msConfig = MAINT_CONFIG[ms];
                return (
                  <TableRow key={eq.id} className="hover:bg-muted/50 transition-colors">
                    <TableCell className="font-medium">{eq.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {eq.clients?.name ?? '—'}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {eq.type ?? '—'}
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        eq.status === 'ativo' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' :
                        eq.status === 'manutencao' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {STATUS_LABELS[eq.status] ?? eq.status}
                      </span>
                    </TableCell>
                    <TableCell data-onboarding={eq === equipments[0] ? 'eq-preventiva-col' : undefined}>
                      {ms !== 'sem-dados' && (
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${msConfig.className}`}>
                          {msConfig.label}
                        </span>
                      )}
                      {ms === 'sem-dados' && <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDetail(eq)} data-onboarding={eq === equipments[0] ? 'eq-detalhe-btn' : undefined}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(eq)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-primary/70 hover:text-primary" title="Gerar Etiqueta QR"
                          onClick={async () => {
                            try {
                              const { exportarEtiquetaQR } = await import('@/src/utils/gerarEtiquetaQR');
                              await exportarEtiquetaQR(eq);
                            } catch (e) { toast.error('Erro ao gerar QR: ' + (e instanceof Error ? e.message : String(e))); }
                          }}>
                          <QrCode className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => openDelete(eq)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* ── Form Dialog (criar / editar) ───────────────────────────────────── */}
      <Dialog open={formOpen} onOpenChange={v => !v && setFormOpen(false)}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selected ? 'Editar Equipamento' : 'Novo Equipamento'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">

            <div className="space-y-1.5">
              <Label>Nome *</Label>
              <Input value={draft.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Compressor Atlas Copco" className="h-11 rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Input value={draft.type ?? ''} onChange={e => set('type', e.target.value)} placeholder="Ex: Compressor" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Nº de Série</Label>
                <Input value={draft.serial_number ?? ''} onChange={e => set('serial_number', e.target.value)} placeholder="SN..." className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Fabricante</Label>
                <Input value={draft.manufacturer ?? ''} onChange={e => set('manufacturer', e.target.value)} placeholder="Ex: Atlas Copco" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Input value={draft.model ?? ''} onChange={e => set('model', e.target.value)} placeholder="Ex: GA 55" className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select
                value={draft.client_id ?? ''}
                onValueChange={v => set('client_id', v || null)}
              >
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sem cliente</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={v => set('status', v as CreateEquipmentDTO['status'])}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="manutencao">Em Manutenção</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Data de Instalação</Label>
                <Input type="date" value={draft.installation_date ?? ''} onChange={e => set('installation_date', e.target.value || null)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <Label>Garantia até</Label>
                <Input type="date" value={draft.warranty_until ?? ''} onChange={e => set('warranty_until', e.target.value || null)} className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Intervalo de preventiva (dias)</Label>
                <Input
                  type="number" min={1}
                  value={draft.maintenance_interval_days ?? ''}
                  onChange={e => set('maintenance_interval_days', nullifyNum(e.target.value))}
                  placeholder="Ex: 90"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Última manutenção</Label>
                <Input type="date" value={draft.last_maintenance_at ?? ''} onChange={e => set('last_maintenance_at', e.target.value || null)} className="h-11 rounded-xl" />
              </div>
            </div>

            {/* Ciclo de Vida Financeiro */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Ciclo de Vida Financeiro</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Custo de Aquisição (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={draft.acquisition_cost ?? ''}
                    onChange={e => set('acquisition_cost', nullifyFloat(e.target.value))}
                    placeholder="Ex: 15000,00"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Data de Aquisição</Label>
                  <Input type="date" value={draft.acquisition_date ?? ''} onChange={e => set('acquisition_date', e.target.value || null)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-1.5">
                  <Label>Vida Útil (anos)</Label>
                  <Input
                    type="number" min={1}
                    value={draft.useful_life_years ?? ''}
                    onChange={e => set('useful_life_years', nullifyNum(e.target.value))}
                    placeholder="Ex: 10"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Valor Residual (R$)</Label>
                  <Input
                    type="number" min={0} step="0.01"
                    value={draft.residual_value ?? 0}
                    onChange={e => set('residual_value', nullifyFloat(e.target.value) ?? 0)}
                    placeholder="Ex: 1000,00"
                    className="h-11 rounded-xl"
                  />
                </div>
              </div>
            </div>

          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="min-w-[100px]">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : selected ? 'Salvar' : 'Cadastrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={v => !v && setDeleteOpen(false)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Remover Equipamento
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Tem certeza que deseja remover <strong>{selected?.name}</strong>?
            Esta ação não pode ser desfeita. OS já vinculadas não serão afetadas.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting} className="min-w-[100px]">
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Remover'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Detail Dialog ──────────────────────────────────────────────────── */}
      <EquipmentDetailDialog
        equipment={selected}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
      />

    </div>
  );
}
