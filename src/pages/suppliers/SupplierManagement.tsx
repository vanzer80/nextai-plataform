import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, Store, Star, Package, Phone, Mail } from 'lucide-react';
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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useSuppliers } from '@/src/hooks/useSuppliers';
import {
  createSupplier, updateSupplier, deleteSupplier,
} from '@/src/services/supplierService';
import type { Supplier, CreateSupplierDTO } from '@/src/types/supplier';

const ESTADOS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
  'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
];

const EMPTY_FORM: CreateSupplierDTO = {
  name: '',
  cnpj: null,
  contato_nome: null,
  contato_telefone: null,
  contato_email: null,
  logradouro: null,
  cidade: null,
  estado: null,
  avg_delivery_days: null,
  rating: null,
  status: 'ativo',
  notes: null,
};

function RatingStars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="flex items-center gap-0.5 text-amber-500">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < Math.round(rating) ? 'fill-current' : 'fill-none'}`} />
      ))}
      <span className="text-xs text-muted-foreground ml-1">{rating.toFixed(1)}</span>
    </span>
  );
}

export default function SupplierManagement() {
  const { suppliers, loading, reload } = useSuppliers();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState<CreateSupplierDTO>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);
  const [search, setSearch] = useState('');

  const filtered = suppliers.filter(s =>
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.cnpj ?? '').includes(search) ||
    (s.cidade ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setEditing(s);
    setForm({
      name: s.name,
      cnpj: s.cnpj,
      contato_nome: s.contato_nome,
      contato_telefone: s.contato_telefone,
      contato_email: s.contato_email,
      logradouro: s.logradouro,
      cidade: s.cidade,
      estado: s.estado,
      avg_delivery_days: s.avg_delivery_days,
      rating: s.rating,
      status: s.status,
      notes: s.notes,
    });
    setDialogOpen(true);
  };

  const set = useCallback(<K extends keyof CreateSupplierDTO>(key: K, value: CreateSupplierDTO[K]) => {
    setForm(f => ({ ...f, [key]: value }));
  }, []);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome obrigatório.'); return; }
    setSaving(true);
    try {
      const dto = {
        ...form,
        name: form.name.trim(),
        cnpj: form.cnpj?.trim() || null,
        contato_nome: form.contato_nome?.trim() || null,
        contato_telefone: form.contato_telefone?.trim() || null,
        contato_email: form.contato_email?.trim() || null,
        logradouro: form.logradouro?.trim() || null,
        cidade: form.cidade?.trim() || null,
        estado: form.estado || null,
        notes: form.notes?.trim() || null,
      };
      if (editing) {
        await updateSupplier(editing.id, dto);
        toast.success('Fornecedor atualizado.');
      } else {
        await createSupplier(dto);
        toast.success('Fornecedor criado.');
      }
      await reload();
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
      await deleteSupplier(deleteTarget.id);
      await reload();
      toast.success('Fornecedor removido.');
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
            <Store className="h-6 w-6 text-primary" /> Fornecedores
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cadastro de fornecedores e parceiros comerciais.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            placeholder="Buscar fornecedor..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="h-10 w-56 rounded-xl bg-muted border-border"
          />
          <Button data-onboarding="forn-novo" onClick={openCreate} className="h-10 rounded-xl gap-2">
            <Plus className="h-4 w-4" /> Novo Fornecedor
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center gap-2">
            <Store className="h-10 w-10 text-muted-foreground/40" />
            <p className="font-semibold text-muted-foreground">
              {search ? 'Nenhum fornecedor encontrado' : 'Nenhum fornecedor cadastrado'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div data-onboarding="forn-grid" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(s => (
            <Card key={s.id} className={`shadow-sm border-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 ${s.status === 'inativo' ? 'opacity-60' : ''}`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-semibold leading-tight">{s.name}</CardTitle>
                  <Badge className={s.status === 'ativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}>
                    {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
                {s.cnpj && <p className="text-xs text-muted-foreground font-mono">{s.cnpj}</p>}
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {(s.cidade || s.estado) && (
                  <p className="text-muted-foreground text-xs">
                    {[s.cidade, s.estado].filter(Boolean).join(' — ')}
                  </p>
                )}
                {s.contato_nome && (
                  <p className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Phone className="h-3 w-3 shrink-0" /> {s.contato_nome}
                    {s.contato_telefone ? ` · ${s.contato_telefone}` : ''}
                  </p>
                )}
                {s.contato_email && (
                  <p className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Mail className="h-3 w-3 shrink-0" /> {s.contato_email}
                  </p>
                )}
                {s.avg_delivery_days != null && (
                  <p className="text-xs flex items-center gap-1 text-muted-foreground">
                    <Package className="h-3 w-3 shrink-0" /> Prazo médio: {s.avg_delivery_days}d
                  </p>
                )}
                <RatingStars rating={s.rating} />
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" className="h-8 rounded-lg flex-1" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5 mr-1.5" /> Editar
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 rounded-lg text-rose-600 hover:text-rose-700" onClick={() => setDeleteTarget(s)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Fornecedor' : 'Novo Fornecedor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome <span className="text-rose-500">*</span></Label>
              <Input value={form.name} onChange={e => set('name', e.target.value)} className="h-11 rounded-xl bg-muted" placeholder="Nome do fornecedor" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>CNPJ</Label>
                <Input value={form.cnpj ?? ''} onChange={e => set('cnpj', e.target.value || null)} className="h-11 rounded-xl bg-muted" placeholder="00.000.000/0001-00" />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={v => set('status', v as 'ativo' | 'inativo')}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Contato</Label>
                <Input value={form.contato_nome ?? ''} onChange={e => set('contato_nome', e.target.value || null)} className="h-11 rounded-xl bg-muted" placeholder="Nome do contato" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={form.contato_telefone ?? ''} onChange={e => set('contato_telefone', e.target.value || null)} className="h-11 rounded-xl bg-muted" placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={form.contato_email ?? ''} onChange={e => set('contato_email', e.target.value || null)} className="h-11 rounded-xl bg-muted" placeholder="email@fornecedor.com" />
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <Input value={form.logradouro ?? ''} onChange={e => set('logradouro', e.target.value || null)} className="h-11 rounded-xl bg-muted" placeholder="Rua, número, bairro" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cidade</Label>
                <Input value={form.cidade ?? ''} onChange={e => set('cidade', e.target.value || null)} className="h-11 rounded-xl bg-muted" placeholder="São Paulo" />
              </div>
              <div className="space-y-2">
                <Label>Estado</Label>
                <Select value={form.estado ?? '__none__'} onValueChange={v => set('estado', v === '__none__' ? null : v)}>
                  <SelectTrigger className="h-11 rounded-xl bg-muted"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {ESTADOS.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Prazo médio entrega (dias)</Label>
                <Input
                  type="number" min={0}
                  value={form.avg_delivery_days ?? ''}
                  onChange={e => set('avg_delivery_days', e.target.value ? Number(e.target.value) : null)}
                  className="h-11 rounded-xl bg-muted"
                  placeholder="Ex: 3"
                />
              </div>
              <div className="space-y-2">
                <Label>Avaliação (1–5)</Label>
                <Input
                  type="number" min={1} max={5} step={0.1}
                  value={form.rating ?? ''}
                  onChange={e => set('rating', e.target.value ? Number(e.target.value) : null)}
                  className="h-11 rounded-xl bg-muted"
                  placeholder="Ex: 4.5"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes ?? ''}
                onChange={e => set('notes', e.target.value || null)}
                className="rounded-xl bg-muted resize-none min-h-[80px]"
                placeholder="Condições comerciais, restrições..."
              />
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
            <AlertDialogTitle>Remover fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deleteTarget?.name}</strong> será removido permanentemente.
              Compras vinculadas perderão a referência ao fornecedor.
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
