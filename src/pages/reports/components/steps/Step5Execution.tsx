import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Wrench } from 'lucide-react';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';

interface Step5Props {
  form: UseFormReturn<ReportFormValues>;
}

export default function Step5Execution({ form }: Step5Props) {
  const { register } = form;

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
            {...register('services_performed')}
            placeholder="Descreva os procedimentos realizados durante o atendimento..."
            className="min-h-[110px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
          {form.formState.errors.services_performed && (
            <p className="text-xs text-red-500">{form.formState.errors.services_performed.message}</p>
          )}
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
            {...register('pending_issues')}
            placeholder="Itens que não puderam ser resolvidos nesta visita..."
            className="min-h-[80px] resize-none rounded-xl bg-muted border-border text-base focus-visible:ring-ring"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Recomendação técnica</Label>
          <Textarea
            {...register('technical_recommendation')}
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
