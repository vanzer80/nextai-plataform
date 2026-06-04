import { useState, useEffect } from 'react';
import { Plus, Loader2, Trash2, Pencil, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/src/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  listBudgets, createBudget, updateBudget, deleteBudget,
} from '@/src/services/budgetService';
import type { Budget, BudgetPeriodType } from '@/src/types/budget';
import { PERIOD_LABELS } from '@/src/types/budget';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const CATEGORIES = ['Alimentação', 'Transporte', 'Hospedagem', 'Outros'];

interface FormState {
  category: string;
  customCategory: string;
  period_type: BudgetPeriodType;
  amount_limit: string;
  start_date: string;
}

const DEFAULT_FORM: FormState = {
  category: '',
  customCategory: '',
  period_type: 'monthly',
  amount_limit: '',
  start_date: new Date().toISOString().slice(0, 10),
};

export default function BudgetManagement() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Budget | null>(null);
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);

  const load = () => {
    setLoading(true);
    listBudgets()
      .then(setBudgets)
      .catch(() => toast.error('Erro ao carregar budgets.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const openNew = () => {
    setEditing(null);
    setForm(DEFAULT_FORM);
    setShowForm(true);
  };

  const openEdit = (b: Budget) => {
    setEditing(b);
    const isCustom = !CATEGORIES.includes(b.category);
    setForm({
      category:       isCustom ? 'Outros' : b.category,
      customCategory: isCustom ? b.category : '',
      period_type:    b.period_type,
      amount_limit:   String(b.amount_limit),
      start_date:     b.start_date,
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    const finalCategory = form.category === 'Outros'
      ? form.customCategory.trim()
      : form.category;

    if (!finalCategory) { toast.warning('Informe a categoria.'); return; }
    const limit = parseFloat(form.amount_limit.replace(',', '.'));
    if (isNaN(limit) || limit <= 0) { toast.warning('Informe um valor limite válido.'); return; }
    if (!user?.id) return;

    setSaving(true);
    try {
      if (editing) {
        await updateBudget(editing.id, {
          category:     finalCategory,
          period_type:  form.period_type,
          amount_limit: limit,
          start_date:   form.start_date,
        });
        toast.success('Budget atualizado.');
      } else {
        await createBudget({
          category:     finalCategory,
          period_type:  form.period_type,
          amount_limit: limit,
          start_date:   form.start_date,
        }, user.id);
        toast.success('Budget criado.');
      }
      setShowForm(false);
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (b: Budget) => {
    try {
      await updateBudget(b.id, { is_active: !b.is_active });
      setBudgets(prev => prev.map(x => x.id === b.id ? { ...x, is_active: !x.is_active } : x));
    } catch {
      toast.error('Erro ao atualizar.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este budget?')) return;
    try {
      await deleteBudget(id);
      setBudgets(prev => prev.filter(b => b.id !== id));
      toast.success('Budget excluído.');
    } catch {
      toast.error('Erro ao excluir.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto pb-8 flex flex-col gap-4 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Controle de Budget</h1>
          <p className="text-sm text-muted-foreground">Limites de despesa por categoria e período</p>
        </div>
        <Button data-onboarding="budget-novo" onClick={openNew} className="gap-2">
          <Plus className="h-4 w-4" /> Novo Budget
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : budgets.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 gap-3">
            <DollarSign className="h-10 w-10 text-muted-foreground/50" />
            <p className="text-muted-foreground text-sm">Nenhum budget configurado.</p>
            <Button variant="outline" onClick={openNew} className="gap-2 mt-1">
              <Plus className="h-4 w-4" /> Criar primeiro budget
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div data-onboarding="budget-grid" className="flex flex-col gap-3">
          {budgets.map(b => (
            <Card
              key={b.id}
              className={`hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 ${!b.is_active ? 'opacity-60' : ''}`}
            >
              <CardContent className="pt-4 flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{b.category}</span>
                    <Badge variant="outline" className="text-xs">{PERIOD_LABELS[b.period_type]}</Badge>
                    {!b.is_active && <Badge variant="secondary" className="text-xs">Inativo</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Limite: <span className="font-medium text-foreground">{BRL.format(b.amount_limit)}</span>
                    {' · '}A partir de {b.start_date.split('T')[0].split('-').reverse().join('/')}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Switch
                    checked={b.is_active}
                    onCheckedChange={() => handleToggle(b)}
                    aria-label="Ativar/desativar"
                  />
                  <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(b.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showForm} onOpenChange={v => !saving && setShowForm(v)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Budget' : 'Novo Budget'}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select
                value={form.category}
                onValueChange={v => setForm(f => ({ ...f, category: v, customCategory: '' }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.category === 'Outros' && (
                <Input
                  placeholder="Qual categoria?"
                  value={form.customCategory}
                  onChange={e => setForm(f => ({ ...f, customCategory: e.target.value }))}
                />
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Período *</Label>
              <Select
                value={form.period_type}
                onValueChange={v => setForm(f => ({ ...f, period_type: v as BudgetPeriodType }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PERIOD_LABELS) as [BudgetPeriodType, string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Limite (R$) *</Label>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0,00"
                value={form.amount_limit}
                onChange={e => setForm(f => ({ ...f, amount_limit: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Vigência a partir de</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)} disabled={saving}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
