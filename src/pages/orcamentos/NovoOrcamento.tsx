import { useState, useEffect, useRef, Fragment, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft, Plus, Loader2,
  Link2, Search, CheckCircle2, X, Building2, MapPin, Calendar, Wrench,
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

interface LinkedOSInfo {
  id: string;
  os_number: string | null;
  service_type: string | null;
  service_date: string | null;
}

// ── Constants ─────────────────────────────────────────────────

const OS_SELECT = 'id,os_number,service_type,status,service_date,site_location,reported_problem,services_performed,final_diagnosis,technical_recommendation,parts_used,asset_name_manual,client_id,priority,clients(name),users:technician_id(full_name)';

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

function fmtOSDate(iso: string | null): string {
  if (!iso) return '—';
  const [, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}`;
}

// ── Schema ────────────────────────────────────────────────────

const itemSchema = z.object({
  descricao:      z.string().min(1, 'Descrição obrigatória'),
  quantidade:     z.number().positive('Deve ser maior que 0'),
  unidade:        z.string(),
  valor_unitario: z.number().min(0, 'Valor não pode ser negativo'),
});

const orcamentoSchema = z.object({
  client_id:    z.string().min(1, 'Selecione um cliente'),
  titulo:       z.string().optional(),
  observacoes:  z.string().optional(),
  validade:     z.string().optional(),
  desconto_pct: z.number().min(0).max(100),
  itens:        z.array(itemSchema).min(1, 'Adicione pelo menos um item'),
  report_id:    z.string().uuid().optional(),
});

export type OrcamentoFormValues = z.infer<typeof orcamentoSchema>;

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const DEFAULT_ITEM = { descricao: '', quantidade: 1, unidade: 'un', valor_unitario: 0 };

// ── Skeleton para OS recentes ─────────────────────────────────

function OSListSkeleton() {
  return (
    <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden animate-pulse">
      {[1, 2, 3].map(n => (
        <div key={n} className="px-4 py-3 flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <div className="h-4 w-16 bg-slate-200 rounded" />
            <div className="h-4 w-14 bg-slate-100 rounded-full" />
            <div className="h-4 w-24 bg-slate-100 rounded" />
          </div>
          <div className="h-3 w-32 bg-slate-100 rounded" />
          <div className="h-3 w-48 bg-slate-100 rounded" />
        </div>
      ))}
    </div>
  );
}

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
  const [isRecentOSLoading, setIsRecentOSLoading] = useState(!isEdit);
  const [isFromOSLoading, setIsFromOSLoading] = useState(false);
  const [skipOSSection, setSkipOSSection] = useState(false);
  const [osAutoFilledFields, setOsAutoFilledFields] = useState<Set<string>>(new Set());
  const osFilledItensRef = useRef<OrcamentoFormValues['itens'] | null>(null);
  const fromOSHandled = useRef(false);
  const isSelectingOSRef = useRef(false);
  const [isSelectingOS, setIsSelectingOS] = useState(false);

  // Edit mode: OS info exibida como referência de documento
  const [linkedOSInfo, setLinkedOSInfo] = useState<LinkedOSInfo | null>(null);

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
        // Popula info da OS vinculada para exibição no modo edição
        if (orc.report_id && orc.service_reports) {
          setLinkedOSInfo({
            id:           orc.report_id,
            os_number:    orc.service_reports.os_number ?? null,
            service_type: orc.service_reports.service_type ?? null,
            service_date: orc.service_reports.service_date ?? null,
          });
        }
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

  // ── Load recent OS on mount ────────────────────────────────
  useEffect(() => {
    if (isEdit) return;
    setIsRecentOSLoading(true);
    supabase
      .from('service_reports')
      .select(OS_SELECT)
      .in('status', ['approved', 'returned', 'pending_review'])
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data, error }) => {
        if (error) {
          console.warn('[NovoOrcamento] Failed to load recent OS:', error.message);
          return;
        }
        if (data) setRecentOS(data as OSSearchResult[]);
      })
      .finally(() => setIsRecentOSLoading(false));
  }, [isEdit]);

  // ── handleSelectOS ─────────────────────────────────────────
  const handleSelectOS = useCallback(async (os: OSSearchResult) => {
    if (isSelectingOSRef.current) return;
    isSelectingOSRef.current = true;
    setIsSelectingOS(true);
    try {
      // RLS garante isolamento de tenant; report_id vem de query já filtrada por RLS
      const { data: osParts, error: partsError } = await supabase
        .from('os_parts')
        .select('part_id, part_name_manual, qty_used, unit_cost_at_time, parts(name, unit)')
        .eq('report_id', os.id) as { data: OSPart[] | null; error: { message: string } | null };

      if (partsError) {
        // Recuperável: segue com fallback em parts_used
        console.warn('[handleSelectOS] os_parts fetch failed:', partsError.message);
      }

      // Determinar itens: os_parts com preços reais → fallback parse → default
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

      // Título estruturado
      const partes = ['Orçamento'];
      if (os.os_number)     partes.push(`OS ${os.os_number}`);
      if (os.service_type)  partes.push(os.service_type);
      if (os.clients?.name) partes.push(os.clients.name);
      const titulo = partes.join(' — ');

      // Observações estruturadas (bloco SAP-style com 6 campos)
      const linhas: string[] = [];
      if (os.os_number)    linhas.push(`OS: ${os.os_number}`);
      if (os.service_type) linhas.push(`Tipo de serviço: ${os.service_type}`);
      if (os.site_location) linhas.push(`Local: ${os.site_location}`);
      if (os.asset_name_manual) linhas.push(`Equipamento: ${os.asset_name_manual}`);
      linhas.push('');
      if (os.reported_problem)         linhas.push(`Problema relatado:\n${os.reported_problem}`);
      if (os.final_diagnosis)          linhas.push(`\nDiagnóstico:\n${os.final_diagnosis}`);
      if (os.services_performed)       linhas.push(`\nServiços realizados:\n${os.services_performed}`);
      if (os.technical_recommendation) linhas.push(`\nRecomendação técnica:\n${os.technical_recommendation}`);
      const observacoes = linhas.join('\n').trim();

      setValue('client_id',   os.client_id ?? '', { shouldValidate: true, shouldDirty: true });
      setValue('titulo',      titulo,              { shouldDirty: true });
      setValue('observacoes', observacoes,         { shouldDirty: true });
      setValue('report_id',   os.id,               { shouldDirty: true });
      replace(itens);

      osFilledItensRef.current = itens;
      setOsAutoFilledFields(new Set(['client_id', 'titulo', 'observacoes', 'itens']));
      setSelectedOS(os);
      setSearchTerm('');
    } catch (err) {
      toast.error('Erro ao vincular OS. Tente novamente.');
      console.error('[handleSelectOS]', err);
    } finally {
      isSelectingOSRef.current = false;
      setIsSelectingOS(false);
    }
  }, [setValue, replace]);

  // ── fromOS param on mount ──────────────────────────────────
  const fromOSParam = searchParams.get('fromOS');
  useEffect(() => {
    if (isEdit || fromOSHandled.current || !fromOSParam) return;
    fromOSHandled.current = true;
    setIsFromOSLoading(true);
    supabase
      .from('service_reports')
      .select(OS_SELECT)
      .eq('id', fromOSParam)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error || !data) {
          toast.error('Não foi possível carregar a OS solicitada.');
          return;
        }
        handleSelectOS(data as OSSearchResult);
      })
      .finally(() => setIsFromOSLoading(false));
  }, [fromOSParam, isEdit, handleSelectOS]);

  // ── Debounce search ────────────────────────────────────────
  useEffect(() => {
    if (isEdit || selectedOS || !searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false); // C3: garantir reset do spinner
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      const { data, error } = await supabase
        .from('service_reports')
        .select(OS_SELECT)
        .in('status', ['approved', 'returned', 'pending_review'])
        .textSearch('search_vector', searchTerm.trim(), { type: 'websearch', config: 'simple' })
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) {
        toast.error('Erro ao buscar OS. Verifique sua conexão.');
        setIsSearching(false);
        return;
      }
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

  // ── Desvincular OS (criação) ───────────────────────────────
  const handleDesvincular = useCallback(() => {
    setValue('report_id', undefined, { shouldDirty: true });
    if (osAutoFilledFields.has('client_id'))  setValue('client_id',   '', { shouldDirty: true });
    if (osAutoFilledFields.has('titulo'))      setValue('titulo',       '', { shouldDirty: true });
    if (osAutoFilledFields.has('observacoes')) setValue('observacoes',  '', { shouldDirty: true });
    if (osAutoFilledFields.has('itens'))       replace([DEFAULT_ITEM]);
    osFilledItensRef.current = null;
    setOsAutoFilledFields(new Set());
    setSelectedOS(null);
    setSearchTerm('');
  }, [osAutoFilledFields, setValue, replace]);

  // ── Desvincular OS (edição) — só limpa o report_id ────────
  const handleDesvincularEdit = useCallback(() => {
    setValue('report_id', undefined, { shouldDirty: true });
    setLinkedOSInfo(null);
  }, [setValue]);

  // ── Helpers ────────────────────────────────────────────────
  const removeFromAutoFilled = useCallback((field: string) => {
    setOsAutoFilledFields(prev => {
      if (!prev.has(field)) return prev;
      const s = new Set(prev);
      s.delete(field);
      return s;
    });
  }, []);

  // Register com intercept de onChange para chips
  const tituloReg      = register('titulo');
  const observacoesReg = register('observacoes');

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
          report_id:    values.report_id ?? null, // C1: preservar vínculo em edição
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

  // ── Displayed list ─────────────────────────────────────────
  const displayedList = searchTerm.trim() ? searchResults : recentOS;
  const showList      = !isSearching && !isRecentOSLoading && !isFromOSLoading && !selectedOS;

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

        {/* ── OS Vinculada em modo edição (referência de documento) ── */}
        {isEdit && (
          linkedOSInfo ? (
            <Card className="border-blue-100 bg-blue-50/30">
              <CardHeader className="pb-3 border-b border-blue-100">
                <CardTitle className="text-base flex items-center gap-2 text-blue-900">
                  <Link2 className="h-4 w-4 text-blue-600" />
                  Ordem de Serviço Vinculada
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1.5">
                  <span className="font-mono text-sm font-bold bg-white border border-blue-200 text-slate-800 px-2.5 py-1 rounded-md self-start">
                    {linkedOSInfo.os_number ?? 'OS sem número'}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                    {linkedOSInfo.service_type && (
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3" />{linkedOSInfo.service_type}
                      </span>
                    )}
                    {linkedOSInfo.service_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />{fmtOSDate(linkedOSInfo.service_date)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Link
                    to={`/reports/${linkedOSInfo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline font-medium"
                  >
                    Ver OS →
                  </Link>
                  <button
                    type="button"
                    onClick={handleDesvincularEdit}
                    className="text-xs text-slate-400 hover:text-rose-600 transition-colors"
                    title="Desvincular OS"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ) : (
            // edit mode, sem OS vinculada
            null
          )
        )}

        {/* ── Vincular OS (modo criação) ─────────────────────── */}
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

              {/* Loading: processando ?fromOS */}
              {isFromOSLoading ? (
                <div className="flex items-center justify-center gap-2 py-6 text-slate-500">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm">Carregando OS...</span>
                </div>
              ) : selectedOS ? (
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
                    {selectedOS.service_type && (
                      <span className="flex items-center gap-1">
                        <Wrench className="h-3 w-3 text-slate-400" />{selectedOS.service_type}
                      </span>
                    )}
                    {selectedOS.clients?.name && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3 text-slate-400" />{selectedOS.clients.name}
                      </span>
                    )}
                    {selectedOS.service_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-slate-400" />{fmtOSDate(selectedOS.service_date)}
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

                  {/* Skeleton de loading de OS recentes */}
                  {isRecentOSLoading && !searchTerm && <OSListSkeleton />}

                  {/* Spinner de busca */}
                  {isSearching && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                    </div>
                  )}

                  {showList && (
                    <>
                      {!searchTerm.trim() && displayedList.length > 0 && (
                        <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide px-1">
                          OS recentes
                        </p>
                      )}

                      {displayedList.length > 0 ? (
                        <div className="flex flex-col divide-y divide-slate-100 rounded-xl border border-slate-100 overflow-hidden">
                          {displayedList.map(os => (
                            <button
                              key={os.id}
                              type="button"
                              disabled={isSelectingOS}
                              onClick={() => handleSelectOS(os)}
                              className="text-left px-4 py-3 hover:bg-muted/50 transition-colors flex flex-col gap-1 disabled:opacity-60 disabled:cursor-not-allowed disabled:pointer-events-none"
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
                                  <Building2 className="h-3 w-3 shrink-0 text-slate-400" />{os.clients.name}
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
                      ) : searchTerm.trim() ? (
                        <p className="text-sm text-slate-500 text-center py-3">
                          Nenhuma OS encontrada para essa busca
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400 text-center py-3">
                          Nenhuma OS disponível para vinculação
                        </p>
                      )}
                    </>
                  )}
                </>
              )}

              {/* A5: "Pular" sempre reversível */}
              {!selectedOS && !isFromOSLoading && (
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

        {/* A5: botão para restaurar seção após "Pular" */}
        {!isEdit && skipOSSection && !selectedOS && (
          <button
            type="button"
            onClick={() => setSkipOSSection(false)}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 transition-colors self-start -mt-2"
          >
            <Link2 className="h-3.5 w-3.5" />
            Vincular uma OS a este orçamento
          </button>
        )}

        {/* ── Dados Gerais ──────────────────────────────────── */}
        <Card data-onboarding="orc-form-dados">
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
                  {/* C2: children explícito para evitar UUID no Radix SelectValue */}
                  <SelectValue placeholder="Selecione o cliente">
                    {clients.find(c => c.id === watch('client_id'))?.name}
                  </SelectValue>
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
        <Card data-onboarding="orc-form-itens">
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
                  showOSHint={osAutoFilledFields.has('itens')} // M2: sinaliza preço zero por item
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
              {/* A3: textarea expande quando auto-preenchida pela OS */}
              <Textarea
                rows={osAutoFilledFields.has('observacoes') ? 10 : 3}
                placeholder="Condições de pagamento, prazo de entrega, etc."
                className="resize-y transition-all"
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
