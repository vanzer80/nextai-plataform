import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Wrench } from 'lucide-react';
import AiExecutionAssistant from '../AiExecutionAssistant';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';
import type { ExecutionEnhancementResult } from '@/src/services/aiService';

interface Step5Props {
  form: UseFormReturn<ReportFormValues>;
}

export default function Step5Execution({ form }: Step5Props) {
  const { register, setValue, watch, getValues } = form;

  const serviceType = watch('service_type');
  const reportedProblem = watch('reported_problem');
  const finalDiagnosis = watch('final_diagnosis');
  const partsUsed = watch('parts_used');

  // useState garante re-render imediato e garantido no React 19 concurrent mode.
  // setValue mantém o RHF store em sincronia para getValues()/draft/submit.
  // (mesmo padrão do Step4Diagnosis — setValue sobre campo register() não re-renderiza)
  const [servicesText, setServicesText] = useState<string>(
    () => getValues('services_performed') ?? ''
  );
  const [pendingText, setPendingText] = useState<string>(
    () => getValues('pending_issues') ?? ''
  );
  const [recommendationText, setRecommendationText] = useState<string>(
    () => getValues('technical_recommendation') ?? ''
  );

  const handleAiApply = (result: ExecutionEnhancementResult) => {
    setServicesText(result.services_performed);
    // shouldValidate: campo obrigatório no Zod — aplicar a sugestão limpa o erro visível
    setValue('services_performed', result.services_performed, { shouldDirty: true, shouldValidate: true });

    // Sugestões nunca sobrescrevem texto já digitado pelo técnico
    if (!recommendationText && result.technical_recommendation) {
      setRecommendationText(result.technical_recommendation);
      setValue('technical_recommendation', result.technical_recommendation, { shouldDirty: true });
    }
    if (!pendingText && result.pending_issues) {
      setPendingText(result.pending_issues);
      setValue('pending_issues', result.pending_issues, { shouldDirty: true });
    }
  };

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
        <CardTitle className="text-base flex items-center gap-2">
          <Wrench className="h-4 w-4 text-primary" />
          Execução do Serviço
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">

        <div className="space-y-2" data-onboarding="wizard-step5-servicos">
          <Label className="text-sm font-semibold text-foreground">
            Serviços executados <span className="text-red-500">*</span>
          </Label>
          <Textarea
            value={servicesText}
            onChange={(e) => {
              const v = e.target.value;
              setServicesText(v);
              setValue('services_performed', v, { shouldDirty: true });
            }}
            placeholder="Descreva os procedimentos realizados durante o atendimento..."
            className="min-h-[110px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
          {form.formState.errors.services_performed && (
            <p className="text-xs text-red-500">{form.formState.errors.services_performed.message}</p>
          )}
          <div data-onboarding="wizard-step5-ia">
            <AiExecutionAssistant
              rawInput={servicesText}
              serviceType={serviceType}
              reportedProblem={reportedProblem}
              finalDiagnosis={finalDiagnosis}
              partsUsed={partsUsed}
              onApply={handleAiApply}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Peças / Materiais utilizados</Label>
          <Textarea
            {...register('parts_used')}
            placeholder="Liste as peças substituídas ou materiais consumidos..."
            className="min-h-[90px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Pendências</Label>
          <Textarea
            value={pendingText}
            onChange={(e) => {
              const v = e.target.value;
              setPendingText(v);
              setValue('pending_issues', v, { shouldDirty: true });
            }}
            placeholder="Itens que não puderam ser resolvidos nesta visita..."
            className="min-h-[80px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Recomendação técnica</Label>
          <Textarea
            value={recommendationText}
            onChange={(e) => {
              const v = e.target.value;
              setRecommendationText(v);
              setValue('technical_recommendation', v, { shouldDirty: true });
            }}
            placeholder="Próximos passos recomendados para o cliente..."
            className="min-h-[80px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Hora de término</Label>
          <Input
            {...register('finished_at')}
            type="time"
            className="h-12 text-base rounded-xl bg-muted border-border focus-visible:ring-ring"
          />
        </div>

      </CardContent>
    </Card>
  );
}
