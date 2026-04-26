import { useState } from 'react';
import { Sparkles, Loader2, CheckCircle, X, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { enhanceDiagnostic, type DiagnosticEnhancementResult } from '@/src/services/aiService';
import type { ServiceType } from '@/src/types/reports';

interface AiDiagnosticAssistantProps {
  rawInput: string;             // texto atual do campo diagnóstico
  serviceType: ServiceType | undefined;
  assetDescription?: string;
  reportedProblem?: string;
  onApply: (result: DiagnosticEnhancementResult) => void;
  disabled?: boolean;
}

export default function AiDiagnosticAssistant({
  rawInput,
  serviceType,
  assetDescription,
  reportedProblem,
  onApply,
  disabled,
}: AiDiagnosticAssistantProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<DiagnosticEnhancementResult | null>(null);

  const handleEnhance = async () => {
    if (!rawInput.trim()) {
      toast.warning('Descreva o diagnóstico antes de usar a IA.');
      return;
    }
    if (!serviceType) {
      toast.warning('Selecione o tipo de serviço no Passo 1.');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const enhanced = await enhanceDiagnostic(rawInput, {
        serviceType,
        assetDescription,
        reportedProblem,
      });
      setResult(enhanced);
    } catch (err: unknown) {
      toast.error('IA indisponível', { description: 'Preencha o diagnóstico manualmente.' });
      console.error('[AiDiagnosticAssistant]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    if (result) {
      onApply(result);
      setResult(null);
      toast.success('Diagnóstico aplicado. Revise antes de continuar.');
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
          <><Sparkles className="h-4 w-4" /> Melhorar diagnóstico com IA</>
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
              <p className="text-xs font-semibold text-blue-700 mb-0.5">Diagnóstico técnico</p>
              <p className="text-slate-800 leading-relaxed">{result.final_diagnosis}</p>
            </div>

            {result.possible_causes.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-1">Possíveis causas</p>
                <ul className="space-y-0.5">
                  {result.possible_causes.map((cause, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-slate-700">
                      <ChevronRight className="h-3.5 w-3.5 text-blue-500 mt-0.5 shrink-0" />
                      {cause}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendation && (
              <div>
                <p className="text-xs font-semibold text-blue-700 mb-0.5">Recomendação técnica</p>
                <p className="text-slate-700">{result.recommendation}</p>
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
