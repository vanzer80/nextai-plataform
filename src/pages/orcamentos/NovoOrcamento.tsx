import { useState, useEffect, useRef, Fragment, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, Plus, Loader2,
  Link2, Search, CheckCircle2, X, Building2, MapPin, Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useClients } from '@/src/hooks/useClients';
import { criarOrcamento, atualizarOrcamento, buscarOrcamento } from '@/src/services/orcamentoService';
import { ItemRow } from './components/ItemRow';

// ── Types ─────────────────────────────────────────────────────

interface OSSearchResult {
  id: string;
  os_number: string | null;
  service_type: string | null;
  status: string;
  service_date: string | null;
  site_location: string | null;
  reported_problem: string | null;
  services_performed: string | null;
  final_diagnosis: string | null;
  technical_recommendation: string | null;
  parts_used: string | null;
  asset_name_manual: string | null;
  client_id: string | null;
  priority: string;
  clients: { name: string } | null;
  users: { full_name: string } | null;
}

interface OSPart {
  part_id: string | null;
  part_name_manual: string | null;
  qty_used: number;
  unit_cost_at_time: number | null;
  parts: { name: string; unit: string | null } | null;
}

// ── Constants ─────────────────────────────────────────────────

const OS_SELECT = `
  id, os_number, service_type, status, service_date,
  site_location, reported_problem, services_performed,
  final_diagnosis, technical_recommendation, parts_used,
  asset_name_manual, client_id, priority,
  clients(name), users:technician_id(full_name)
`;

const OS_STATUS_LABEL: Record<string, string> = {
  approved:       'Aprovada',
  returned:       'Devolvida',
  pending_review: 'Ag. Revisão',
};

const OS_STATUS_BG: Record<string, string> = {
  approved:       'bg-emerald-100 text-emerald-800',
  returned:       'bg-orange-100 text-orange-800',
  pending_review: 'bg-amber-100 text-amber-800',
};

