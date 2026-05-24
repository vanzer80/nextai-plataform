import { useState } from 'react';
import { type UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Stethoscope } from 'lucide-react';
import AiDiagnosticAssistant from '../AiDiagnosticAssistant';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';
import type { DiagnosticEnhancementResult } from '@/src/services/aiService';

interface Step4Props {
  form: UseFormReturn<ReportFormValues>;
  assetDescription?: string;
}

// Monta o texto completo da IA para o campo "Diagnóstico final"
export function buildAppliedText(r: DiagnosticEnhancementResult): string {
  const parts = [r.final_diagnosis];
  if (r.possible_causes?.length > 0) {
    parts.push('Causas possíveis:\n' + r.possible_causes.map((c) => `• ${c}`).join('\n'));
  }
  if (r.recommendation) parts.push(`Recomendação técnica: ${r.recommendation}`);
  return parts.join('\n\n');
}

export default function Step4Diagnosis({ form, assetDescription }: Step4Props) {
  const { register, setValue, watch } = form;
  const serviceType = watch('service_type');
  const reportedProblem = watch('reported_problem');

  // useState garante re-render imediato e garantido no React 19 concurrent mode.
  // setValue mantém o RHF store em sincronia para getValues()/draft/submit.
  const [preliminaryDiagnosisText, setPreliminaryDiagnosisText] = useState<string>(
    () => form.getValues('preliminary_diagnosis') ?? ''
  );

  const [finalDiagnosisText, setFinalDiagnosisText] = useState<string>(
    () => form.getValues('final_diagnosis') ?? ''
  );

  const handleAiApply = (result: DiagnosticEnhancementResult) => {
    const fullText = buildAppliedText(result);

    setFinalDiagnosisText(fullText);
    setValue('final_diagnosis', fullText, { shouldDirty: true });

    if (!preliminaryDiagnosisText) {
      setPreliminaryDiagnosisText(result.technical_description);
      setValue('preliminary_diagnosis', result.technical_description, { shouldDirty: true });
    }
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
        <CardTitle className="text-base flex items-center gap-2">
          <Stethoscope className="h-4 w-4 text-primary" />
          Diagnóstico Técnico
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">

        <div className="space-y-2" data-onboarding="wizard-step4-problema">
          <Label className="text-sm font-semibold text-foreground">
            Problema relatado pelo cliente <span className="text-red-500">*</span>
          </Label>
          <Textarea
            {...register('reported_problem')}
            placeholder="Descreva o problema conforme relatado pelo cliente..."
            className="min-h-[90px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
          {form.formState.errors.reported_problem && (
            <p className="text-xs text-red-500">{form.formState.errors.reported_problem.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Diagnóstico preliminar</Label>
          <Textarea
            value={preliminaryDiagnosisText}
            onChange={(e) => {
              const v = e.target.value;
              setPreliminaryDiagnosisText(v);
              setValue('preliminary_diagnosis', v, { shouldDirty: true });
            }}
            placeholder="Observações iniciais do técnico ao chegar no local..."
            className="min-h-[90px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Diagnóstico final</Label>
          <Textarea
            value={finalDiagnosisText}
            onChange={(e) => {
              const v = e.target.value;
              setFinalDiagnosisText(v);
              setValue('final_diagnosis', v, { shouldDirty: true });
            }}
            placeholder="Diagnóstico técnico formal após análise completa..."
            className="min-h-[110px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
          <AiDiagnosticAssistant
            rawInput={preliminaryDiagnosisText}
            serviceType={serviceType}
            assetDescription={assetDescription}
            reportedProblem={reportedProblem}
            onApply={handleAiApply}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Notas internas</Label>
          <Textarea
            {...register('internal_notes')}
            placeholder="Observações internas — não visíveis ao cliente..."
            className="min-h-[80px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
        </div>

      </CardContent>
    </Card>
  );
}
