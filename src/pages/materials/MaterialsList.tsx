import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Package, Clock, Truck, Loader2, ExternalLink, Image as ImageIcon,
  ShoppingCart, XCircle, Search, RefreshCw, Filter, Pencil, Download, MapPin, Store,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { useAuth } from '@/src/contexts/AuthContext';
import { fetchMaterialRequests, subscribeMaterialRequests } from '@/src/services/materialRequestService';
import type { PurchaseRequest } from '@/src/types/materialRequest';
import { Card, CardContent } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import clsx from 'clsx';
import PurchaseDetailModal from './components/PurchaseDetailModal';

const STATUS_BADGE: Record<string, string> = {
  'Pendente':   'bg-amber-100 text-amber-800 border-0',
  'Em Análise': 'bg-blue-100 text-blue-800 border-0',
  'Comprado':   'bg-indigo-100 text-indigo-800 border-0',
  'Entregue':   'bg-emerald-100 text-emerald-800 border-0',
  'Cancelado':  'bg-rose-100 text-rose-800 border-0',
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  'Pendente':   <Clock className="h-3 w-3 mr-1" />,
  'Em Análise': <Search className="h-3 w-3 mr-1" />,
  'Comprado':   <ShoppingCart className="h-3 w-3 mr-1" />,
  'Entregue':   <Truck className="h-3 w-3 mr-1" />,
  'Cancelado':  <XCircle className="h-3 w-3 mr-1" />,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <Badge className={clsx('inline-flex items-center shrink-0', STATUS_BADGE[status] || 'bg-slate-100 text-slate-700 border-0')}>
      {STATUS_ICON[status]}{status}
    </Badge>
  );
}

