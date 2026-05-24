import { Controller, type UseFormReturn } from 'react-hook-form';
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

export default function Step4Diagnosis({ form, assetDescription }: Step4Props) {
  const { register, setValue, watch, control } = form;
  const serviceType = watch('service_type');
  const reportedProblem = watch('reported_problem');
  const preliminaryDiagnosis = watch('preliminary_diagnosis') ?? '';

  const handleAiApply = (result: DiagnosticEnhancementResult) => {
    setValue('final_diagnosis', result.final_diagnosis, { shouldDirty: true });
    if (!preliminaryDiagnosis) {
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
          <Controller
            name="preliminary_diagnosis"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <Textarea
                {...field}
                value={field.value ?? ''}
                placeholder="Observações iniciais do técnico ao chegar no local..."
                className="min-h-[90px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
              />
            )}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Diagnóstico final</Label>
          <Controller
            name="final_diagnosis"
            control={control}
            defaultValue=""
            render={({ field }) => (
              <Textarea
                {...field}
                value={field.value ?? ''}
                placeholder="Diagnóstico técnico formal após análise completa..."
                className="min-h-[110px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
              />
            )}
          />
          <AiDiagnosticAssistant
            rawInput={preliminaryDiagnosis}
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
