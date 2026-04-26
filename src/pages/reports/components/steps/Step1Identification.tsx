import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ClipboardList } from 'lucide-react';
import { SERVICE_TYPE_OPTIONS } from '@/src/types/reports';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';

interface Step1Props {
  form: UseFormReturn<ReportFormValues>;
}

export default function Step1Identification({ form }: Step1Props) {
  const { register, setValue, watch, formState: { errors } } = form;
  const serviceType = watch('service_type');

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-blue-600" />
          Identificação do Serviço
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">

        {/* Tipo de Serviço */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">
            Tipo de Serviço <span className="text-rose-500">*</span>
          </Label>
          <Select
            value={serviceType ?? ''}
            onValueChange={val => setValue('service_type', val as ReportFormValues['service_type'], { shouldValidate: true })}
          >
            <SelectTrigger className="h-12 text-base rounded-xl bg-slate-50 border-slate-300 focus:ring-blue-600">
              <SelectValue placeholder="Selecione o tipo de serviço" />
            </SelectTrigger>
            <SelectContent>
              {SERVICE_TYPE_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt} className="py-3 text-base">{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.service_type && (
            <p className="text-sm text-rose-600">{errors.service_type.message}</p>
          )}
        </div>

        {/* Número da OS */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Número da OS</Label>
          <Input
            {...register('os_number')}
            placeholder="Ex: OS-2024-001"
            className="h-12 text-base rounded-xl bg-slate-50 border-slate-300 focus-visible:ring-blue-600"
          />
        </div>

        {/* Data do Serviço */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">
            Data do Serviço <span className="text-rose-500">*</span>
          </Label>
          <Input
            {...register('service_date')}
            type="date"
            className="h-12 text-base rounded-xl bg-slate-50 border-slate-300 focus-visible:ring-blue-600"
          />
          {errors.service_date && (
            <p className="text-sm text-rose-600">{errors.service_date.message}</p>
          )}
        </div>

        {/* Hora de Início */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Hora de Início</Label>
          <Input
            {...register('started_at')}
            type="time"
            className="h-12 text-base rounded-xl bg-slate-50 border-slate-300 focus-visible:ring-blue-600"
          />
        </div>

      </CardContent>
    </Card>
  );
}
