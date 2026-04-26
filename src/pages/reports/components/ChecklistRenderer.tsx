import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import type { ChecklistTemplateItem, ReportChecklistItem } from '@/src/types/reports';

interface ChecklistRendererProps {
  items: ChecklistTemplateItem[];
  answers: Record<string, Partial<ReportChecklistItem>>;
  onChange: (itemId: string, patch: Partial<ReportChecklistItem>) => void;
}

export default function ChecklistRenderer({ items, answers, onChange }: ChecklistRendererProps) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-4">
      {items.map(item => {
        const answer = answers[item.id] ?? {};

        return (
          <div key={item.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  {item.label}
                  {item.is_required && <span className="text-rose-500 ml-1">*</span>}
                </p>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>

              {/* Boolean: switch inline */}
              {item.item_type === 'boolean' && (
                <Switch
                  checked={answer.value_boolean ?? false}
                  onCheckedChange={val =>
                    onChange(item.id, {
                      ...answer,
                      value_boolean: val,
                      is_conformant: val,
                      label: item.label,
                      item_type: item.item_type,
                      template_item_id: item.id,
                    })
                  }
                />
              )}
            </div>

            {/* Text */}
            {item.item_type === 'text' && (
              <Textarea
                placeholder="Digite sua observação..."
                value={answer.value_text ?? ''}
                onChange={e =>
                  onChange(item.id, {
                    ...answer,
                    value_text: e.target.value,
                    label: item.label,
                    item_type: item.item_type,
                    template_item_id: item.id,
                  })
                }
                className="min-h-[80px] resize-none rounded-lg bg-background border-input text-sm"
              />
            )}

            {/* Number */}
            {item.item_type === 'number' && (
              <Input
                type="number"
                placeholder="0"
                value={answer.value_number ?? ''}
                onChange={e =>
                  onChange(item.id, {
                    ...answer,
                    value_number: e.target.value ? Number(e.target.value) : undefined,
                    label: item.label,
                    item_type: item.item_type,
                    template_item_id: item.id,
                  })
                }
                className="h-10 rounded-lg bg-background border-input text-sm"
              />
            )}

            {/* Select */}
            {item.item_type === 'select' && item.options && (
              <Select
                value={answer.value_option ?? ''}
                onValueChange={val =>
                  onChange(item.id, {
                    ...answer,
                    value_option: val,
                    is_conformant: val !== 'NOK',
                    label: item.label,
                    item_type: item.item_type,
                    template_item_id: item.id,
                  })
                }
              >
                <SelectTrigger className="h-10 rounded-lg bg-background border-input text-sm">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {item.options.map(opt => (
                    <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Photo */}
            {item.item_type === 'photo' && (
              <Label className="block">
                <div className="border-2 border-dashed border-input rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors">
                  {answer.attachment_url ? (
                    <p className="text-xs text-emerald-600 font-medium">Foto anexada ✓</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">Toque para anexar foto</p>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      // URL temporária para preview — upload real acontece no submit final
                      const previewUrl = URL.createObjectURL(file);
                      onChange(item.id, {
                        ...answer,
                        attachment_url: previewUrl,
                        label: item.label,
                        item_type: item.item_type,
                        template_item_id: item.id,
                      });
                    }}
                  />
                </div>
              </Label>
            )}
          </div>
        );
      })}
    </div>
  );
}