export default function MaterialsList() {
  const { user } = useAuth();
  const navigate  = useNavigate();
  const [requests, setRequests]             = useState<PurchaseRequest[]>([]);
  const [loading, setLoading]               = useState(true);
  const [selectedRequest, setSelectedRequest] = useState<PurchaseRequest | null>(null);
  const [activeTab, setActiveTab]           = useState('Todos');
  const [searchQuery, setSearchQuery]       = useState('');

  // Extrair valores estáveis para evitar re-renders desnecessários
  const userId   = user?.id;
  const userRole = user?.role;

  const canProcess   = ['Comprador', 'Gestor', 'Admin', 'Master'].includes(userRole || '');
  const isTechnician = userRole === 'Tecnico' || userRole === 'Administrativo';

  // SEM filtro client-side de tech_id — o RLS do Supabase já faz isso corretamente:
  // • Tecnico   → RLS retorna só os seus (tech_id = auth.uid())
  // • Comprador → RLS retorna todos (is_manager_or_admin() = true)
  // Filtrar no frontend causava bug quando AuthContext usava fallback role='Tecnico'
  const fetchRequests = useCallback(async () => {
    if (!userId || !userRole) return;
    try {
      setLoading(true);
      setRequests(await fetchMaterialRequests());
    } catch (err: any) {
      console.error('[MaterialsList] fetchRequests error:', err);
      toast.error('Erro ao buscar solicitações.');
    } finally {
      setLoading(false);
    }
  }, [userId, userRole]);

  // useRef: garante que o callback do real-time sempre chame a versão mais recente
  // de fetchRequests (evita stale closure no canal Supabase)
  const fetchRequestsRef = useRef(fetchRequests);
  useEffect(() => { fetchRequestsRef.current = fetchRequests; }, [fetchRequests]);

  // Fetch inicial — re-executa quando role muda (resolve race condition do AuthContext)
  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  // Real-time — canal único por userId, sem filtro client-side (RLS resolve no banco)
  useEffect(() => {
    if (!userId) return;
    return subscribeMaterialRequests(userId, () => fetchRequestsRef.current());
  }, [userId]);

  const kpis = useMemo(() => ({
    pendente:  requests.filter(r => r.status === 'Pendente').length,
    analise:   requests.filter(r => r.status === 'Em Análise').length,
    comprado:  requests.filter(r => r.status === 'Comprado').length,
    entregue:  requests.filter(r => r.status === 'Entregue').length,
    cancelado: requests.filter(r => r.status === 'Cancelado').length,
  }), [requests]);

  const filtered = useMemo(() => {
    let list = activeTab === 'Todos' ? requests : requests.filter(r => r.status === activeTab);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r =>
        (r.especificacao_tecnica || r.item).toLowerCase().includes(q) ||
        r.cidade?.toLowerCase().includes(q) ||
        (r.clients as any)?.name?.toLowerCase().includes(q) ||
        (r.users as any)?.full_name?.toLowerCase().includes(q) ||
        r.loja?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [requests, activeTab, searchQuery]);

  const handleModalUpdated = (updated: PurchaseRequest) => {
    setRequests(prev => prev.map(r => r.id === updated.id ? { ...r, ...updated } : r));
    setSelectedRequest(null);
  };

  const handleExportExcel = () => {
    try {
      const exportData = filtered.map(r => ({
        'ID':                r.request_number ?? `#${r.id.substring(0, 8).toUpperCase()}`,
        'Data':              new Date(r.created_at).toLocaleDateString('pt-BR'),
        'Técnico':           (r.users as any)?.full_name || '-',
        'Cidade':            r.cidade || '-',
        'Cliente':           (r.clients as any)?.name || '-',
        'Loja':              r.loja || '-',
        'Tipo Manutenção':   r.maintenance_type || '-',
        'Especificação':     r.especificacao_tecnica || (r as any).item || '-',
        'Quantidade':        r.quantity || '-',
        'Prazo':             r.prazo ? new Date(r.prazo).toLocaleDateString('pt-BR') : '-',
        'Status':            r.status,
        'Resposta Compras':  r.comprador_response || '-',
        'Fornecedor':        r.supplier_name || '-',
        'Logística':         r.logistics_type === 'retirada' ? 'Retirada' : r.logistics_type === 'entrega' ? 'Entrega' : '-',
        'Endereço':          r.pickup_address || '-',
        'Valor Pago (R$)':   r.purchase_price ? Number(r.purchase_price) : '-',
        'Link Compra':       (r as any).purchase_link || '-',
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Compras');
      XLSX.writeFile(wb, `Compras_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
      toast.success('Excel exportado!');
    } catch {
      toast.error('Erro ao exportar.');
    }
  };

  // ─────────────────────────────────────────────
  // COMPRADOR / GESTOR / ADMIN / MASTER VIEW
  // ─────────────────────────────────────────────
  if (!isTechnician) {
    const TABS = ['Todos', 'Pendente', 'Em Análise', 'Comprado', 'Entregue', 'Cancelado'];

    const KPI_CARDS = [
      {
        tab: 'Pendente', label: 'Pendentes', count: kpis.pendente,
        bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', num: 'text-amber-900',
        icon: <Clock className="h-5 w-5 text-amber-500" />,
      },
      {
        tab: 'Em Análise', label: 'Em Análise', count: kpis.analise,
        bg: 'bg-blue-50 border-blue-200', text: 'text-blue-700', num: 'text-blue-900',
        icon: <Filter className="h-5 w-5 text-blue-500" />,
      },
      {
        tab: 'Comprado', label: 'Comprados', count: kpis.comprado,
        bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', num: 'text-indigo-900',
        icon: <ShoppingCart className="h-5 w-5 text-indigo-500" />,
      },
      {
        tab: 'Entregue', label: 'Entregues', count: kpis.entregue,
        bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', num: 'text-emerald-900',
        icon: <Truck className="h-5 w-5 text-emerald-500" />,
      },
      {
        tab: 'Cancelado', label: 'Cancelados', count: kpis.cancelado,
        bg: 'bg-rose-50 border-rose-200', text: 'text-rose-600', num: 'text-rose-900',
        icon: <XCircle className="h-5 w-5 text-rose-400" />,
      },
    ];

    return (
      <div className="flex flex-col gap-5 h-full w-full pb-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <ShoppingCart className="h-6 w-6 text-blue-600" />
              Central de Compras
            </h1>
            <p className="text-sm text-slate-500">
              Gerencie e processe todas as solicitações de compra da equipe
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={loading || filtered.length === 0}
              className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
            >
              <Download className="h-4 w-4" />
              Excel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchRequests}
              disabled={loading}
              className="gap-2 text-slate-600 border-slate-300 hover:bg-slate-100"
            >
              <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {KPI_CARDS.map(k => (
            <button
              key={k.tab}
              onClick={() => setActiveTab(k.tab)}
              className={clsx(
                'rounded-xl border p-4 text-left transition-all hover:shadow-md active:scale-[0.98]',
                k.bg,
                activeTab === k.tab && 'ring-2 ring-blue-500 ring-offset-2'
              )}
            >
              <div className="flex items-center justify-between mb-1">
                {k.icon}
                <span className={clsx('text-2xl font-extrabold tabular-nums', k.num)}>{k.count}</span>
              </div>
              <p className={clsx('text-xs font-semibold', k.text)}>{k.label}</p>
            </button>
          ))}
        </div>

        {/* Tabs + Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex gap-1 bg-muted p-1 rounded-xl overflow-x-auto shrink-0">
            {TABS.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={clsx(
                  'px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all',
                  activeTab === tab ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {tab}
                {tab !== 'Todos' && (
                  <span className="ml-1.5 text-[10px] font-bold text-slate-400">
                    {requests.filter(r => r.status === tab).length}
                  </span>
                )}
              </button>
            ))}
          </div>
          <div className="relative flex-1 w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Buscar por item, cidade, cliente, técnico..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-10 rounded-xl bg-background border-input text-sm"
            />
          </div>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p className="font-semibold text-slate-500">Nenhuma solicitação encontrada.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(req => (
              <Card
                key={req.id}
                onClick={() => setSelectedRequest(req)}
                className="cursor-pointer hover:shadow-md hover:border-blue-200 transition-all border-slate-200 overflow-hidden"
              >
                <CardContent className="p-0">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="font-mono text-[10px] text-slate-400 font-bold">
                          {req.request_number ?? `#${req.id.substring(0, 8).toUpperCase()}`}
                        </span>
                        <StatusBadge status={req.status} />
                        {req.maintenance_type && (
                          <Badge variant="outline" className="text-[10px] font-normal border-slate-200 text-slate-500">
                            {req.maintenance_type}
                          </Badge>
                        )}
                      </div>
                      <p className="font-bold text-slate-900 text-sm leading-snug line-clamp-2 mb-1">
                        {req.especificacao_tecnica || req.item}
                      </p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span className="text-xs text-slate-600 font-semibold">
                          {(req.users as any)?.full_name || 'Usuário'}
                        </span>
                        {req.cidade && <span className="text-xs text-slate-400">{req.cidade}</span>}
                        {(req.clients as any)?.name && (
                          <span className="text-xs text-slate-400">{(req.clients as any).name}</span>
                        )}
                        {req.loja && <span className="text-xs text-slate-400">{req.loja}</span>}
                      </div>
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-slate-400">
                          Qtd: <span className="font-bold text-slate-700">{req.quantity}</span>
                        </p>
                        {req.prazo && (
                          <p className="text-xs text-slate-400">
                            Prazo:{' '}
                            <span className={clsx(
                              'font-medium',
                              new Date(req.prazo) < new Date() && req.status === 'Pendente'
                                ? 'text-rose-600'
                                : 'text-slate-600'
                            )}>
                              {new Date(req.prazo).toLocaleDateString('pt-BR')}
                            </span>
                          </p>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-400 font-medium">
                        {new Date(req.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  {req.comprador_response && (
                    <div className="bg-blue-50 border-t border-blue-100 px-4 py-2.5 flex items-start gap-2">
                      <ShoppingCart className="h-3.5 w-3.5 text-blue-400 mt-0.5 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-blue-700 line-clamp-1">{req.comprador_response}</p>
                        {(req.logistics_type || req.supplier_name) && (
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {req.supplier_name && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                                <Store className="h-2.5 w-2.5" /> {req.supplier_name}
                              </span>
                            )}
                            {req.logistics_type && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded">
                                {req.logistics_type === 'retirada'
                                  ? <Package className="h-2.5 w-2.5" />
                                  : <Truck className="h-2.5 w-2.5" />}
                                {req.logistics_type === 'retirada' ? 'Retirada' : 'Entrega'}
                                {req.pickup_address ? ` — ${req.pickup_address}` : ''}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {selectedRequest && (
          <PurchaseDetailModal
            request={selectedRequest}
            canProcess={canProcess}
            onClose={() => setSelectedRequest(null)}
            onUpdated={handleModalUpdated}
          />
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────
  // TECHNICIAN VIEW
  // ─────────────────────────────────────────────
  const TECH_TABS = ['Todos', 'Pendente', 'Em Análise', 'Comprado', 'Entregue', 'Cancelado'];

  return (
    <div className="flex flex-col gap-5 h-full w-full pb-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <ShoppingCart className="h-6 w-6 text-blue-600" />
            Minhas Solicitações
          </h1>
          <p className="text-sm text-slate-500">Acompanhe o status dos seus pedidos de compra</p>
        </div>
        <Button
          onClick={() => navigate('/materials/new')}
          data-onboarding="mat-novo"
          className="w-full sm:w-auto inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold h-12 px-5 rounded-xl"
        >
          <Plus className="h-5 w-5" />
          Nova Solicitação
        </Button>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {TECH_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={clsx(
              'px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all shrink-0',
              activeTab === tab
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            )}
          >
            {tab}
            {tab !== 'Todos' && (
              <span className={clsx('ml-1.5 text-[10px] font-bold',
                activeTab === tab ? 'text-blue-200' : 'text-slate-400'
              )}>
                {requests.filter(r => r.status === tab).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Package className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-500 text-base">
            {activeTab !== 'Todos' ? `Nenhuma solicitação com status "${activeTab}".` : 'Você ainda não fez nenhuma solicitação.'}
          </p>
          <p className="text-sm mt-1">Clique em "Nova Solicitação" para criar uma.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((req, i) => (
            <Card
              key={req.id}
              data-onboarding={i === 0 ? 'mat-card-primeiro' : undefined}
              onClick={() => req.comprador_response ? setSelectedRequest(req) : undefined}
              className={clsx(
                'border-slate-200 overflow-hidden transition-all',
                req.comprador_response && 'cursor-pointer hover:shadow-md hover:border-blue-200'
              )}
            >
              <CardContent className="p-0">
                <div className="p-4 space-y-2.5">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wide mb-0.5">
                        {req.maintenance_type || 'Compra'}
                        {req.cidade ? ` • ${req.cidade}` : ''}
                        {(req.clients as any)?.name ? ` • ${(req.clients as any).name}` : ''}
                        {req.loja ? ` • ${req.loja}` : ''}
                      </p>
                      <p className="font-bold text-slate-900 text-sm leading-snug line-clamp-3">
                        {req.especificacao_tecnica || req.item}
                      </p>
                    </div>
                    <StatusBadge status={req.status} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-xs font-normal border-slate-200 text-slate-600">
                      Qtd: {req.quantity}
                    </Badge>
                    {req.prazo && (
                      <Badge variant="outline" className="text-xs font-normal border-slate-200 text-slate-600">
                        Prazo: {new Date(req.prazo).toLocaleDateString('pt-BR')}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex gap-3">
                      {req.foto_url && (
                        <a href={req.foto_url} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-blue-600 font-medium hover:underline inline-flex items-center gap-1">
                          <ImageIcon className="h-3 w-3" /> Ver foto
                        </a>
                      )}
                      {req.link_referencia && (
                        <a href={req.link_referencia} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-xs text-blue-600 font-medium hover:underline inline-flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Referência
                        </a>
                      )}
                    </div>
                    {req.status === 'Pendente' && (
                      <button
                        onClick={e => { e.stopPropagation(); navigate(`/materials/${req.id}/edit`); }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
                      >
                        <Pencil className="h-3 w-3" /> Editar
                      </button>
                    )}
                  </div>
                </div>

                {/* Devolutiva do Compras */}
                {req.comprador_response && (
                  <div className={clsx(
                    'border-t px-4 py-3 space-y-1.5',
                    req.status === 'Cancelado' ? 'bg-rose-50 border-rose-100' : 'bg-blue-50 border-blue-100'
                  )}>
                    <p className={clsx(
                      'text-[10px] font-bold uppercase tracking-wide',
                      req.status === 'Cancelado' ? 'text-rose-400' : 'text-blue-400'
                    )}>
                      Resposta do Setor de Compras
                    </p>
                    <p className={clsx('text-sm', req.status === 'Cancelado' ? 'text-rose-700' : 'text-blue-700')}>
                      {req.comprador_response}
                    </p>
                    {req.supplier_name && (
                      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                        <Store className="h-3.5 w-3.5 shrink-0" /> {req.supplier_name}
                      </p>
                    )}
                    {req.logistics_type && (
                      <p className="text-xs font-semibold text-blue-700 flex items-center gap-1">
                        {req.logistics_type === 'retirada'
                          ? <Package className="h-3.5 w-3.5 shrink-0" />
                          : <Truck className="h-3.5 w-3.5 shrink-0" />}
                        {req.logistics_type === 'retirada' ? 'Retirada' : 'Entrega'}
                        {req.pickup_address ? ` — ${req.pickup_address}` : ''}
                      </p>
                    )}
                    {req.purchase_price && (
                      <p className="text-xs font-bold text-blue-600">
                        Valor pago: R$ {Number(req.purchase_price).toFixed(2)}
                      </p>
                    )}
                    {req.purchase_link && (
                      <a href={req.purchase_link} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 font-semibold hover:underline">
                        <ExternalLink className="h-3 w-3" /> Ver produto comprado
                      </a>
                    )}
                  </div>
                )}

                <div className="bg-slate-50 border-t border-slate-100 px-4 py-2 flex justify-between text-[10px] text-slate-400 font-medium">
                  <span>{new Date(req.created_at).toLocaleDateString('pt-BR')}</span>
                  <span>{req.request_number ?? `#${req.id.substring(0, 8).toUpperCase()}`}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedRequest && (
        <PurchaseDetailModal
          request={selectedRequest}
          canProcess={false}
          onClose={() => setSelectedRequest(null)}
          onUpdated={handleModalUpdated}
        />
      )}
    </div>
  );
}
