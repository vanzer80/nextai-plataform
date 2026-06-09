import { useState, useEffect, Fragment } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { useAuth } from '@/src/contexts/AuthContext';
import { useClients } from '@/src/hooks/useClients';
import { criarOrcamento, atualizarOrcamento, buscarOrcamento } from '@/src/services/orcamentoService';
import ClientLocationSelect from '@/src/components/ClientLocationSelect';
import { ItemRow } from './components/ItemRow';
import type { ClientLocation } from '@/src/types/client';

const itemSchema = z.object({
  descricao: z.string().min(1, 'Descrição obrigatória'),
  quantidade: z.number().positive('Deve ser maior que 0'),
  unidade: z.string(),
  valor_unitario: z.number().min(0, 'Valor não pode ser negativo'),
});

const orcamentoSchema = z.object({
  client_id: z.string().min(1, 'Selecione um cliente'),
  client_location_id: z.string().optional(),
  site_location: z.string().optional(),
  titulo: z.string().optional(),
  observacoes: z.string().optional(),
  validade: z.string().optional(),
  desconto_pct: z.number().min(0).max(100),
  itens: z.array(itemSchema).min(1, 'Adicione pelo menos um item'),
});

export type OrcamentoFormValues = z.infer<typeof orcamentoSchema>;

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const DEFAULT_ITEM = { descricao: '', quantidade: 1, unidade: 'un', valor_unitario: 0 };

