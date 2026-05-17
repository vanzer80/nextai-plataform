import { useState, useEffect } from 'react';
import { Plus, ChevronUp, ChevronDown, Loader2, Settings2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { supabase } from '@/src/lib/supabase';
import { invalidateServiceTypesCache, type ServiceTypeRow } from '@/src/hooks/useServiceTypes';

export default function ServiceTypes() {
  const [types, setTypes] = useState<ServiceTypeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ value: '', label: '' });

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from('service_types')
      .select('id, value, label, sort_order, is_active')
      .order('sort_order');
    if (error) { toast.error('Erro ao carregar tipos.'); }
    else { setTypes((data ?? []) as ServiceTypeRow[]); }
    setLoading(false);
  }

  async function handleToggle(row: ServiceTypeRow) {
    const { error } = await supabase
      .from('service_types')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    if (error) { toast.error('Erro ao atualizar.'); return; }
    setTypes(prev => prev.map(t => t.id === row.id ? { ...t, is_active: !t.is_active } : t));
    invalidateServiceTypesCache();
  }

  async function handleMove(row: ServiceTypeRow, dir: -1 | 1) {
    const idx = types.findIndex(t => t.id === row.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= types.length) return;

    const a = types[idx];
    const b = types[swapIdx];
    const newOrder = [...types];
    newOrder[idx] = { ...a, sort_order: b.sort_order };
    newOrder[swapIdx] = { ...b, sort_order: a.sort_order };
    newOrder.sort((x, y) => x.sort_order - y.sort_order);
    setTypes(newOrder);

    await Promise.all([
      supabase.from('service_types').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('service_types').update({ sort_order: a.sort_order }).eq('id', b.id),
    ]);
    invalidateServiceTypesCache();
  }

  async function handleAdd() {
    const value = draft.value.trim();
    const label = draft.label.trim() || value;
    if (!value) { toast.warning('Informe o valor do tipo.'); return; }

    setSaving(true);
    const maxOrder = types.reduce((m, t) => Math.max(m, t.sort_order), 0);
    const { data, error } = await supabase
      .from('service_types')
      .insert({ value, label, sort_order: maxOrder + 1 })
      .select('id, value, label, sort_order, is_active')
      .single();
    setSaving(false);

    if (error) {
      if (error.code === '23505') toast.error('Já existe um tipo com esse valor.');
      else toast.error('Erro ao criar tipo.');
      return;
    }
    setTypes(prev => [...prev, data as ServiceTypeRow]);
    invalidateServiceTypesCache();
    setDraft({ value: '', label: '' });
    setDialogOpen(false);
    toast.success('Tipo de serviço criado!');
  }

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto pb-10">

      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            Tipos de Serviço
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure os tipos de serviço disponíveis para este tenant
          </p>
        </div>
        <Button
          onClick={() => { setDraft({ value: '', label: '' }); setDialogOpen(true); }}
          className="h-10 rounded-xl bg-primary hover:bg-primary/90 gap-2 font-semibold shrink-0"
        >
          <Plus className="h-4 w-4" /> Novo
        </Button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : (
        <div className="space-y-2">
          {types.map((row, idx) => (
            <Card
              key={row.id}
              className={`shadow-sm border-border transition-opacity ${row.is_active ? '' : 'opacity-50'}`}
            >
              <CardContent className="flex items-center gap-3 py-3 px-4">
                {/* Reorder */}
                <div className="flex flex-col gap-0.5 shrink-0">
                  <button
                    onClick={() => handleMove(row, -1)}
                    disabled={idx === 0}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMove(row, 1)}
                    disabled={idx === types.length - 1}
                    className="text-muted-foreground hover:text-foreground disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{row.label}</p>
                  {row.value !== row.label && (
                    <p className="text-[11px] text-muted-foreground font-mono">{row.value}</p>
                  )}
                </div>

                {/* Toggle */}
                <Switch
                  checked={row.is_active}
                  onCheckedChange={() => handleToggle(row)}
                />
              </CardContent>
            </Card>
          ))}
          {types.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-10">
              Nenhum tipo de serviço cadastrado.
            </p>
          )}
        </div>
      )}

      {/* Add dialog */}
      <Dialog open={dialogOpen} onOpenChange={open => !open && setDialogOpen(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Novo Tipo de Serviço</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">
                Valor (chave interna) <span className="text-rose-500">*</span>
              </Label>
              <Input
                value={draft.value}
                onChange={e => setDraft(d => ({ ...d, value: e.target.value }))}
                placeholder="Ex: Preventiva"
                className="rounded-xl"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Label (exibição)</Label>
              <Input
                value={draft.label}
                onChange={e => setDraft(d => ({ ...d, label: e.target.value }))}
                placeholder="Igual ao valor se deixado em branco"
                className="rounded-xl"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleAdd}
              disabled={saving || !draft.value.trim()}
              className="rounded-xl bg-primary hover:bg-primary/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
