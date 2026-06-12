import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle, X, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { enhanceExecution, type ExecutionEnhancementResult } from '@/src/services/aiService';
import type { ServiceType } from '@/src/types/reports';

interface AiExecutionAssistantProps {
  rawInput: string;
  serviceType: ServiceType | undefined;
  reportedProblem?: string;
  finalDiagnosis?: string;
  partsUsed?: string;
  onApply: (result: ExecutionEnhancementResult) => void;
  disabled?: boolean;
}

export default function AiExecutionAssistant({
  rawInput,
  serviceType,
  reportedProblem,
  finalDiagnosis,
  partsUsed,
  onApply,
  disabled,
}: AiExecutionAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ExecutionEnhancementResult | null>(null);

  const handleEnhance = async () => {
    if (!rawInput.trim()) {
      toast.warning('Descreva os serviços executados antes de usar a IA.');
      return;
    }
    if (!serviceType) {
      toast.warning('Selecione o tipo de serviço no Passo 1.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const enhanced = await enhanceExecution(rawInput, {
        serviceType,
        reportedProblem,
        // O diagnóstico aplicado pela IA no Step 4 pode ser longo — slice protege custo de token
        finalDiagnosis: finalDiagnosis?.slice(0, 1500),
        partsUsed,
      });
      setResult(enhanced);
    } catch (err: unknown) {
      toast.error('IA indisponível', { description: 'Preencha os campos manualmente.' });
      console.error('[AiExecutionAssistant]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      setResult(null);
      toast.success('Texto aplicado. Revise antes de continuar.');
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    const parts = [result.services_performed];
    if (result.technical_recommendation) parts.push(`Recomendação técnica: ${result.technical_recommendation}`);
    if (result.pending_issues) parts.push(`Pendências: ${result.pending_issues}`);
    try {
      await navigator.clipboard.writeText(parts.join('\n\n'));
      toast.success('Texto copiado para a área de transferência.');
    } catch {
      toast.error('Não foi possível copiar o texto.');
    }
  };

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        onClick={handleEnhance}
        disabled={loading || disabled || !rawInput.trim()}
        className="w-full h-11 rounded-xl border-blue-300 text-blue-700 hover:bg-blue-50 gap-2 font-semibold"
      >
        {loading ? (
          <><Loader2 className="h-4 w-4 animate-spin" /> Analisando com IA...</>
        ) : (
          <><Sparkles className="h-4 w-4" /> Melhorar com IA</>
        )}
      </Button>

      {result && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-blue-800 uppercase tracking-wide flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5" /> Sugestão da IA
            </p>
            <button type="button" onClick={() => setResult(null)} className="text-blue-400 hover:text-blue-700">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-2.5 text-sm">
            <div>
              <p className="text-xs font-semibold text-blue-700 mb-0.5">Serviços executados</p>
              <p className="text-slate-800 leading-relaxed">{result.services_performed}</p>
            </div>

            {result.technical_recommendation && (
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-0.5">Recomendação técnica</p>
                <p className="text-slate-700">{result.technical_recommendation}</p>
              </div>
            )}

            {result.pending_issues && (
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-0.5">Pendências identificadas</p>
                <p className="text-slate-700">{result.pending_issues}</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              onClick={handleApply}
              className="flex-1 h-9 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold gap-1.5"
            >
              <CheckCircle className="h-3.5 w-3.5" /> Aplicar sugestão
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleCopy}
              className="h-9 px-3 rounded-lg text-xs text-blue-700 border-blue-300 hover:bg-blue-50 gap-1.5"
            >
              <Copy className="h-3.5 w-3.5" /> Copiar
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setResult(null)}
              className="h-9 px-3 rounded-lg text-xs text-slate-600 hover:bg-slate-100"
            >
              Descartar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
