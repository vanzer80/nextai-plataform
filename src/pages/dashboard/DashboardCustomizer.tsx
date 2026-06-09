import { useState } from 'react';
import { Settings2, RotateCcw, Check, ChevronUp, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { WIDGET_DEFINITIONS } from './widgetRegistry';
import type { WidgetId } from './widgetRegistry';

interface Props {
  open: boolean;
  onClose: () => void;
  eligibleWidgets: WidgetId[];
  activeWidgets: WidgetId[];
  isSaving: boolean;
  onSave: (order: WidgetId[]) => Promise<void>;
  onReset: () => Promise<void>;
}

export function DashboardCustomizer({ open, onClose, eligibleWidgets, activeWidgets, isSaving, onSave, onReset }: Props) {
  const [items, setItems] = useState<{ id: WidgetId; visible: boolean }[]>(() =>
    buildItems(eligibleWidgets, activeWidgets)
  );

  const handleOpenChange = (v: boolean) => {
    if (v) setItems(buildItems(eligibleWidgets, activeWidgets));
    if (!v) onClose();
  };

  const toggle = (id: WidgetId) =>
    setItems(prev => prev.map(it => it.id === id ? { ...it, visible: !it.visible } : it));

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...items];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setItems(next);
  };

  const handleSave = async () => {
    const ordered = items.filter(it => it.visible).map(it => it.id);
    if (ordered.length === 0) {
      toast.warning('Selecione pelo menos um indicador antes de salvar.');
      return;
    }
    try {
      await onSave(ordered);
      toast.success('Dashboard personalizado com sucesso.');
      onClose();
    } catch {
      toast.error('Erro ao salvar preferências. Tente novamente.');
    }
  };

  const handleReset = async () => {
    try {
      await onReset();
      toast.success('Dashboard restaurado para o padrão do seu perfil.');
      onClose();
    } catch {
      toast.error('Erro ao restaurar padrão. Tente novamente.');
    }
  };

  const visibleCount = items.filter(it => it.visible).length;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Personalizar Dashboard
          </DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground -mt-1">
          Ative ou desative indicadores e reordene com as setas.
          {visibleCount === 0 && (
            <span className="text-destructive ml-1 font-medium">Selecione pelo menos um.</span>
          )}
        </p>

        <div className="space-y-1 max-h-[420px] overflow-y-auto pr-1">
          {items.map((item, idx) => {
            const def = WIDGET_DEFINITIONS.find(w => w.id === item.id);
            if (!def) return null;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                  item.visible ? 'bg-muted/60' : 'opacity-40'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{def.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{def.description}</p>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => move(idx, -1)}
                    disabled={idx === 0 || isSaving}
                    className="p-1 rounded hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Mover para cima"
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(idx, 1)}
                    disabled={idx === items.length - 1 || isSaving}
                    className="p-1 rounded hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed"
                    aria-label="Mover para baixo"
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>
                  <Switch
                    checked={item.visible}
                    onCheckedChange={() => toggle(item.id)}
                    disabled={isSaving}
                    className="ml-1"
                    aria-label={`${item.visible ? 'Ocultar' : 'Exibir'} ${def.label}`}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2 sm:gap-0 flex-row justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            disabled={isSaving}
            className="text-muted-foreground"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Restaurar padrão
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving || visibleCount === 0}>
              <Check className="h-3.5 w-3.5 mr-1.5" />
              {isSaving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function buildItems(eligible: WidgetId[], active: WidgetId[]): { id: WidgetId; visible: boolean }[] {
  const activeSet = new Set(active);
  const ordered = [
    ...active.filter(id => eligible.includes(id)),
    ...eligible.filter(id => !activeSet.has(id)),
  ];
  return ordered.map(id => ({ id, visible: activeSet.has(id) }));
}
