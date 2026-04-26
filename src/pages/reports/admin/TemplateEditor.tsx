import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronUp, ChevronDown,
  Save, Loader2, GripVertical,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  getTemplateWithItems, createTemplate, updateTemplate,
  blankDraftItem,
} from '@/src/services/checklistService';
import type { DraftItem } from '@/src/services/checklistService';
import type { ChecklistItemType, ServiceType } from '@/src/types/reports';
import { SERVICE_TYPE_OPTIONS } from '@/src/types/reports';

// ── Helpers ───────────────────────────────────────────────────

const ITEM_TYPE_LABEL: Record<ChecklistItemType, string> = {
  boolean: 'Sim/Não',
  text:    'Texto livre',
  number:  'Número',
  photo:   'Foto',
  select:  'Seleção',
};

const ITEM_TYPE_COLOR: Record<ChecklistItemType, string> = {
  boolean: 'bg-emerald-100 text-emerald-700',
  text:    'bg-blue-100 text-blue-700',
  number:  'bg-violet-100 text-violet-700',
  photo:   'bg-orange-100 text-orange-700',
  select:  'bg-teal-100 text-teal-700',
};

// ── Item Dialog ───────────────────────────────────────────────

interface ItemDialogProps {
  open: boolean;
  initial: DraftItem | null;
  onSave: (item: DraftItem) => void;
  onClose: () => void;
}

