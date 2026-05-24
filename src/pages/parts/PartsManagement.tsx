import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Package, AlertTriangle, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
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
import { useSuppliers } from '@/src/hooks/useSuppliers';
import { getParts, createPart, updatePart, deletePart } from '@/src/services/partService';
import type { Part, CreatePartDTO } from '@/src/types/part';
import { isLowStock } from '@/src/types/part';

const UNITS = ['un', 'par', 'kg', 'g', 'm', 'cm', 'L', 'ml', 'cx', 'pct', 'rolo', 'jogo'];

const EMPTY_FORM: CreatePartDTO = {
  code: null,
  name: '',
  unit: 'un',
  unit_cost: 0,
  stock_qty: 0,
  min_stock_qty: 0,
  supplier_id: null,
  location: null,
};

export default function PartsManagement() {
  const [parts, setParts] = useState<Part[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Part | null>(null);
  const [form, setForm] = useState<CreatePartDTO>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Part | null>(null);
  const [search, setSearch] = useState('');
  const { suppliers } = useSuppliers();

  const load = useCallback(async () => {
    setLoading(true);
    try { setParts(await getParts()); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const lowStockCount = parts.filter(isLowStock).length;

  const filtered = parts.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.code ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.location ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (p: Part) => {
    setEditing(p);
    setForm({
      code: p.code,
      name: p.name,
      unit: p.unit,
      unit_cost: p.unit_cost,
      stock_qty: p.stock_qty,
      min_stock_qty: p.min_stock_qty,
      supplier_id: p.supplier_id,
      location: p.location,
    });
    setDialogOpen(true);
  };

  const set = useCallback(<K extends keyof CreatePartDTO>(key: K, value: CreatePartDTO[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome obrigatório.'); return; }
    setSaving(true);
    try {
      const dto = { ...form, name: form.name.trim(), code: form.code?.trim() || null };
      if (editing) {
        const updated = await updatePart(editing.id, dto);
        setParts(ps => ps.map(p => p.id === updated.id ? updated : p));
        toast.success('Peça atualizada.');
      } else {
        const created = await createPart(dto);
        setParts(ps => [...ps, created]);
        toast.success('Peça criada.');
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
      await deletePart(deleteTarget.id);
      setParts(ps => ps.filter(p => p.id !== deleteTarget.id));
      toast.success('Peça removida.');
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
            <Package className="h-6 w-6 text-primary" /> Inventário de Peças
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie o estoque de peças e materiais utilizados nas OS.
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {lowStockCount > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-0 h-10 px-3 gap-1.5 text-sm">
              <AlertTriangle className="h-4 w-4" /> {lowStockCount} abaixo do mínimo
            </Badge>
          )}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar peça..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-10 pl-9 w-48 rounded-xl bg-muted border-border"
            />
          </div>
          <Button onClick={openCreate} className="h-10 rounded-xl gap-2">
            <Plus className="h-4 w-4" /> Nova Peça
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Package className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">
              {search ? 'Nenhuma peça encontrada' : 'Nenhuma peça cadastrada'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(p => {
            const low = isLowStock(p);
            return (
              <Card key={p.id} className={`shadow-sm border-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${low ? 'border-amber-300 dark:border-amber-700' : ''}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-sm font-semibold leading-tight">{p.name}</CardTitle>
                      {p.code && <p className="text-xs text-muted-foreground font-mono mt-0.5">{p.code}</p>}
                    </div>
                    {low && (
                      <Badge className="bg-amber-100 text-amber-700 border-0 gap-1 shrink-0">
                        <AlertTriangle className="h-3 w-3" /> Estoque baixo
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-1 text-sm">
                  <div className="flex gap-4">
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Estoque</p>
                      <p className={`font-bold ${low ? 'text-amber-600' : 'text-foreground'}`}>
                        {p.stock_qty} {p.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Mínimo</p>
                      <p className="font-medium text-muted-foreground">{p.min_stock_qty} {p.unit}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Custo unit.</p>
                      <p className="font-medium text-foreground">
                        R$ {Number(p.unit_cost).toFixed(2)}
                      </p>
                    </div>
                  </div>
                  {p.suppliers?.name && (
                    <p className="text-xs text-muted-foreground">Fornecedor: {p.suppliers.name}</p>
                  )}
                  {p.location && (
                    <p className="text-xs text-muted-foreground">Local: {p.location}</p>
                  )}
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
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Peça' : 'Nova Peça'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Nome <span className="text-rose-500">*</span></Label>
                <Input value={form.name} onChange={e => set('name', e.target.value)} className="h-11 rounded-xl bg-muted" placeholder="Ex: Rolamento 6205" />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Input value={form.code ?? ''} onChange={e => set('code', e.target.value || null)} className="h-11 rounded-xl bg-muted" placeholder="SKU" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Unidade</Label>
                <Select value={form.unit} onValueChange={v => set('unit', v)}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Custo unit. (R$)</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={form.unit_cost}
                  onChange={e => set('unit_cost', Number(e.target.value))}
                  className="h-11 rounded-xl bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Estoque atual</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={form.stock_qty}
                  onChange={e => set('stock_qty', Number(e.target.value))}
                  className="h-11 rounded-xl bg-muted"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Estoque mínimo</Label>
                <Input
                  type="number" min={0} step={0.01}
                  value={form.min_stock_qty}
                  onChange={e => set('min_stock_qty', Number(e.target.value))}
                  className="h-11 rounded-xl bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Localização</Label>
                <Input value={form.location ?? ''} onChange={e => set('location', e.target.value || null)} className="h-11 rounded-xl bg-muted" placeholder="Ex: Prateleira A3" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Fornecedor preferencial</Label>
              <Select
                value={form.supplier_id ?? '__none__'}
                onValueChange={v => set('supplier_id', v === '__none__' ? null : v)}
              >
                <SelectTrigger className="h-11 rounded-xl bg-muted"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhum</SelectItem>
                  {suppliers.filter(s => s.status === 'ativo').map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover peça?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> será removida do inventário.
              O histórico de uso nas OS não será afetado.
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
