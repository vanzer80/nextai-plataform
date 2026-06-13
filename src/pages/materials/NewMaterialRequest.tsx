import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { ArrowLeft, Package, MapPin, Wrench, Upload, Loader2, Sparkles } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { withTimeout } from '@/src/lib/withTimeout';
import { useClients } from '@/src/hooks/useClients';
import { extractMaterialFromImages, extractMaterialFromVoice } from '@/src/services/aiService';
import type { CapturedImage } from '@/src/components/capture/CaptureStep';
import CaptureStep from '@/src/components/capture/CaptureStep';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/src/components/ui/select';

const schema = z.object({
  cidade: z.string().min(2, 'Informe a cidade'),
  client_id: z.string().optional(),
  loja: z.string().optional(),
  maintenance_type: z.string().min(1, 'Selecione o tipo de manutenção'),
  prazo: z.string().min(1, 'Informe o prazo'),
  especificacao_tecnica: z.string().min(5, 'Detalhe a especificação técnica (mín. 5 caracteres)'),
  quantidade: z.string().min(1, 'Informe a quantidade'),
  link_referencia: z.string().optional(),
  obs: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function NewMaterialRequest() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const { user } = useAuth();
  const { tenant } = useTenant();

  const [step, setStep] = useState<'capture' | 'form'>(isEditMode ? 'form' : 'capture');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [foto, setFoto] = useState<File | null>(null);
  const [existingFotoUrl, setExistingFotoUrl] = useState<string | null>(null);
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

  const clients = useClients();

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      cidade: '', client_id: '', loja: '', maintenance_type: '',
      prazo: '', especificacao_tecnica: '', quantidade: '', link_referencia: '', obs: '',
    },
  });

  const selectedClient = watch('client_id');
  const selectedMaintenanceType = watch('maintenance_type');

  useEffect(() => {
    if (!isEditMode || !id) return;
    const loadRequest = async () => {
      try {
        const { data, error } = await supabase
          .from('material_requests')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        if (!data) throw new Error('Solicitação não encontrada.');

        setValue('cidade', data.cidade || '');
        setValue('client_id', data.client_id || '');
        setValue('loja', data.loja || '');
        setValue('maintenance_type', data.maintenance_type || '');
        setValue('prazo', data.prazo || '');
        setValue('especificacao_tecnica', data.especificacao_tecnica || data.item || '');
        setValue('quantidade', data.quantity || '');
        setValue('link_referencia', data.link_referencia || '');
        setValue('obs', data.obs || '');
        setExistingFotoUrl(data.foto_url || null);
      } catch (err: any) {
        toast.error('Erro ao carregar solicitação.', { description: err.message });
        navigate('/materials');
      } finally {
        setLoadingData(false);
      }
    };
    loadRequest();
  }, [id, isEditMode, navigate, setValue]);

  // ── AI extraction ──────────────────────────────────────────────────────────

  const applyMaterialExtraction = (data: Awaited<ReturnType<typeof extractMaterialFromImages>>) => {
    const filled = new Set<string>();

    // Montar especificação completa combinando base + campos técnicos identificados
    const partes = [data.marca, data.modelo, data.codigo_referencia, data.tensao, data.capacidade].filter(Boolean);
    const especificacaoCompleta = partes.length > 0
      ? `${data.especificacao_tecnica} — ${partes.join(' | ')}`
      : data.especificacao_tecnica;

    if (especificacaoCompleta) {
      setValue('especificacao_tecnica', especificacaoCompleta, { shouldValidate: true });
      filled.add('especificacao_tecnica');
    }
    if (data.quantidade) {
      setValue('quantidade', data.quantidade, { shouldValidate: true });
      filled.add('quantidade');
    }
    if (data.obs) {
      setValue('obs', data.obs);
      filled.add('obs');
    }
    setAiFilledFields(filled);
  };

  const handleAnalyzeImages = async (images: CapturedImage[]) => {
    setIsExtracting(true);
    const toastId = toast.loading(`Identificando material em ${images.length > 1 ? images.length + ' imagens' : '1 imagem'}...`);
    try {
      const data = await extractMaterialFromImages(images);
      applyMaterialExtraction(data);
      setFoto(images[0].file);
      toast.success("Material identificado! Revise os campos destacados.", { id: toastId });
      setStep('form');
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível identificar o material. Preencha manualmente.", { id: toastId });
      setFoto(images[0].file);
      setStep('form');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnalyzeVoice = async (transcript: string) => {
    setIsExtracting(true);
    const toastId = toast.loading("Interpretando descrição com IA...");
    try {
      const data = await extractMaterialFromVoice(transcript);
      applyMaterialExtraction(data);
      toast.success("Formulário preenchido a partir do que você descreveu!", { id: toastId });
      setStep('form');
    } catch (err) {
      console.error(err);
      toast.error("Não foi possível interpretar a descrição. Preencha manualmente.", { id: toastId });
      setStep('form');
    } finally {
      setIsExtracting(false);
    }
  };

  const clearAiField = (field: string) => {
    setAiFilledFields(prev => { const next = new Set(prev); next.delete(field); return next; });
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    setIsSubmitting(true);
    const toastId = toast.loading(isEditMode ? 'Salvando alterações...' : 'Enviando solicitação...');

    try {
      let foto_url: string | null = existingFotoUrl;

      if (foto) {
        toast.loading('Enviando foto...', { id: toastId });
        const ext = foto.name.split('.').pop();
        const path = `${tenant?.id ?? user.id}/materials/${user.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await withTimeout(
          supabase.storage.from('materials_media').upload(path, foto),
          30000
        ) as { data: unknown; error: { message: string } | null };
        if (uploadError) throw new Error('Erro no upload da foto: ' + uploadError.message);
        foto_url = path;
      }

      const payload = {
        item: values.especificacao_tecnica.substring(0, 100),
        quantity: values.quantidade,
        reason: values.obs || '',
        cidade: values.cidade,
        client_id: values.client_id || null,
        loja: values.loja || null,
        maintenance_type: values.maintenance_type,
        prazo: values.prazo,
        especificacao_tecnica: values.especificacao_tecnica,
        foto_url,
        link_referencia: values.link_referencia || null,
        obs: values.obs || null,
      };

      if (isEditMode) {
        toast.loading('Salvando alterações...', { id: toastId });
        const { error } = await withTimeout(
          supabase.from('material_requests').update(payload).eq('id', id),
          30000
        ) as { data: unknown; error: { message: string } | null };
        if (error) throw new Error(error.message);

        const techName = user.full_name || user.email?.split('@')[0] || 'Técnico';
        const itemShort = values.especificacao_tecnica.substring(0, 60);
        await supabase.rpc('notify_compradores', {
          p_title: 'Solicitação editada',
          p_message: `${techName} atualizou a solicitação: "${itemShort}".`,
        });
        toast.success('Solicitação atualizada!', { id: toastId });
      } else {
        toast.loading('Salvando solicitação...', { id: toastId });
        const { error } = await withTimeout(
          supabase.from('material_requests').insert({
            ...payload,
            tech_id: user.id,
            urgency: 'Média',
            status: 'Pendente',
          }),
          30000
        ) as { data: unknown; error: { message: string } | null };
        if (error) throw new Error(error.message);

        const techName = user.full_name || user.email?.split('@')[0] || 'Técnico';
        const itemShort = values.especificacao_tecnica.substring(0, 60);
        const localizacao = [values.cidade, values.loja].filter(Boolean).join(' / ');
        await supabase.rpc('notify_compradores', {
          p_title: 'Nova solicitação de compra',
          p_message: `${techName} solicitou: "${itemShort}"${localizacao ? ` — ${localizacao}` : ''}.`,
        });
        toast.success('Solicitação enviada com sucesso!', { id: toastId });
      }

      navigate('/materials');
    } catch (err: any) {
      const msg = err.message === 'TIMEOUT_EXCEEDED'
        ? 'A operação demorou demais. Verifique sua conexão.'
        : err.message;
      toast.error('Erro ao salvar', { id: toastId, description: msg, duration: 8000 });
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingData) {
    return (
      <div className="flex justify-center items-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (step === 'capture') {
    return (
      <CaptureStep
        mode="material"
        isProcessing={isExtracting}
        onAnalyzeImages={handleAnalyzeImages}
        onAnalyzeVoice={handleAnalyzeVoice}
        onSkip={() => setStep('form')}
      />
    );
  }

  const aiClass = (field: string) =>
    aiFilledFields.has(field)
      ? 'bg-blue-50 border-blue-400 focus-visible:ring-ring'
      : 'bg-background border-input focus-visible:ring-ring';

  const aiCount = aiFilledFields.size;

  return (
    <div className="flex flex-col gap-4 h-full w-full max-w-2xl mx-auto pb-10">
      <div className="flex items-center gap-3 mb-2">
        <Button
          variant="ghost" size="icon"
          onClick={() => isEditMode ? navigate('/materials') : setStep('capture')}
          className="h-10 w-10 shrink-0 rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {isEditMode ? 'Editar Solicitação' : 'Nova Solicitação de Compra'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEditMode ? 'Atualize os dados da solicitação' : 'Preencha os dados do material necessário'}
          </p>
        </div>
      </div>

      {/* Banner campos IA */}
      {aiCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{aiCount} {aiCount === 1 ? 'campo preenchido' : 'campos preenchidos'} pela IA</span>
            {' '}— revise os campos destacados em azul e complete os demais.
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Localização */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/40 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              Localização
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Cidade *</Label>
              <Input placeholder="Ex: São Paulo" className="h-12 rounded-xl bg-background border-input focus-visible:ring-ring" {...register('cidade')} />
              {errors.cidade && <p className="text-sm text-rose-600">{errors.cidade.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Cliente</Label>
              <Select onValueChange={(v) => setValue('client_id', v === 'none' ? '' : v)} value={selectedClient || 'none'}>
                <SelectTrigger className="h-12 text-base rounded-xl bg-background border-input focus:ring-ring">
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="py-3 text-muted-foreground italic">-- Nenhum / Avulso --</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id} className="py-3">{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Loja / Unidade</Label>
              <Input placeholder="Ex: Loja 05, Unidade Centro..." className="h-12 rounded-xl bg-background border-input focus-visible:ring-ring" {...register('loja')} />
            </div>
          </CardContent>
        </Card>

        {/* Serviço */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/40 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <Wrench className="h-4 w-4 text-primary" />
              Serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Tipo de Manutenção *</Label>
              <Select onValueChange={(v) => setValue('maintenance_type', v, { shouldValidate: true })} value={selectedMaintenanceType}>
                <SelectTrigger className="h-12 text-base rounded-xl bg-background border-input focus:ring-ring">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Preventiva" className="py-3">Manutenção Preventiva</SelectItem>
                  <SelectItem value="Corretiva" className="py-3">Manutenção Corretiva</SelectItem>
                </SelectContent>
              </Select>
              {errors.maintenance_type && <p className="text-sm text-rose-600">{errors.maintenance_type.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Prazo *</Label>
              <Input type="date" className="h-12 rounded-xl bg-background border-input focus-visible:ring-ring" {...register('prazo')} />
              {errors.prazo && <p className="text-sm text-rose-600">{errors.prazo.message}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Material */}
        <Card data-onboarding="mat-form-material" className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/40 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Material
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Especificação Técnica *
                {aiFilledFields.has('especificacao_tecnica') && (
                  <span className="text-xs text-primary font-normal flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> IA
                  </span>
                )}
              </Label>
              <Textarea
                placeholder="Descreva detalhadamente o material: modelo, marca, tensão, capacidade..."
                className={`min-h-[100px] rounded-xl resize-none ${aiClass('especificacao_tecnica')}`}
                {...register('especificacao_tecnica', { onChange: () => clearAiField('especificacao_tecnica') })}
              />
              {errors.especificacao_tecnica && <p className="text-sm text-rose-600">{errors.especificacao_tecnica.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Foto do Material</Label>
              <div className="border-2 border-dashed border-input rounded-xl p-5 text-center hover:bg-muted/50 transition-colors relative bg-background">
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  onChange={(e) => e.target.files?.[0] && setFoto(e.target.files[0])}
                />
                <div className="flex flex-col items-center gap-2 text-muted-foreground">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600">
                    <Upload className="h-5 w-5" />
                  </div>
                  {foto ? (
                    <p className="text-sm font-medium text-blue-600">{foto.name}</p>
                  ) : existingFotoUrl ? (
                    <><p className="text-sm font-medium text-emerald-600">Foto atual mantida</p><p className="text-xs text-muted-foreground">Clique para trocar</p></>
                  ) : (
                    <><p className="text-sm font-semibold">Clique para adicionar foto</p><p className="text-xs text-muted-foreground">JPG ou PNG</p></>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Quantidade *
                {aiFilledFields.has('quantidade') && (
                  <span className="text-xs text-primary font-normal flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> IA
                  </span>
                )}
              </Label>
              <Input
                placeholder="Ex: 2 unidades, 5 metros..."
                className={`h-12 rounded-xl ${aiClass('quantidade')}`}
                {...register('quantidade', { onChange: () => clearAiField('quantidade') })}
              />
              {errors.quantidade && <p className="text-sm text-rose-600">{errors.quantidade.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Link de Referência</Label>
              <Input placeholder="https://..." className="h-12 rounded-xl bg-background border-input focus-visible:ring-ring" {...register('link_referencia')} />
            </div>
          </CardContent>
        </Card>

        {/* Observações */}
        <Card className="shadow-sm border-border">
          <CardContent className="pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Observações
                {aiFilledFields.has('obs') && (
                  <span className="text-xs text-primary font-normal flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> IA
                  </span>
                )}
              </Label>
              <Textarea
                placeholder="Informações adicionais, contexto do problema..."
                className={`min-h-[80px] rounded-xl resize-none ${aiClass('obs')}`}
                {...register('obs', { onChange: () => clearAiField('obs') })}
              />
            </div>
          </CardContent>
        </Card>

        <div data-onboarding="mat-form-acoes" className="pt-2 pb-8 flex gap-3">
          <Button
            type="button" variant="outline"
            className="flex-1 h-14 rounded-xl text-base font-semibold border-border text-foreground"
            onClick={() => isEditMode ? navigate('/materials') : setStep('capture')}
            disabled={isSubmitting}
          >
            {isEditMode ? 'Cancelar' : 'Voltar'}
          </Button>
          <Button
            type="submit"
            className="flex-1 h-14 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {isEditMode ? 'Salvando...' : 'Enviando...'}</>
              : isEditMode ? 'Salvar Alterações' : 'Enviar Solicitação'
            }
          </Button>
        </div>
      </form>
    </div>
  );
}
