import { AlertTriangle, Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/src/components/ui/tooltip';

interface Props {
  confidence: number; // 0.0 – 1.0
  requiresReview?: boolean;
  templateId?: string | null;
}

export function ImportConfidenceBadge({ confidence, requiresReview, templateId }: Props) {
  const pct = Math.round(confidence * 100);

  const colorClass =
    pct >= 90 ? 'bg-green-100 text-green-700 border-green-200' :
    pct >= 70 ? 'bg-amber-100 text-amber-700 border-amber-200' :
                'bg-red-100  text-red-700  border-red-200';

  const label = templateId
    ? `Extraído via template (${pct}%)`
    : `Extraído via IA (${pct}%)`;

  const tooltip = requiresReview
    ? 'Confiança baixa — revise os campos extraídos antes de aprovar.'
    : 'Campos extraídos automaticamente do PDF.';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium cursor-default ${colorClass}`}>
          {requiresReview
            ? <AlertTriangle className="h-3 w-3 shrink-0" />
            : <Sparkles className="h-3 w-3 shrink-0" />}
          {label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-60 text-center">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