function fmtOSDate(iso: string | null) {
  if (!iso) return null;
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ── Schema ────────────────────────────────────────────────────

const itemSchema = z.object({
  descricao:      z.string().min(1, 'Descrição obrigatória'),
  quantidade:     z.number().positive('Deve ser maior que 0'),
  unidade:        z.string(),
  valor_unitario: z.number().min(0, 'Valor não pode ser negativo'),
});

const orcamentoSchema = z.object({
  client_id:   z.string().min(1, 'Selecione um cliente'),
  titulo:      z.string().optional(),
  observacoes: z.string().optional(),
  validade:    z.string().optional(),
  desconto_pct: z.number().min(0).max(100),
  itens:       z.array(itemSchema).min(1, 'Adicione pelo menos um item'),
  report_id:   z.string().uuid().optional(),
});

export type OrcamentoFormValues = z.infer<typeof orcamentoSchema>;

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const DEFAULT_ITEM = { descricao: '', quantidade: 1, unidade: 'un', valor_unitario: 0 };

// ── Component ─────────────────────────────────────────────────

export default function NovoOrcamento() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const clients = useClients();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingForm, setIsLoadingForm] = useState(isEdit);

  // OS linking state
  const [selectedOS, setSelectedOS] = useState<OSSearchResult | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<OSSearchResult[]>([]);
  const [recentOS, setRecentOS] = useState<OSSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [skipOSSection, setSkipOSSection] = useState(false);
  const [osAutoFilledFields, setOsAutoFilledFields] = useState<Set<string>>(new Set());
  const osFilledItensRef = useRef<OrcamentoFormValues['itens'] | null>(null);
  const fromOSHandled = useRef(false);

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
      client_id:    '',
      titulo:       '',
      observacoes:  '',
      validade:     '',
      desconto_pct: 0,
      itens:        [DEFAULT_ITEM],
      report_id:    undefined,
    },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'itens' });

  // ── Load edit data ─────────────────────────────────────────
  useEffect(() => {
    if (!id) return;
    setIsLoadingForm(true);
    buscarOrcamento(id)
      .then(orc => {
        if (!orc) { navigate('/orcamentos'); return; }
        reset({
          client_id:    orc.client_id,
          titulo:       orc.titulo ?? '',
          observacoes:  orc.observacoes ?? '',
          validade:     orc.validade ?? '',
          desconto_pct: orc.desconto_pct,
          report_id:    orc.report_id ?? undefined,
          itens: orc.orcamento_itens.length > 0
            ? orc.orcamento_itens.map(i => ({
                descricao:      i.descricao,
                quantidade:     i.quantidade,
                unidade:        i.unidade,
                valor_unitario: i.valor_unitario,
              }))
            : [DEFAULT_ITEM],
        });
      })
      .catch(() => toast.error('Erro ao carregar orçamento.'))
      .finally(() => setIsLoadingForm(false));
  }, [id]); // eslint-disable-line

  // ── Load recent OS on mount (mode criação) ─────────────────
  useEffect(() => {
    if (isEdit) return;
    supabase
      .from('service_reports')
      .select(OS_SELECT)
      .in('status', ['approved', 'returned', 'pending_review'])
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        if (data) setRecentOS(data as OSSearchResult[]);
      });
  }, [isEdit]);

  // ── handleSelectOS ─────────────────────────────────────────
  const handleSelectOS = useCallback(async (os: OSSearchResult) => {
    // Fetch os_parts
    const { data: osParts } = await supabase
      .from('os_parts')
      .select('part_id, part_name_manual, qty_used, unit_cost_at_time, parts(name, unit)')
      .eq('report_id', os.id) as { data: OSPart[] | null };

    // Determine itens
    let itens: OrcamentoFormValues['itens'];
    if (osParts && osParts.length > 0) {
      itens = osParts.map(part => ({
        descricao:      part.parts?.name ?? part.part_name_manual ?? 'Item sem descrição',
        quantidade:     Number(part.qty_used),
        unidade:        part.parts?.unit ?? 'un',
        valor_unitario: Number(part.unit_cost_at_time ?? 0),
      }));
    } else if (os.parts_used?.trim()) {
      const segments = os.parts_used.split(/[\n,;]/).map(s => s.trim()).filter(s => s.length >= 3);
      itens = segments.length > 0
        ? segments.map(seg => ({ descricao: seg, quantidade: 1, unidade: 'un', valor_unitario: 0 }))
        : [DEFAULT_ITEM];
    } else {
      itens = [DEFAULT_ITEM];
    }

    // Build titulo
    const partes = ['Orçamento'];
    if (os.os_number)      partes.push(`OS ${os.os_number}`);
    if (os.service_type)   partes.push(os.service_type);
    if (os.clients?.name)  partes.push(os.clients.name);
    const titulo = partes.join(' — ');

    // Build observacoes
    const linhas: string[] = [];
    if (os.os_number)    linhas.push(`OS: ${os.os_number}`);
    if (os.service_type) linhas.push(`Tipo de serviço: ${os.service_type}`);
    if (os.site_location) linhas.push(`Local: ${os.site_location}`);
    if (os.asset_name_manual) linhas.push(`Equipamento: ${os.asset_name_manual}`);
    linhas.push('');
    if (os.reported_problem)          linhas.push(`Problema relatado:\n${os.reported_problem}`);
    if (os.final_diagnosis)           linhas.push(`\nDiagnóstico:\n${os.final_diagnosis}`);
    if (os.services_performed)        linhas.push(`\nServiços realizados:\n${os.services_performed}`);
    if (os.technical_recommendation)  linhas.push(`\nRecomendação técnica:\n${os.technical_recommendation}`);
    const observacoes = linhas.join('\n').trim();

    // Apply to form
    setValue('client_id',   os.client_id ?? '', { shouldValidate: true, shouldDirty: true });
    setValue('titulo',      titulo,              { shouldDirty: true });
    setValue('observacoes', observacoes,         { shouldDirty: true });
    setValue('report_id',   os.id,              { shouldDirty: true });
    replace(itens);

    // Track auto-filled fields
    osFilledItensRef.current = itens;
    setOsAutoFilledFields(new Set(['client_id', 'titulo', 'observacoes', 'itens']));
    setSelectedOS(os);
    setSearchTerm('');
  }, [setValue, replace]);

  // ── fromOS param on mount ──────────────────────────────────
  const fromOSParam = searchParams.get('fromOS');
  useEffect(() => {
    if (isEdit || fromOSHandled.current || !fromOSParam) return;
    fromOSHandled.current = true;
    supabase
      .from('service_reports')
      .select(OS_SELECT)
      .eq('id', fromOSParam)
      .maybeSingle()
      .then(({ data }) => {
        if (data) handleSelectOS(data as OSSearchResult);
      });
  }, [fromOSParam, isEdit, handleSelectOS]);

  // ── Debounce search ────────────────────────────────────────
  useEffect(() => {
    if (isEdit || selectedOS || !searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('service_reports')
        .select(OS_SELECT)
        .in('status', ['approved', 'returned', 'pending_review'])
        .textSearch('search_vector', searchTerm.trim(), { type: 'websearch', config: 'simple' })
        .order('created_at', { ascending: false })
        .limit(8);
      setSearchResults((data ?? []) as OSSearchResult[]);
      setIsSearching(false);
    }, 400);
    return () => { clearTimeout(timer); setIsSearching(false); };
  }, [searchTerm, isEdit, selectedOS]);

  // ── Track itens changes after OS fill ─────────────────────
  const watchedItens = watch('itens') ?? [];
  const itensJson = JSON.stringify(watchedItens);
  useEffect(() => {
    if (!osFilledItensRef.current || !osAutoFilledFields.has('itens')) return;
    if (itensJson !== JSON.stringify(osFilledItensRef.current)) {
      setOsAutoFilledFields(prev => { const s = new Set(prev); s.delete('itens'); return s; });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensJson]);

  // ── Desvincular OS ─────────────────────────────────────────
  const handleDesvincular = () => {
    setValue('report_id', undefined, { shouldDirty: true });
    if (osAutoFilledFields.has('client_id'))   setValue('client_id',   '', { shouldDirty: true });
    if (osAutoFilledFields.has('titulo'))       setValue('titulo',       '', { shouldDirty: true });
    if (osAutoFilledFields.has('observacoes'))  setValue('observacoes',  '', { shouldDirty: true });
    if (osAutoFilledFields.has('itens'))        replace([DEFAULT_ITEM]);
    osFilledItensRef.current = null;
    setOsAutoFilledFields(new Set());
    setSelectedOS(null);
    setSearchTerm('');
  };

  // ── Totals ─────────────────────────────────────────────────
  const desconto_pct = Number(watch('desconto_pct')) || 0;
  const subtotal = watchedItens.reduce((acc, i) => acc + (Number(i.quantidade) || 0) * (Number(i.valor_unitario) || 0), 0);
  const desconto = subtotal * (desconto_pct / 100);
  const total = subtotal - desconto;

  // ── Submit ─────────────────────────────────────────────────
  const onSubmit = async (values: OrcamentoFormValues) => {
    if (!user?.id) return;
    setIsSubmitting(true);
    try {
      if (isEdit && id) {
        await atualizarOrcamento(id, {
          client_id:    values.client_id,
          titulo:       values.titulo,
          observacoes:  values.observacoes,
          validade:     values.validade || null,
          desconto_pct: values.desconto_pct,
          itens:        values.itens,
        }, user.id);
        toast.success('Orçamento atualizado!');
        navigate(`/orcamentos/${id}`);
      } else {
        const novoId = await criarOrcamento({
          client_id:     values.client_id,
          technician_id: user.id,
          titulo:        values.titulo,
          observacoes:   values.observacoes,
          validade:      values.validade || null,
          desconto_pct:  values.desconto_pct,
          itens:         values.itens,
          report_id:     values.report_id ?? null,
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

  // ── Helpers for chip removal on manual edit ────────────────
  const removeFromAutoFilled = (field: string) => {
    setOsAutoFilledFields(prev => {
      if (!prev.has(field)) return prev;
      const s = new Set(prev);
      s.delete(field);
      return s;
    });
  };

  // Register with chip-removal intercept
  const tituloReg     = register('titulo');
  const observacoesReg = register('observacoes');

  // ── Displayed OS list ──────────────────────────────────────
  const displayedList  = searchTerm.trim() ? searchResults : recentOS;
  const listLabel      = searchTerm.trim() ? null : 'OS recentes';

  if (isLoadingForm) {
    return (
      <div className="flex items-center justify-center p-16">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto pb-8 flex flex-col gap-4">
      {/* Header */}
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

        {/* ── Vincular OS (somente criação) ────────────────── */}
        {!isEdit && !skipOSSection && (
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  Vincular Ordem de Serviço
                </CardTitle>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Importe dados da OS para preencher o orçamento automaticamente
              </p>
            </CardHeader>
            <CardContent className="pt-4 flex flex-col gap-3">
              {selectedOS ? (
                /* Estado 2 — OS vinculada */
                <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="text-sm font-semibold">OS vinculada</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleDesvincular}
                      className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
                      title="Desvincular OS"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="font-mono font-bold text-primary text-lg leading-none">
                    {selectedOS.os_number ?? 'Sem número'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    {selectedOS.service_type && <span>{selectedOS.service_type}</span>}
                    {selectedOS.clients?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />{selectedOS.clients.name}
                      </span>
                    )}
                    {selectedOS.service_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{fmtOSDate(selectedOS.service_date)}
                      </span>
                    )}
                  </div>
                  {osAutoFilledFields.size > 0 && (
                    <p className="text-[11px] text-slate-500 mt-1">
                      • Campos preenchidos automaticamente — edite se necessário
                    </p>
                  )}
                </div>
              ) : (
                /* Estado 1 — busca */
                <>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <Input
                      className="h-11 rounded-xl pl-9 pr-9"
                      placeholder="Buscar por nº OS, cliente, tipo, problema, local..."
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {isSearching ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  ) : (
                    <>
                      {listLabel && displayedList.length > 0 && (
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide px-1">{listLabel}</p>
                      )}
                      {displayedList.length === 0 && searchTerm.trim() ? (
                        <p className="text-sm text-slate-500 text-center py-3">Nenhuma OS encontrada para essa busca</p>
                      ) : (
                        <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                          {displayedList.map(os => (
                            <button
                              key={os.id}
                              type="button"
                              onClick={() => handleSelectOS(os)}
                              className="text-left px-4 py-3 hover:bg-muted/50 transition-colors flex flex-col gap-1"
                            >
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-xs font-semibold bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                  {os.os_number ?? 'Sem número'}
                                </span>
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${OS_STATUS_BG[os.status] ?? 'bg-slate-100 text-slate-600'}`}>
                                  {OS_STATUS_LABEL[os.status] ?? os.status}
                                </span>
                                {os.service_type && (
                                  <span className="text-xs text-slate-500">{os.service_type}</span>
                                )}
                              </div>
                              {os.clients?.name && (
                                <span className="text-xs text-slate-600 flex items-center gap-1">
                                  <Building2 className="h-3 w-3 shrink-0" />{os.clients.name}
                                </span>
                              )}
                              <div className="flex items-center gap-3 text-xs text-slate-400">
                                {os.site_location && (
                                  <span className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3 shrink-0" />{os.site_location}
                                  </span>
                                )}
                                {os.service_date && (
                                  <span className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3 shrink-0" />{fmtOSDate(os.service_date)}
                                  </span>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {!selectedOS && (
                <button
                  type="button"
                  onClick={() => setSkipOSSection(true)}
                  className="text-xs text-slate-400 hover:text-slate-600 self-start mt-1 transition-colors"
                >
                  Pular vinculação
                </button>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Dados Gerais ──────────────────────────────────── */}
        <Card>
          <CardHeader><CardTitle className="text-base">Dados Gerais</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Label>Cliente *</Label>
                {osAutoFilledFields.has('client_id') && (
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">• OS</span>
                )}
              </div>
              <Select
                value={watch('client_id')}
                onValueChange={v => {
                  setValue('client_id', v, { shouldValidate: true });
                  removeFromAutoFilled('client_id');
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

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <Label>Título (opcional)</Label>
                {osAutoFilledFields.has('titulo') && (
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">• OS</span>
                )}
              </div>
              <Input
                placeholder="Ex.: Manutenção preventiva anual"
                {...tituloReg}
                onChange={e => {
                  tituloReg.onChange(e);
                  removeFromAutoFilled('titulo');
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Itens ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CardTitle className="text-base">Itens do Orçamento</CardTitle>
                {osAutoFilledFields.has('itens') && (
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">• OS</span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  removeFromAutoFilled('itens');
                  append(DEFAULT_ITEM);
                }}
                className="gap-1"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar item
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
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
                  onRemove={() => {
                    removeFromAutoFilled('itens');
                    remove(index);
                  }}
                  isOnly={fields.length === 1}
                />
              </Fragment>
            ))}

            {errors.itens && typeof errors.itens.message === 'string' && (
              <p className="text-[11px] text-rose-500">{errors.itens.message}</p>
            )}
          </CardContent>
        </Card>

        {/* ── Configurações ─────────────────────────────────── */}
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
              <div className="flex items-center gap-2">
                <Label>Observações</Label>
                {osAutoFilledFields.has('observacoes') && (
                  <span className="text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-md">• OS</span>
                )}
              </div>
              <Textarea
                rows={3}
                placeholder="Condições de pagamento, prazo de entrega, etc."
                {...observacoesReg}
                onChange={e => {
                  observacoesReg.onChange(e);
                  removeFromAutoFilled('observacoes');
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Resumo de totais ──────────────────────────────── */}
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
