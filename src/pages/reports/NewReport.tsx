import { useState, useCallback, lazy, Suspense, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, ArrowRight, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { useReportDraft } from '@/src/hooks/useReportDraft';
import { useChecklistTemplate } from '@/src/hooks/useChecklistTemplate';
import SyncStatusIndicator from './components/SyncStatusIndicator';
import { submitReport } from '@/src/services/reportService';
import { supabase } from '@/src/lib/supabase';
import type { ReportChecklistItem, EvidenceFile, CreateServiceReportDTO } from '@/src/types/reports';

const Step1Identification = lazy(() => import('./components/steps/Step1Identification'));
const Step2AssetContext   = lazy(() => import('./components/steps/Step2AssetContext'));
const Step3Checklist      = lazy(() => import('./components/steps/Step3Checklist'));
const Step4Diagnosis      = lazy(() => import('./components/steps/Step4Diagnosis'));
const Step5Execution      = lazy(() => import('./components/steps/Step5Execution'));
const Step6Evidence       = lazy(() => import('./components/steps/Step6Evidence'));
const Step7SignatureSend  = lazy(() => import('./components/steps/Step7SignatureSend'));

// ── Schema Zod (cobre todos os 7 steps) ──────────────────────

export const reportSchema = z.object({
  // Step 1
  service_type: z.string().min(1, { message: 'Selecione o tipo de serviço' }),
  service_date: z.string().min(1, 'Informe a data do serviço'),
  os_number:    z.string().optional(),
  started_at:   z.string().optional(),
  priority:     z.enum(['baixa', 'normal', 'alta', 'critica']).optional(),

  // Step 2
  client_id:          z.string().optional(),
  client_location_id: z.string().optional(),
  site_location:      z.string().optional(),
  asset_id:           z.string().optional(),
  asset_name_manual: z.string().optional(),
  geo_lat:         z.number().optional(),
  geo_lng:         z.number().optional(),
  geo_accuracy:    z.number().optional(),
  geo_captured_at: z.string().optional(),

  // Steps 4–5
  reported_problem:         z.string().min(1, 'Descreva o problema relatado pelo cliente'),
  preliminary_diagnosis:    z.string().optional(),
  final_diagnosis:          z.string().optional(),
  internal_notes:           z.string().optional(),
  services_performed:       z.string().min(1, 'Descreva os serviços executados'),
  parts_used:               z.string().optional(),
  pending_issues:           z.string().optional(),
  technical_recommendation: z.string().optional(),
  finished_at:              z.string().optional(),
});

export type ReportFormValues = z.infer<typeof reportSchema>;

// ── Campos validados por step ─────────────────────────────────

const STEP_FIELDS: Record<number, (keyof ReportFormValues)[]> = {
  1: ['service_type', 'service_date'],
  2: [],
  3: [],
  4: ['reported_problem'],
  5: ['services_performed'],
  6: [],
  7: [],
};

const STEP_LABELS = [
  'Identificação',
  'Ativo e Contexto',
  'Checklist',
  'Diagnóstico',
  'Execução',
  'Evidências',
  'Assinatura',
];

const TOTAL_STEPS = 7;

// ── Componente ────────────────────────────────────────────────

export default function NewReport() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { tenant } = useTenant();
  const [currentStep, setCurrentStep] = useState(1);
  const [checklistAnswers, setChecklistAnswers] = useState<Record<string, Partial<ReportChecklistItem>>>({});
  const [attachments, setAttachments] = useState<EvidenceFile[]>([]);
  const [technicianSignature, setTechnicianSignature] = useState<string | null>(null);
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [clientSignerName, setClientSignerName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      service_type: undefined,
      service_date: new Date().toISOString().split('T')[0],
      os_number: '',
      started_at: '',
      priority: 'normal' as const,
      client_id: undefined,
      client_location_id: undefined,
      site_location: '',
      asset_id: undefined,
      asset_name_manual: '',
    },
  });

  // Pre-fill from QR code deep link: /reports/new?asset_id=...&client_id=...
  useEffect(() => {
    const assetId  = searchParams.get('asset_id');
    const clientId = searchParams.get('client_id');
    if (assetId)  form.setValue('asset_id', assetId);
    if (clientId) form.setValue('client_id', clientId);
    if (assetId || clientId) setCurrentStep(2);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Duplicar OS: pré-preenche contexto (cliente, equipamento, tipo, prioridade).
  // Diagnóstico e execução ficam vazios — a nova OS é um trabalho novo, não cópia.
  // os_number é regenerado automaticamente pelo Step1 ao detectar o service_type.
  useEffect(() => {
    const duplicateFrom = searchParams.get('duplicateFrom');
    if (!duplicateFrom) return;
    supabase
      .from('service_reports')
      .select('service_type, client_id, site_location, asset_id, asset_name_manual, priority')
      .eq('id', duplicateFrom)
      .single()
      .then(({ data }) => {
        if (!data) return;
        if (data.service_type)      form.setValue('service_type', data.service_type);
        if (data.client_id)         form.setValue('client_id', data.client_id);
        if (data.site_location)     form.setValue('site_location', data.site_location);
        if (data.asset_id)          form.setValue('asset_id', data.asset_id);
        if (data.asset_name_manual) form.setValue('asset_name_manual', data.asset_name_manual);
        if (data.priority)          form.setValue('priority', data.priority as ReportFormValues['priority']);
        form.setValue('service_date', new Date().toISOString().split('T')[0]);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draft = useReportDraft();
  const serviceType = form.watch('service_type');
  const { template, loading: templateLoading } = useChecklistTemplate(serviceType);
  const assetId = form.watch('asset_id');

  const autosaveStep = useCallback(async () => {
    const values = form.getValues();
    await draft.saveNow(
      {
        technician_id: user?.id ?? '',
        status: 'draft',
        ...values,
      } as Parameters<typeof draft.saveNow>[0],
      checklistAnswers as Record<string, object>,
    );
  }, [form, draft, user, checklistAnswers]);

  const handleNext = async () => {
    const fields = STEP_FIELDS[currentStep];
    const valid = fields.length > 0 ? await form.trigger(fields) : true;
    if (!valid) return;
    await autosaveStep();
    setCurrentStep(s => Math.min(s + 1, TOTAL_STEPS));
  };

  const handleBack = async () => {
    await autosaveStep();
    if (currentStep === 1) {
      navigate('/reports');
    } else {
      setCurrentStep(s => Math.max(s - 1, 1));
    }
  };

  const handleChecklistChange = (itemId: string, patch: Partial<ReportChecklistItem>) => {
    setChecklistAnswers(prev => ({ ...prev, [itemId]: patch }));
  };

  const handleSubmit = async () => {
    if (!technicianSignature) {
      toast.error('Assinatura do técnico obrigatória.', {
        description: 'Assine no campo "Assinatura do Técnico" antes de enviar.',
      });
      return;
    }

    const valid = await form.trigger();
    if (!valid) return;

    setIsSubmitting(true);
    try {
      const values = form.getValues();
      const reportId = await submitReport({
        formValues: values,
        technicianId: user?.id ?? '',
        teamId: tenant?.id ?? '',
        localDraftId: draft.localDraftId,
        checklistAnswers,
        attachments,
        technicianSignature,
        clientSignature,
        clientSignerName,
        clientLocationId: values.client_location_id || null,
      });

      await draft.discardDraft();
      toast.success('OS enviada com sucesso!', { description: `ID: ${reportId.slice(0, 8)}` });
      navigate('/reports');
    } catch (err) {
      console.error('[NewReport] submit error', err);
      // Fallback: salva tudo offline (formulário + fotos + assinatura + checklist)
      try {
        await draft.submitDraft(
          {
            technician_id: user?.id ?? '',
            status: 'pending_review',
            ...form.getValues(),
          } as CreateServiceReportDTO,
          checklistAnswers,
          attachments,
          technicianSignature,
          clientSignature,
          clientSignerName,
        );
        toast.warning('Sem conexão — OS salva localmente.', {
          description: 'Fotos, checklist e assinatura incluídos. Será sincronizado ao reconectar.',
        });
        navigate('/reports');
      } catch {
        toast.error('Erro ao salvar a OS.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isLastStep = currentStep === TOTAL_STEPS;

  return (
    <div className="flex flex-col gap-4 w-full max-w-2xl mx-auto pb-10 animate-in fade-in duration-300">

      {/* Cabeçalho */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="h-10 w-10 shrink-0 rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground">Nova OS</h1>
          <p className="text-xs text-muted-foreground">
            Passo {currentStep} de {TOTAL_STEPS} — {STEP_LABELS[currentStep - 1]}
          </p>
        </div>
        <SyncStatusIndicator status={draft.syncStatus} />
      </div>

      {/* Stepper unificado — progresso integrado nos conectores entre círculos */}
      <div className="flex items-center w-full" data-onboarding="wizard-step-indicator">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1;
          const isDone = step < currentStep;
          const isCurrent = step === currentStep;
          const isLast = i === STEP_LABELS.length - 1;
          return (
            <div key={step} className={`flex items-center ${isLast ? 'shrink-0' : 'flex-1'}`}>
              <div
                title={label}
                className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-colors ${
                  isDone    ? 'bg-primary text-primary-foreground' :
                  isCurrent ? 'bg-primary/15 text-primary ring-2 ring-primary' :
                              'bg-muted text-muted-foreground'
                }`}
              >
                {isDone ? '✓' : step}
              </div>
              {!isLast && (
                <div className="flex-1 h-0.5 mx-0.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: isDone ? '100%' : '0%' }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Conteúdo do step atual */}
      <Suspense fallback={<Skeleton className="h-64 w-full rounded-xl" />}>
        <div className="space-y-4">
          {currentStep === 1 && <Step1Identification form={form} />}
          {currentStep === 2 && <Step2AssetContext form={form} />}
          {currentStep === 3 && (
            <Step3Checklist
              serviceType={serviceType ?? null}
              template={template}
              templateLoading={templateLoading}
              answers={checklistAnswers}
              onAnswerChange={handleChecklistChange}
            />
          )}
          {currentStep === 4 && (
            <Step4Diagnosis
              form={form}
              assetDescription={assetId}
            />
          )}
          {currentStep === 5 && <Step5Execution form={form} />}
          {currentStep === 6 && (
            <Step6Evidence
              attachments={attachments}
              onChange={setAttachments}
            />
          )}
          {currentStep === 7 && (
            <Step7SignatureSend
              form={form}
              technicianSignature={technicianSignature}
              clientSignature={clientSignature}
              clientSignerName={clientSignerName}
              onTechnicianSignature={setTechnicianSignature}
              onClientSignature={setClientSignature}
              onClientSignerName={setClientSignerName}
            />
          )}
        </div>
      </Suspense>

      {/* Navegação */}
      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleBack}
          className="flex-1 h-13 rounded-xl border-border text-foreground font-semibold"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          {currentStep === 1 ? 'Cancelar' : 'Voltar'}
        </Button>

        {isLastStep ? (
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            data-onboarding="wizard-step7-enviar"
            className="flex-1 h-13 rounded-xl font-semibold"
          >
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Enviando...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Enviar OS</>
            )}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={handleNext}
            className="flex-1 h-13 rounded-xl font-semibold"
          >
            Próximo <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
