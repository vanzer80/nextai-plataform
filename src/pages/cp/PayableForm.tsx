import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Save, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button }   from '@/src/components/ui/button';
import { Input }    from '@/src/components/ui/input';
import { Textarea } from '@/src/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/src/components/ui/select';

import { createPayable, updatePayable, getPayable, submitPayable } from '@/src/services/payableService';
import { getSuppliers } from '@/src/services/supplierService';
import type { Supplier } from '@/src/types/supplier';

// ── Schema ────────────────────────────────────────────────────────────────────

const schema = z.object({
  tipo: z.enum(['fornecedor','reembolso','material','servico','imposto','aluguel','salario','folha_pagamento','outro']),
  categoria: z.string().optional(),
  descricao: z.string().min(3, 'Descrição obrigatória (mínimo 3 caracteres)'),
  observacoes: z.string().optional(),
  valor_total: z.preprocess(v => (v === '' || v == null ? undefined : Number(v)), z.number().min(0.01, 'Valor obrigatório')),
  numero_parcelas: z.preprocess(v => (v === '' || v == null ? 1 : Number(v)), z.number().min(1).max(60)).default(1),
  data_emissao:    z.string().optional(),
  data_vencimento: z.string().min(1, 'Data de vencimento obrigatória'),
  supplier_id: z.string().optional().nullable(),
  nota_fiscal: z.string().optional(),
  nf_numero:   z.string().optional(),
  forma_pagamento: z.enum(['pix','boleto','ted','doc','cheque','dinheiro','cartao','outro']).optional(),
  pix_key:         z.string().optional(),
  banco_destino:   z.string().optional(),
  agencia_destino: z.string().optional(),
  conta_destino:   z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

const TIPO_LABELS: [string, string][] = [
  ['fornecedor','Fornecedor'], ['reembolso','Reembolso'], ['material','Material'],
  ['servico','Serviço'], ['imposto','Imposto'], ['aluguel','Aluguel'],
  ['salario','Salário'], ['folha_pagamento','Folha de Pagamento'], ['outro','Outro'],
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function PayableForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit   = Boolean(id);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [saving, setSaving]       = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { register, control, handleSubmit, watch, reset, formState: { errors } } =
    useForm<FormValues>({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resolver: zodResolver(schema) as any,
      defaultValues: {
        tipo: 'fornecedor',
        numero_parcelas: 1,
        data_emissao: new Date().toISOString().split('T')[0],
      },
    });

  useEffect(() => {
    getSuppliers().then(setSuppliers).catch(console.error);
    if (isEdit && id) {
      getPayable(id).then(p => {
        reset({
          ...p,
          valor_total: p.valor_total,
          numero_parcelas: p.numero_parcelas,
        });
      }).catch(err => {
        toast.error('Erro ao carregar conta');
        console.error(err);
      });
    }
  }, [id, isEdit, reset]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function onSave(values: FormValues) {
    try {
      setSaving(true);
      if (isEdit && id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updatePayable(id, values as any);
        toast.success('Conta atualizada');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = await createPayable(values as any);
        toast.success('Conta criada');
        navigate(`/cp/${p.id}`);
        return;
      }
      navigate(`/cp/${id}`);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function onSaveAndSubmit(values: FormValues) {
    try {
      setSubmitting(true);
      let payableId = id;
      if (isEdit && id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updatePayable(id, values as any);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = await createPayable(values as any);
        payableId = p.id;
      }
      if (payableId) {
        await submitPayable(payableId);
        toast.success('Conta enviada para aprovação');
        navigate(`/cp/${payableId}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar');
    } finally {
      setSubmitting(false);
    }
  }

  const watchedParcelas = watch('numero_parcelas') ?? 1;
  const watchedValor    = watch('valor_total') ?? 0;
  const watchedVenc     = watch('data_vencimento');

  function calcParcelas() {
    if (watchedParcelas <= 1 || !watchedValor || !watchedVenc) return null;
    const valorParcela = watchedValor / watchedParcelas;
    const [y, m, d] = watchedVenc.split('-').map(Number);
    return Array.from({ length: watchedParcelas }, (_, i) => {
      const dt = new Date(y, m - 1 + i, d);
      return {
        numero: i + 1,
        valor: i === watchedParcelas - 1
          ? watchedValor - Math.round(valorParcela * 100) / 100 * (watchedParcelas - 1)
          : Math.round(valorParcela * 100) / 100,
        data: dt.toLocaleDateString('pt-BR'),
      };
    });
  }

  const parcelas = calcParcelas();
  const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* ── Header ── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => navigate('/cp')}>
          <ArrowLeft className="h-4 w-4" /> Contas
        </Button>
        <h1 className="text-xl font-bold text-foreground">
          {isEdit ? 'Editar Conta' : 'Nova Conta a Pagar'}
        </h1>
      </div>

      <form className="space-y-6">
        {/* ── Classificação ── */}
        <section data-onboarding="cp-form-classificacao" className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground border-b border-border pb-2">Classificação</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Tipo *</label>
              <Controller
                name="tipo"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TIPO_LABELS.map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.tipo && <p className="text-xs text-rose-500 mt-1">{errors.tipo.message}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Categoria</label>
              <Input {...register('categoria')} placeholder="Ex: Infraestrutura, Marketing..." />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Descrição *</label>
            <Input {...register('descricao')} placeholder="Descreva o pagamento..." />
            {errors.descricao && <p className="text-xs text-rose-500 mt-1">{errors.descricao.message}</p>}
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Observações</label>
            <Textarea {...register('observacoes')} placeholder="Informações adicionais..." rows={2} />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">Fornecedor</label>
            <Controller
              name="supplier_id"
              control={control}
              render={({ field }) => (
                <Select onValueChange={v => field.onChange(v === '__none__' ? null : v)} value={field.value ?? '__none__'}>
                  <SelectTrigger wrapText>
                    <SelectValue placeholder="Selecione (opcional)...">
                      {field.value === '__none__' || !field.value ? '— Nenhum —' : suppliers.find(s => s.id === field.value)?.name}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem wrapText value="__none__">— Nenhum —</SelectItem>
                    {suppliers.map(s => (
                      <SelectItem wrapText key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </section>

        {/* ── Valor e Datas ── */}
        <section data-onboarding="cp-form-valores" className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground border-b border-border pb-2">Valor e Datas</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Valor Total *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">R$</span>
                <Input className="pl-8" type="number" step="0.01" min="0.01" {...register('valor_total')} />
              </div>
              {errors.valor_total && <p className="text-xs text-rose-500 mt-1">{String(errors.valor_total.message)}</p>}
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nº de Parcelas</label>
              <Input type="number" min={1} max={60} {...register('numero_parcelas')} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Data Emissão</label>
              <Input type="date" {...register('data_emissao')} />
            </div>
            <div className="sm:col-span-1">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">
                {watchedParcelas > 1 ? '1ª Parcela' : 'Vencimento'} *
              </label>
              <Input type="date" {...register('data_vencimento')} />
              {errors.data_vencimento && <p className="text-xs text-rose-500 mt-1">{errors.data_vencimento.message}</p>}
            </div>
          </div>

          {/* ── Parcelas preview ── */}
          {parcelas && (
            <div className="bg-muted/40 rounded-lg p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Cronograma de parcelas:</p>
              <div className="flex flex-wrap gap-2">
                {parcelas.map(parc => (
                  <span key={parc.numero} className="text-xs bg-card border border-border rounded-lg px-2 py-1">
                    <span className="text-muted-foreground">#{parc.numero}</span>{' '}
                    <span className="font-medium">{BRL.format(parc.valor)}</span>{' '}
                    <span className="text-muted-foreground">{parc.data}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── NF e Pagamento ── */}
        <section className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground border-b border-border pb-2">Nota Fiscal e Pagamento</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nota Fiscal (URL)</label>
              <Input {...register('nota_fiscal')} placeholder="Link do documento..." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Número NF</label>
              <Input {...register('nf_numero')} placeholder="000000" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Forma de Pagamento</label>
              <Controller
                name="forma_pagamento"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ''}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {(['pix','boleto','ted','doc','cheque','dinheiro','cartao','outro'] as const).map(f => (
                        <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Chave PIX / Banco</label>
              <Input {...register('pix_key')} placeholder="Chave PIX ou banco..." />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Agência</label>
              <Input {...register('agencia_destino')} placeholder="0000" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Conta</label>
              <Input {...register('conta_destino')} placeholder="00000-0" />
            </div>
          </div>
        </section>

        {/* ── Actions ── */}
        <div data-onboarding="cp-form-acoes" className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/cp')}>
            Cancelar
          </Button>
          <Button type="button" variant="outline" onClick={handleSubmit(onSave)} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar Rascunho
          </Button>
          <Button type="button" onClick={handleSubmit(onSaveAndSubmit)} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
            Enviar para Aprovação
          </Button>
        </div>
      </form>
    </div>
  );
}