function ItemDialog({ open, initial, onSave, onClose }: ItemDialogProps) {
  const [draft, setDraft] = useState<DraftItem>(blankDraftItem());

  useEffect(() => {
    if (open) setDraft(initial ?? blankDraftItem());
  }, [open, initial]);

  const set = <K extends keyof DraftItem>(k: K, v: DraftItem[K]) =>
    setDraft(prev => ({ ...prev, [k]: v }));

  const canSave = draft.label.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{initial?.dbId ? 'Editar item' : 'Adicionar item'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Pergunta / Label <span className="text-rose-500">*</span></Label>
            <Input
              value={draft.label}
              onChange={e => set('label', e.target.value)}
              placeholder="Ex: Verificou pressão do sistema?"
              className="rounded-xl"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Descrição (instrução)</Label>
            <Input
              value={draft.description}
              onChange={e => set('description', e.target.value)}
              placeholder="Instrução adicional para o técnico..."
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Tipo de resposta</Label>
            <Select
              value={draft.item_type}
              onValueChange={v => set('item_type', v as ChecklistItemType)}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(ITEM_TYPE_LABEL) as ChecklistItemType[]).map(t => (
                  <SelectItem key={t} value={t}>{ITEM_TYPE_LABEL[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {draft.item_type === 'select' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Opções (uma por linha)</Label>
              <Textarea
                value={draft.options.join('\n')}
                onChange={e =>
                  set('options', e.target.value.split('\n').filter(o => o.trim()))
                }
                placeholder={'OK\nNOK\nN/A'}
                className="min-h-[90px] resize-none rounded-xl text-sm"
              />
            </div>
          )}

          <div className="flex items-center gap-3">
            <Switch
              checked={draft.is_required}
              onCheckedChange={v => set('is_required', v)}
            />
            <Label className="text-sm font-medium cursor-pointer">
              Resposta obrigatória
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} className="rounded-xl">Cancelar</Button>
          <Button
            onClick={() => { if (canSave) { onSave(draft); onClose(); } }}
            disabled={!canSave}
            className="rounded-xl bg-primary hover:bg-primary/90"
          >
            {initial?.dbId ? 'Salvar alterações' : 'Adicionar item'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main ──────────────────────────────────────────────────────

interface TemplateHeader {
  name: string;
  description: string;
  service_type: ServiceType | null;
  asset_category: string;
  is_active: boolean;
}

const blankHeader = (): TemplateHeader => ({
  name: '', description: '', service_type: null, asset_category: '', is_active: true,
});

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [header, setHeader] = useState<TemplateHeader>(blankHeader());
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DraftItem | null>(null);

  useEffect(() => {
    if (!id) return;
    getTemplateWithItems(id).then(data => {
      setHeader({
        name:           data.name,
        description:    data.description ?? '',
        service_type:   data.service_type,
        asset_category: data.asset_category ?? '',
        is_active:      data.is_active,
      });
      setItems(
        data.checklist_template_items.map(i => ({
          localId:     crypto.randomUUID(),
          dbId:        i.id,
          label:       i.label,
          description: i.description ?? '',
          item_type:   i.item_type,
          options:     i.options ?? [],
          is_required: i.is_required,
        }))
      );
    }).catch(() => {
      toast.error('Erro ao carregar template.');
      navigate('/admin/checklist-templates');
    }).finally(() => setLoading(false));
  }, [id, navigate]);

  const setH = <K extends keyof TemplateHeader>(k: K, v: TemplateHeader[K]) =>
    setHeader(prev => ({ ...prev, [k]: v }));

  // Item operations
  const openAdd = () => { setEditingItem(null); setDialogOpen(true); };
  const openEdit = (item: DraftItem) => { setEditingItem(item); setDialogOpen(true); };

  const handleSaveItem = (saved: DraftItem) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.localId === saved.localId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  };

  const removeItem = (localId: string) =>
    setItems(prev => prev.filter(i => i.localId !== localId));

  const moveItem = (localId: string, dir: -1 | 1) => {
    setItems(prev => {
      const idx = prev.findIndex(i => i.localId === localId);
      const next = idx + dir;
      if (next < 0 || next >= prev.length) return prev;
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr;
    });
  };

  const handleSave = async () => {
    if (!header.name.trim()) {
      toast.warning('Informe o nome do template.');
      return;
    }
    setSaving(true);
    try {
      if (isEdit && id) {
        await updateTemplate(id, header, items);
        toast.success('Template atualizado!');
      } else {
        await createTemplate(header, items, user?.id ?? '');
        toast.success('Template criado!');
      }
      navigate('/admin/checklist-templates');
    } catch {
      toast.error('Erro ao salvar template.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-muted-foreground">
        <Loader2 className="h-7 w-7 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto pb-10">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/admin/checklist-templates')}
          className="h-10 w-10 rounded-full hover:bg-muted shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground">
            {isEdit ? 'Editar Template' : 'Novo Template'}
          </h1>
          {isEdit && header.name && (
            <p className="text-xs text-muted-foreground truncate">{header.name}</p>
          )}
        </div>
        <Button
          onClick={handleSave}
          disabled={saving}
          className="h-10 rounded-xl bg-primary hover:bg-primary/90 gap-2 font-semibold shrink-0"
        >
          {saving
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Save className="h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {/* Dados do template */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3 border-b border-border bg-muted/40 rounded-t-xl">
          <CardTitle className="text-base">Informações do Template</CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Nome <span className="text-rose-500">*</span>
            </Label>
            <Input
              value={header.name}
              onChange={e => setH('name', e.target.value)}
              placeholder="Ex: Checklist Manutenção Preventiva Compressores"
              className="rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Descrição</Label>
            <Textarea
              value={header.description}
              onChange={e => setH('description', e.target.value)}
              placeholder="Contexto ou instruções gerais sobre este checklist..."
              className="min-h-[70px] resize-none rounded-xl text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Tipo de Serviço</Label>
              <Select
                value={header.service_type ?? 'none'}
                onValueChange={v => setH('service_type', v === 'none' ? null : v as ServiceType)}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Qualquer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Qualquer tipo</SelectItem>
                  {SERVICE_TYPE_OPTIONS.map(t => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-semibold">Categoria de Ativo</Label>
              <Input
                value={header.asset_category}
                onChange={e => setH('asset_category', e.target.value)}
                placeholder="Ex: Compressor, HVAC..."
                className="rounded-xl"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 pt-1">
            <Switch
              checked={header.is_active}
              onCheckedChange={v => setH('is_active', v)}
            />
            <Label className="text-sm font-medium">Template ativo</Label>
          </div>

        </CardContent>
      </Card>

      {/* Itens */}
      <Card className="shadow-sm border-border">
        <CardHeader className="pb-3 border-b border-border bg-muted/40 rounded-t-xl">
          <CardTitle className="text-base flex items-center gap-2">
            Itens do Checklist
            <span className="ml-auto text-xs font-normal text-muted-foreground">{items.length} itens</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-2">

          {items.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum item ainda. Adicione o primeiro abaixo.
            </p>
          )}

          {items.map((item, idx) => (
            <div
              key={item.localId}
              className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2.5"
            >
              <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-sm font-semibold text-foreground truncate">{item.label}</p>
                  {item.is_required && (
                    <span className="text-[10px] font-bold text-rose-500">*</span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${ITEM_TYPE_COLOR[item.item_type]}`}>
                    {ITEM_TYPE_LABEL[item.item_type]}
                  </span>
                  {item.item_type === 'select' && item.options.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">{item.options.join(' · ')}</span>
                  )}
                </div>
              </div>

              {/* Reorder */}
              <div className="flex flex-col gap-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => moveItem(item.localId, -1)}
                  disabled={idx === 0}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-25"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveItem(item.localId, 1)}
                  disabled={idx === items.length - 1}
                  className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground hover:text-foreground disabled:opacity-25"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Actions */}
              <button
                type="button"
                onClick={() => openEdit(item)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => removeItem(item.localId)}
                className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-50 shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={openAdd}
            className="w-full h-10 rounded-xl border-dashed border-input text-muted-foreground hover:border-primary/50 hover:text-primary gap-2 mt-1"
          >
            <Plus className="h-4 w-4" /> Adicionar item
          </Button>

        </CardContent>
      </Card>

      {/* Item Dialog */}
      <ItemDialog
        open={dialogOpen}
        initial={editingItem}
        onSave={handleSaveItem}
        onClose={() => setDialogOpen(false)}
      />

    </div>
  );
}
