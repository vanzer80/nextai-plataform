import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ClipboardList } from 'lucide-react';
import { useServiceTypes } from '@/src/hooks/useServiceTypes';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';

const PRIORITY_OPTIONS = [
  { value: 'baixa',   label: 'Baixa',   cls: 'text-slate-600' },
  { value: 'normal',  label: 'Normal',  cls: 'text-blue-600' },
  { value: 'alta',    label: 'Alta',    cls: 'text-amber-600' },
  { value: 'critica', label: 'Crítica', cls: 'text-rose-600' },
] as const;

interface Step1Props {
  form: UseFormReturn<ReportFormValues>;
}

export default function Step1Identification({ form }: Step1Props) {
  const { register, setValue, watch, formState: { errors } } = form;
  const serviceType = watch('service_type');
  const priority = watch('priority') ?? 'normal';
  const { types: serviceTypes } = useServiceTypes();

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-primary" />
          Identificação do Serviço
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">

        {/* Tipo de Serviço */}
        <div className="space-y-2" data-onboarding="wizard-step1-tipo">
          <Label className="text-sm font-semibold text-foreground">
            Tipo de Serviço <span className="text-rose-500">*</span>
          </Label>
          <Select
            value={serviceType ?? ''}
            onValueChange={val => setValue('service_type', val as ReportFormValues['service_type'], { shouldValidate: true })}
          >
            <SelectTrigger className="h-12 text-base rounded-xl bg-muted border-border focus:ring-ring">
              <SelectValue placeholder="Selecione o tipo de serviço" />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="py-3 text-base">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.service_type && (
            <p className="text-sm text-rose-600">{errors.service_type.message}</p>
          )}
        </div>

        {/* Número da OS */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Número da OS</Label>
          <Input
            {...register('os_number')}
            placeholder="Ex: OS-2024-001"
            className="h-12 text-base rounded-xl bg-muted border-border focus-visible:ring-ring"
          />
        </div>

        {/* Data do Serviço */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">
            Data do Serviço <span className="text-rose-500">*</span>
          </Label>
          <Input
            {...register('service_date')}
            type="date"
            className="h-12 text-base rounded-xl bg-muted border-border focus-visible:ring-ring"
          />
          {errors.service_date && (
            <p className="text-sm text-rose-600">{errors.service_date.message}</p>
          )}
        </div>

        {/* Prioridade */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Prioridade</Label>
          <Select
            value={priority}
            onValueChange={val => setValue('priority', val as ReportFormValues['priority'], { shouldValidate: true })}
          >
            <SelectTrigger className="h-12 text-base rounded-xl bg-muted border-border focus:ring-ring">
              <SelectValue placeholder="Selecione a prioridade" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="py-3 text-base">
                  <span className={opt.cls}>{opt.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Hora de Início */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Hora de Início</Label>
          <Input
            {...register('started_at')}
            type="time"
            className="h-12 text-base rounded-xl bg-muted border-border focus-visible:ring-ring"
          />
        </div>

      </CardContent>
    </Card>
  );
}
