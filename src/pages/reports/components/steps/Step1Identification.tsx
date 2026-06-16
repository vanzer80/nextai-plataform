import { useState, useEffect, useCallback, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/src/components/ui/select';
import { ClipboardList, BookOpen, Hash, RefreshCw, Loader2 } from 'lucide-react';
import { useServiceTypes } from '@/src/hooks/useServiceTypes';
import { getSuggestionsForServiceType } from '@/src/services/kbService';
import { useAuth } from '@/src/contexts/AuthContext';
import { reserveOsNumber } from '@/src/services/reportService';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';
import type { KbArticle } from '@/src/types/kb';

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
  const osNumber = watch('os_number');
  const priority = watch('priority') ?? 'normal';
  const { types: serviceTypes } = useServiceTypes();
  const [kbSuggestions, setKbSuggestions] = useState<KbArticle[]>([]);
  const [generating, setGenerating] = useState(false);
  const [osError, setOsError] = useState(false);
  const { user } = useAuth();
  // Cancela respostas de chamadas obsoletas quando serviceType muda rapidamente.
  // Cada invocação captura sua própria geração; se outra começou antes de retornar,
  // o resultado é descartado silenciosamente (o gap no contador é tolerado — padrão ERP).
  const generationRef = useRef(0);

  useEffect(() => {
    if (!serviceType) { setKbSuggestions([]); return; }
    getSuggestionsForServiceType(serviceType, 3)
      .then(setKbSuggestions)
      .catch(() => setKbSuggestions([]));
  }, [serviceType]);

  const generateOsNumber = useCallback(async () => {
    const teamId = user?.team_id;
    if (!teamId) { setOsError(true); return; }

    generationRef.current += 1;
    const myGen = generationRef.current;

    setGenerating(true);
    setOsError(false);
    try {
      const reserved = await reserveOsNumber(teamId);
      if (myGen !== generationRef.current) return; // resposta obsoleta — descarta
      setValue('os_number', reserved, { shouldDirty: true });
    } catch {
      if (myGen !== generationRef.current) return;
      setOsError(true);
    } finally {
      if (myGen === generationRef.current) setGenerating(false);
    }
  }, [user?.team_id, setValue]);

  // Gera o número automaticamente na primeira seleção de tipo de serviço.
  // Idempotente: se já existe um número (rascunho restaurado), não regenera.
  useEffect(() => {
    if (!serviceType || osNumber) return;
    generateOsNumber();
  }, [serviceType]); // eslint-disable-line react-hooks/exhaustive-deps

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
            <SelectTrigger wrapText className="h-12 text-base rounded-xl bg-muted border-border focus:ring-ring">
              <SelectValue placeholder="Selecione o tipo de serviço">
                {serviceTypes.find(opt => opt.value === serviceType)?.label}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map(opt => (
                <SelectItem wrapText key={opt.value} value={opt.value} className="py-3 text-base">{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.service_type && (
            <p className="text-sm text-rose-600">{errors.service_type.message}</p>
          )}

          {/* Sugestões KB */}
          {kbSuggestions.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <BookOpen className="h-3.5 w-3.5" />
                <span className="font-medium">Artigos sugeridos para este tipo de serviço</span>
              </div>
              {kbSuggestions.map(a => (
                <div key={a.id} className="text-xs p-2.5 bg-primary/5 rounded-lg border border-primary/20">
                  <p className="font-semibold text-foreground mb-0.5">{a.title}</p>
                  {a.content && (
                    <p className="text-muted-foreground line-clamp-2 leading-snug">
                      {a.content.slice(0, 120)}{a.content.length > 120 ? '...' : ''}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Número da OS */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
            Número da OS
            <span className="text-xs font-normal text-muted-foreground">(gerado automaticamente)</span>
          </Label>

          {generating ? (
            <div className="h-12 flex items-center gap-2 px-4 rounded-xl bg-muted border border-border text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin shrink-0" />
              Reservando número...
            </div>
          ) : osNumber && !osError ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-12 flex items-center gap-2 px-4 rounded-xl bg-primary/10 border border-primary/20">
                <Hash className="h-4 w-4 text-primary shrink-0" />
                <span className="font-mono font-semibold text-primary text-base tracking-wide">
                  {osNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={generateOsNumber}
                title="Gerar novo número"
                className="h-12 w-12 flex items-center justify-center rounded-xl border border-border bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <Input
                {...register('os_number')}
                placeholder="Ex: OS-202605-00001"
                className="h-12 text-base rounded-xl bg-muted border-border focus-visible:ring-ring"
              />
              {osError && (
                <p className="text-xs text-amber-600">
                  Não foi possível gerar automaticamente — digite manualmente ou{' '}
                  <button type="button" onClick={generateOsNumber} className="underline hover:no-underline">
                    tente novamente
                  </button>
                  .
                </p>
              )}
            </>
          )}
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
