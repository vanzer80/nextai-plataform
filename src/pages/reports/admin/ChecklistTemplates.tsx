import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Trash2, Loader2, AlertTriangle, ListChecks } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  getTemplates, toggleTemplateActive, deleteTemplate,
} from '@/src/services/checklistService';
import type { ChecklistTemplate } from '@/src/types/reports';
import { useServiceTypes } from '@/src/hooks/useServiceTypes';

export default function ChecklistTemplates() {
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');
  const { types: serviceTypes } = useServiceTypes();
  const [toDelete, setToDelete] = useState<ChecklistTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      setTemplates(await getTemplates());
    } catch {
      toast.error('Erro ao carregar templates.');
    } finally {
      setLoading(false);
    }
  }

  async function handleToggle(tmpl: ChecklistTemplate) {
    try {
      await toggleTemplateActive(tmpl.id, !tmpl.is_active);
      setTemplates(prev =>
        prev.map(t => t.id === tmpl.id ? { ...t, is_active: !t.is_active } : t)
      );
    } catch {
      toast.error('Erro ao atualizar status.');
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteTemplate(toDelete.id);
      setTemplates(prev => prev.filter(t => t.id !== toDelete.id));
      toast.success('Template excluído.');
      setToDelete(null);
    } catch {
      toast.error('Erro ao excluir template.');
    } finally {
      setDeleting(false);
    }
  }

  const visible = filterType === 'all'
    ? templates
    : templates.filter(t => t.service_type === filterType);

  return (
    <div className="flex flex-col gap-5 w-full max-w-2xl mx-auto pb-10">

      {/* Cabeçalho */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Templates de Checklist
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie os modelos de checklist por tipo de serviço
          </p>
        </div>
        <Button asChild data-onboarding="admin-templates-novo" className="h-10 rounded-xl bg-primary hover:bg-primary/90 gap-2 font-semibold shrink-0">
          <Link to="/admin/checklist-templates/new">
            <Plus className="h-4 w-4" /> Novo
          </Link>
        </Button>
      </div>

      {/* Filtro */}
      <Select value={filterType} onValueChange={setFilterType}>
        <SelectTrigger className="h-10 rounded-xl bg-background border-input text-sm">
          <SelectValue placeholder="Todos os tipos" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os tipos</SelectItem>
          {serviceTypes.map(t => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16 text-muted-foreground">
          <Loader2 className="h-7 w-7 animate-spin" />
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
          <AlertTriangle className="h-8 w-8" />
          <p className="text-sm">Nenhum template encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3" data-onboarding="admin-templates-lista">
          {visible.map(tmpl => (
            <div
              key={tmpl.id}
              className={`rounded-xl border bg-card p-4 shadow-sm transition-opacity ${
                tmpl.is_active ? 'border-border' : 'border-border opacity-60'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground truncate">{tmpl.name}</p>
                    {tmpl.service_type && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                        {tmpl.service_type}
                      </span>
                    )}
                    {!tmpl.is_active && (
                      <Badge variant="secondary" className="text-[10px] bg-muted text-muted-foreground">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  {tmpl.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{tmpl.description}</p>
                  )}
                  {tmpl.asset_category && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">Categoria: {tmpl.asset_category}</p>
                  )}
                </div>

                {/* Ativo toggle */}
                <Switch
                  checked={tmpl.is_active}
                  onCheckedChange={() => handleToggle(tmpl)}
                  className="shrink-0 mt-0.5"
                />
              </div>

              {/* Ações */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                <Button
                  asChild
                  variant="outline"
                  size="sm"
                  className="flex-1 h-8 rounded-lg text-xs gap-1.5 border-border"
                >
                  <Link to={`/admin/checklist-templates/${tmpl.id}/edit`}>
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Link>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setToDelete(tmpl)}
                  className="h-8 px-3 rounded-lg text-xs text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Excluir
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmação de exclusão */}
      <Dialog open={!!toDelete} onOpenChange={open => !open && setToDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir template?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            O template <strong>{toDelete?.name}</strong> e todos os seus itens serão excluídos permanentemente.
            OS já respondidas não são afetadas.
          </p>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setToDelete(null)} disabled={deleting} className="flex-1 rounded-xl">
              Cancelar
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