export default function NovoOrcamento() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { user } = useAuth();
  const clients = useClients();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(isEdit);

  const {
    register,
    control,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors },
  } = useForm<OrcamentoFormValues>({
    resolver: zodResolver(orcamentoSchema),
    defaultValues: {
      client_id: '',
      client_location_id: undefined,
      site_location: '',
      titulo: '',
      observacoes: '',
      validade: '',
      desconto_pct: 0,
      itens: [DEFAULT_ITEM],
    },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' });

  // Carregar dados para edição
  useEffect(() => {
    if (!id) return;
    setIsLoadingForm(true);
    buscarOrcamento(id)
      .then(orc => {
        if (!orc) { navigate('/orcamentos'); return; }
        reset({
          client_id: orc.client_id,
          client_location_id: orc.client_location_id ?? undefined,
          site_location: orc.site_location ?? '',
          titulo: orc.titulo ?? '',
          observacoes: orc.observacoes ?? '',
          validade: orc.validade ?? '',
          desconto_pct: orc.desconto_pct,
          itens: orc.orcamento_itens.length > 0
            ? orc.orcamento_itens.map(i => ({
                descricao: i.descricao,
                quantidade: i.quantidade,
                unidade: i.unidade,
                valor_unitario: i.valor_unitario,
              }))
            : [DEFAULT_ITEM],
        });
      })
      .catch(() => toast.error('Erro ao carregar orçamento.'))
      .finally(() => setIsLoadingForm(false));
  }, [id]); // eslint-disable-line

  // Cálculo de totais em tempo real
  const itens = watch('itens') ?? [];
  const desconto_pct = Number(watch('desconto_pct')) || 0;
  const subtotal = itens.reduce((acc, i) => acc + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0);
  const desconto = subtotal * (desconto_pct / 100);
  const total = subtotal - desconto;

  const onSubmit = async (values: OrcamentoFormValues) => {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await atualizarOrcamento(id, {
          client_id: values.client_id,
          client_location_id: values.client_location_id || null,
          site_location: values.site_location || null,
          titulo: values.titulo,
          observacoes: values.observacoes,
          validade: values.validade || null,
          desconto_pct: values.desconto_pct,
          itens: values.itens,
        }, user.id);
        toast.success('Orçamento atualizado!');
        navigate(`/orcamentos/${id}`);
      } else {
        const novoId = await criarOrcamento({
          client_id: values.client_id,
          technician_id: user.id,
          client_location_id: values.client_location_id || null,
          site_location: values.site_location || null,
          titulo: values.titulo,
          observacoes: values.observacoes,
          validade: values.validade || null,
          desconto_pct: values.desconto_pct,
          itens: values.itens,
        });
        toast.success('Orçamento criado!');
        navigate(`/orcamentos/${novoId}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar orçamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoadingForm) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-8 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Link to="/orcamentos" className="text-slate-500 hover:text-slate-900 transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {isEdit ? 'Editar Orçamento' : 'Novo Orçamento'}
          </h1>
          <p className="text-sm text-slate-500">Preencha os dados e adicione os itens</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Dados Gerais */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dados Gerais</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label>Cliente *</Label>
              <Select
                value={watch('client_id')}
                onValueChange={v => {
                  setValue('client_id', v, { shouldValidate: true });
                  setValue('client_location_id', undefined);
                  setValue('site_location', '');
                }}
              >
                <SelectTrigger className={errors.client_id ? 'border-rose-400' : ''}>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.client_id && (
                <p className="text-[11px] text-rose-500">{errors.client_id.message}</p>
              )}
            </div>

            <ClientLocationSelect
              clientId={watch('client_id') || undefined}
              selectedLocationId={watch('client_location_id')}
              manualText={watch('site_location') ?? ''}
              onLocationSelect={(loc: ClientLocation | null) => {
                if (loc) {
                  setValue('client_location_id', loc.id);
                } else {
                  setValue('client_location_id', undefined);
                }
              }}
              onManualTextChange={(text: string) => {
                setValue('site_location', text);
                setValue('client_location_id', undefined);
              }}
              label="Filial / Unidade (opcional)"
            />

            <div className="flex flex-col gap-1.5">
              <Label>Título (opcional)</Label>
              <Input placeholder="Ex.: Manutenção preventiva anual" {...register('titulo')} />
            </div>
          </CardContent>
        </Card>

        {/* Itens */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Itens do Orçamento</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => append(DEFAULT_ITEM)}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {/* Header das colunas */}
            <div className="grid grid-cols-[1fr_80px_60px_110px_auto] gap-2 text-[11px] font-medium text-slate-500 px-0">
              <span>Descrição</span>
              <span>Qtd</span>
              <span>Un.</span>
              <span>Valor unit.</span>
              <span />
            </div>

            {fields.map((field, index) => (
              <Fragment key={field.id}>
                <ItemRow
                  index={index}
                  control={control}
                  register={register}
                  errors={errors}
                  watch={watch}
                  onRemove={() => remove(index)}
                  isOnly={fields.length === 1}
                />
              </Fragment>
            ))}

            {errors.itens && typeof errors.itens.message === 'string' && (
              <p className="text-[11px] text-rose-500">{errors.itens.message}</p>
            )}
          </CardContent>
        </Card>

        {/* Configurações */}
        <Card>
          <CardHeader><CardTitle className="text-base">Configurações</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <Label>Válido até</Label>
                <Input type="date" {...register('validade')} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  placeholder="0"
                  {...register('desconto_pct', { valueAsNumber: true })}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Observações</Label>
              <Textarea
                rows={3}
                placeholder="Condições de pagamento, prazo de entrega, etc."
                {...register('observacoes')}
              />
            </div>
          </CardContent>
        </Card>

        {/* Resumo de totais */}
        <Card className="bg-slate-50 border-slate-200">
          <CardContent className="pt-4 flex flex-col gap-1">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal</span>
              <span>{BRL.format(subtotal)}</span>
            </div>
            {desconto_pct > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Desconto ({desconto_pct}%)</span>
                <span>- {BRL.format(desconto)}</span>
              </div>
            )}
            <div className="flex justify-between font-bold text-base text-slate-900 pt-2 border-t border-slate-200 mt-1">
              <span>Total</span>
              <span className="text-blue-700">{BRL.format(total)}</span>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 justify-end">
          <Button type="button" variant="outline" onClick={() => navigate('/orcamentos')}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isSubmitting} className="gap-2">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Salvar alterações' : 'Criar orçamento'}
          </Button>
        </div>
      </form>
    </div>
  );
}
