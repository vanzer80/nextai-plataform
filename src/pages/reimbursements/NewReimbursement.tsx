import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, ArrowLeft, Receipt, Upload, Sparkles } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { extractReceiptFromImages, extractReceiptFromVoice } from '@/src/services/aiService';
import type { CapturedImage } from '@/src/components/capture/CaptureStep';
import CaptureStep from '@/src/components/capture/CaptureStep';
import { withTimeout } from '@/src/lib/withTimeout';
import { useClients } from '@/src/hooks/useClients';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const reimbursementSchema = z.object({
  category: z.string().min(1, "Obrigatório selecionar a categoria"),
  amount: z.string().min(1, "Valor é obrigatório"),
  expense_date: z.string().optional(),
  favorecido: z.string().optional(),
  pix: z.string().optional(),
  description: z.string().optional(),
  maintenance_type: z.string().optional(),
  client_id: z.string().optional(),
  branch: z.string().optional(),
  budget: z.string().optional(),
}).superRefine((data, ctx) => {
  if (data.category === "Outros" && (!data.description || data.description.trim() === "")) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Descrição é obrigatória para a categoria Outros",
      path: ["description"]
    });
  }
});

type FormValues = z.infer<typeof reimbursementSchema>;

export default function NewReimbursement() {
  const { id } = useParams<{ id: string }>();
  const isEditMode = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState<'capture' | 'form'>(isEditMode ? 'form' : 'capture');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(isEditMode);
  const [file, setFile] = useState<File | null>(null);
  const [existingReceiptUrl, setExistingReceiptUrl] = useState<string | null>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [revisaoReason, setRevisaoReason] = useState('');
  const [aiFilledFields, setAiFilledFields] = useState<Set<string>>(new Set());

  const clients = useClients();

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(reimbursementSchema),
    defaultValues: {
      category: "", amount: "", expense_date: "", favorecido: "",
      pix: "", description: "", maintenance_type: "", client_id: "", branch: "", budget: "",
    },
  });

  React.useEffect(() => {
    if (!isEditMode || !id) return;
    const fetchReimbursement = async () => {
      setIsLoadingForm(true);
      try {
        const { data, error } = await supabase
          .from('reimbursements')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;

        const knownCategories = ['Alimentação', 'Transporte', 'Hospedagem'];
        const isCustomCategory = !knownCategories.includes(data.category);
        if (isCustomCategory && data.category) setCustomCategory(data.category);

        reset({
          category: isCustomCategory ? 'Outros' : data.category,
          amount: data.amount ? String(data.amount) : '',
          expense_date: data.expense_date || '',
          favorecido: data.favorecido || '',
          pix: data.pix_key || '',
          description: data.description || '',
          maintenance_type: data.maintenance_type || '',
          client_id: data.client_id || '',
          branch: data.branch || '',
          budget: data.budget || '',
        });
        setRevisaoReason(data.revision_reason || '');
        setExistingReceiptUrl(data.receipt_url);
      } catch (err) {
        console.error(err);
        toast.error('Erro ao buscar o reembolso para edição');
      } finally {
        setIsLoadingForm(false);
      }
    };
    fetchReimbursement();
  }, [id, isEditMode, reset]);

  const selectedCategory = watch("category");
  const selectedClient = watch("client_id");
  const selectedMaintenanceType = watch("maintenance_type");

  // ── AI extraction helpers ──────────────────────────────────────────────────

  const applyReceiptExtraction = (data: Awaited<ReturnType<typeof extractReceiptFromImages>>) => {
    const filled = new Set<string>();
    const knownCategories = ['Alimentação', 'Transporte', 'Hospedagem'];
    let cat: string = data.expenseType;
    if (cat === "Combustível") cat = "Transporte";

    if (!knownCategories.includes(cat)) {
      setValue("category", "Outros", { shouldValidate: true });
      setCustomCategory(cat === "Outros" ? "" : cat);
    } else {
      setValue("category", cat, { shouldValidate: true });
      setCustomCategory('');
    }
    filled.add('category');

    if (data.amount) {
      setValue("amount", data.amount.toFixed(2), { shouldValidate: true });
      filled.add('amount');
    }
    if (data.expense_date) {
      setValue("expense_date", data.expense_date, { shouldValidate: true });
      filled.add('expense_date');
    }
    if (data.favorecido) {
      setValue("favorecido", data.favorecido);
      filled.add('favorecido');
    }
    if (data.description) {
      setValue("description", data.description);
      filled.add('description');
    }

    setAiFilledFields(filled);
  };

  const handleAnalyzeImages = async (images: CapturedImage[]) => {
    setIsExtracting(true);
    const toastId = toast.loading(`Analisando ${images.length > 1 ? images.length + ' imagens' : 'imagem'} com IA...`);
    try {
      console.log('[IA] Iniciando extração. Imagens:', images.map(i => ({ mimeType: i.mimeType, base64Length: i.base64.length })));
      const data = await extractReceiptFromImages(images);
      console.log('[IA] Resultado:', data);
      applyReceiptExtraction(data);
      setFile(images[0].file);
      toast.success("Dados extraídos! Revise os campos destacados.", { id: toastId });
      setStep('form');
    } catch (err: any) {
      console.error('[IA] Erro na extração:', err);
      toast.error("Erro na extração com IA", {
        id: toastId,
        description: err?.message || 'Erro desconhecido — veja o console (F12)',
        duration: 10000,
      });
      setFile(images[0].file);
      setStep('form');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleAnalyzeVoice = async (transcript: string) => {
    setIsExtracting(true);
    const toastId = toast.loading("Interpretando descrição com IA...");
    try {
      const data = await extractReceiptFromVoice(transcript);
      applyReceiptExtraction(data);
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

  // ── Form submit ────────────────────────────────────────────────────────────

  const onSubmit = async (values: FormValues) => {
    if (!user) { toast.error('Usuário não autenticado.'); return; }
    if (values.category === 'Outros' && !customCategory.trim()) {
      toast.error('Informe o tipo de despesa no campo "Qual despesa?"');
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading(isEditMode ? "Atualizando dados..." : "Iniciando envio...");
    let receiptUrl = existingReceiptUrl;

    try {
      if (file) {
        toast.loading("Enviando comprovante...", { id: toastId });
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2, 15)}_${Date.now()}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;

        const { error: uploadError } = await withTimeout(
          supabase.storage.from('reimbursements_media').upload(filePath, file),
          30000
        ) as { data: unknown; error: { message: string } | null };
        if (uploadError) throw new Error('Falha no upload: ' + uploadError.message);

        const { data: publicData } = supabase.storage.from('reimbursements_media').getPublicUrl(filePath);
        receiptUrl = publicData.publicUrl;
      }

      toast.loading("Salvando dados...", { id: toastId });
      const amountParsed = parseFloat(values.amount.replace(',', '.'));
      const finalCategory = values.category === 'Outros' ? customCategory.trim() : values.category;

      const payload = {
        user_id: user.id,
        category: finalCategory,
        amount: amountParsed,
        expense_date: values.expense_date || null,
        receipt_url: receiptUrl,
        status: 'Pendente',
        description: values.description?.trim() || null,
        favorecido: values.favorecido?.trim() || null,
        pix_key: values.pix?.trim() || null,
        maintenance_type: values.maintenance_type || null,
        client_id: (values.client_id && values.client_id !== "") ? values.client_id : null,
        branch: values.branch || null,
        budget: values.budget || null,
        rejection_reason: null,
        revision_reason: null,
      };

      if (isEditMode) {
        const { error: dbError } = await withTimeout(
          supabase.from('reimbursements').update(payload).eq('id', id),
          30000
        ) as { data: unknown; error: { message: string } | null };
        if (dbError) throw new Error(dbError.message);
      } else {
        const { error: dbError } = await withTimeout(
          supabase.from('reimbursements').insert(payload),
          30000
        ) as { data: unknown; error: { message: string } | null };
        if (dbError) throw new Error(dbError.message);
      }

      toast.success(isEditMode ? "Reembolso atualizado!" : "Reembolso solicitado!", {
        id: toastId,
        description: isEditMode ? "Informações salvas com sucesso." : "Comprovante enviado para aprovação.",
      });
      navigate('/reimbursements');
    } catch (err: any) {
      const errMsg = err.message === 'TIMEOUT_EXCEEDED'
        ? "A operação demorou demais (verifique sua conexão)."
        : err.message;
      toast.error("Erro ao enviar", { id: toastId, description: errMsg, duration: 8000 });
      console.error("ERRO:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (isLoadingForm) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (step === 'capture') {
    return (
      <CaptureStep
        mode="reimbursement"
        isProcessing={isExtracting}
        onAnalyzeImages={handleAnalyzeImages}
        onAnalyzeVoice={handleAnalyzeVoice}
        onSkip={() => setStep('form')}
      />
    );
  }

  // Retorna classe de destaque para campos preenchidos pela IA
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
          onClick={() => isEditMode ? navigate('/reimbursements') : setStep('capture')}
          className="h-10 w-10 shrink-0 rounded-full hover:bg-muted"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {isEditMode ? 'Editar Reembolso' : 'Novo Reembolso'}
          </h1>
          <p className="text-xs text-muted-foreground">
            {isEditMode ? 'Atualize as informações do seu comprovante' : 'Registre sua despesa de campo'}
          </p>
        </div>
      </div>

      {/* Banner de campos preenchidos pela IA */}
      {aiCount > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
          <p className="text-sm text-blue-800">
            <span className="font-semibold">{aiCount} {aiCount === 1 ? 'campo preenchido' : 'campos preenchidos'} pela IA</span>
            {' '}— revise os campos destacados em azul e complete os demais.
          </p>
        </div>
      )}

      {/* Alerta de Revisão */}
      {isEditMode && revisaoReason && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-start gap-3">
          <span className="text-2xl mt-0.5">🔄</span>
          <div>
            <p className="font-bold text-orange-800 text-sm">Devolvido para Ajuste pelo Gestor</p>
            <p className="text-orange-700 text-sm mt-1">{revisaoReason}</p>
            <p className="text-orange-500 text-xs mt-2 font-medium">Faça as correções e clique em "Solicitar" para reenviar.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

        {/* Card: Detalhes da Despesa */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/40 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Detalhes da Despesa
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Categoria *
                {aiFilledFields.has('category') && <span className="text-xs text-primary font-normal flex items-center gap-1"><Sparkles className="h-3 w-3" /> IA</span>}
              </Label>
              <Select
                onValueChange={(val) => {
                  setValue("category", val, { shouldValidate: true });
                  if (val !== 'Outros') setCustomCategory('');
                  clearAiField('category');
                }}
                value={selectedCategory}
              >
                <SelectTrigger className={`h-14 text-base rounded-xl ${aiClass('category')}`}>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alimentação" className="py-3 text-base">Alimentação</SelectItem>
                  <SelectItem value="Transporte" className="py-3 text-base">Transporte (Combustível, App, Ônibus)</SelectItem>
                  <SelectItem value="Hospedagem" className="py-3 text-base">Hospedagem</SelectItem>
                  <SelectItem value="Outros" className="py-3 text-base">Outros</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && <p className="text-sm text-rose-600">{errors.category.message}</p>}
            </div>

            {selectedCategory === 'Outros' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Qual despesa? *</Label>
                <Input
                  type="text"
                  placeholder="Ex: Estacionamento, Material de limpeza, Ferramenta..."
                  className="h-14 text-base rounded-xl bg-background border-input focus-visible:ring-ring"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                />
                {!customCategory.trim() && <p className="text-xs text-amber-600 font-medium">Descreva o tipo de despesa.</p>}
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Valor (R$) *
                {aiFilledFields.has('amount') && <span className="text-xs text-primary font-normal flex items-center gap-1"><Sparkles className="h-3 w-3" /> IA</span>}
              </Label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium text-lg">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0,00"
                  className={`h-14 pl-12 text-lg font-semibold rounded-xl ${aiClass('amount')}`}
                  {...register("amount", { onChange: () => clearAiField('amount') })}
                />
              </div>
              {errors.amount && <p className="text-sm text-rose-600">{errors.amount.message}</p>}
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                Data da Despesa
                {aiFilledFields.has('expense_date') && <span className="text-xs text-primary font-normal flex items-center gap-1"><Sparkles className="h-3 w-3" /> IA</span>}
              </Label>
              <Input
                type="date"
                className={`h-14 text-base rounded-xl ${aiClass('expense_date')}`}
                {...register("expense_date", { onChange: () => clearAiField('expense_date') })}
              />
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Favorecido / Estabelecimento
                  {aiFilledFields.has('favorecido') && <span className="text-xs text-primary font-normal flex items-center gap-1"><Sparkles className="h-3 w-3" /> IA</span>}
                </Label>
                <Input
                  type="text"
                  placeholder="Ex: Posto Ipiranga, Restaurante X..."
                  className={`h-14 text-base rounded-xl ${aiClass('favorecido')}`}
                  {...register("favorecido", { onChange: () => clearAiField('favorecido') })}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground">Chave PIX (se houver na nota)</Label>
                <Input
                  type="text"
                  placeholder="Ex: CNPJ, Email, Telefone..."
                  className="h-14 text-base rounded-xl bg-background border-input focus-visible:ring-ring"
                  {...register("pix")}
                />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  Descrição {selectedCategory === "Outros" ? "*" : ""}
                  {aiFilledFields.has('description') && <span className="text-xs text-primary font-normal flex items-center gap-1"><Sparkles className="h-3 w-3" /> IA</span>}
                </Label>
                <Input
                  type="text"
                  placeholder="Descreva a despesa..."
                  className={`h-14 text-base rounded-xl ${aiClass('description')}`}
                  {...register("description", { onChange: () => clearAiField('description') })}
                />
                {errors.description && <p className="text-sm text-rose-600">{errors.description.message}</p>}
              </div>
            </div>

          </CardContent>
        </Card>

        {/* Card: Vínculo de Serviço */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/40 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4 text-primary" />
              Vínculo de Serviço
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-5">

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Preventiva ou Corretiva</Label>
              <Select onValueChange={(val) => setValue("maintenance_type", val === "none" ? "" : val)} value={selectedMaintenanceType || "none"}>
                <SelectTrigger className="h-14 text-base rounded-xl bg-background border-input focus:ring-ring">
                  <SelectValue placeholder="Selecione o tipo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="py-3 text-base text-muted-foreground italic">-- Não se aplica --</SelectItem>
                  <SelectItem value="Preventiva" className="py-3 text-base">Preventiva</SelectItem>
                  <SelectItem value="Corretiva" className="py-3 text-base">Corretiva</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Cliente</Label>
              <Select onValueChange={(val) => setValue("client_id", val === "none" ? "" : val)} value={selectedClient || "none"}>
                <SelectTrigger className="h-14 text-base rounded-xl bg-background border-input focus:ring-ring">
                  <SelectValue placeholder="Selecione o cliente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none" className="py-3 text-base text-muted-foreground italic">-- Nenhum cliente / Avulso --</SelectItem>
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id} className="py-3 text-base">
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Filial</Label>
              <Input
                type="text"
                placeholder="Ex: SP, RJ, Loja 10..."
                className="h-14 text-base rounded-xl bg-background border-input focus-visible:ring-ring"
                {...register("branch")}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-semibold text-foreground">Orçamento</Label>
              <Input
                type="text"
                placeholder="Ex: ORC-2026-04"
                className="h-14 text-base rounded-xl bg-background border-input focus-visible:ring-ring"
                {...register("budget")}
              />
            </div>

          </CardContent>
        </Card>

        {/* Card: Comprovante */}
        <Card className="shadow-sm border-border">
          <CardHeader className="pb-3 border-b border-border bg-muted/40 rounded-t-xl">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4 text-primary" />
              Comprovante
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="border-2 border-dashed border-input rounded-xl p-6 text-center hover:bg-muted/50 transition-colors relative bg-background">
              <input
                type="file"
                accept="image/*,.pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
              />
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <div className="h-12 w-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 mb-2">
                  <Receipt className="h-6 w-6" />
                </div>
                {file ? (
                  <p className="text-sm font-medium text-blue-600 break-all">{file.name}</p>
                ) : existingReceiptUrl ? (
                  <p className="text-sm font-medium text-blue-600">Comprovante anexado previamente (Clique para trocar)</p>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Adicionar ou trocar comprovante</p>
                    <p className="text-xs text-muted-foreground">JPG, PNG ou PDF (Max. 5MB)</p>
                  </>
                )}
              </div>
            </div>
            {!file && !existingReceiptUrl && (
              <p className="text-xs text-center text-amber-600 font-medium">Anexo do cupom é recomendável para aprovação.</p>
            )}
          </CardContent>
        </Card>

        <div className="pt-2 pb-8 flex gap-3">
          <Button
            type="button" variant="outline"
            className="flex-1 h-14 rounded-xl text-base font-semibold border-border text-foreground shadow-sm"
            onClick={() => isEditMode ? navigate('/reimbursements') : setStep('capture')}
            disabled={isSubmitting}
          >
            {isEditMode ? 'Cancelar' : 'Voltar'}
          </Button>
          <Button
            type="submit"
            className="flex-1 h-14 rounded-xl text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" /> {isEditMode ? 'Atualizando...' : 'Enviando...'}</>
              : isEditMode ? 'Salvar Alterações' : 'Solicitar'
            }
          </Button>
        </div>

      </form>
    </div>
  );
}
