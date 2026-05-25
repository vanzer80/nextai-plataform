import React, { useState, useEffect, useCallback } from 'react';
import {
  Brain, Download, FileJson, FileText, Loader2, ShieldCheck,
  BarChart3, BookOpen, Stethoscope, Building2, Search,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button }  from '@/components/ui/button';
import { Badge }   from '@/components/ui/badge';
import { Input }   from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/src/lib/supabase';

import {
  getIntelligenceStats,
  getDiagnosticCorpus,
  getKbCorpus,
  logExport,
  fetchAllDiagnosticsForExport,
  fetchAllKbForExport,
  downloadBlob,
  toJsonBlob,
  toCsvBlob,
} from '@/src/services/platformIntelligenceService';
import type {
  PlatformIntelligenceStats,
  PlatformDiagnosticRow,
  PlatformKbRow,
} from '@/src/types/platformIntelligence';

const PAGE_SIZE = 25;

type ActiveTab = 'diagnostics' | 'kb';

interface TenantOption { id: string; name: string; slug: string; }

export default function PlatformIntelligence() {
  const [stats, setStats]             = useState<PlatformIntelligenceStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [activeTab, setActiveTab]     = useState<ActiveTab>('diagnostics');

  const [tenants, setTenants]         = useState<TenantOption[]>([]);
  const [tenantFilter, setTenantFilter] = useState<string>('');
  const [stFilter, setStFilter]       = useState<string>('');
  const [search, setSearch]           = useState('');

  const [diagRows, setDiagRows]       = useState<PlatformDiagnosticRow[]>([]);
  const [diagPage, setDiagPage]       = useState(0);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagHasMore, setDiagHasMore] = useState(true);

  const [kbRows, setKbRows]           = useState<PlatformKbRow[]>([]);
  const [kbPage, setKbPage]           = useState(0);
  const [kbLoading, setKbLoading]     = useState(false);
  const [kbHasMore, setKbHasMore]     = useState(true);

  const [exporting, setExporting]     = useState(false);

  // ── Carregar stats (também registra visita na auditoria) ──────────────────
  useEffect(() => {
    setStatsLoading(true);
    getIntelligenceStats()
      .then(setStats)
      .catch((err: Error) => toast.error('Erro ao carregar métricas', { description: err.message }))
      .finally(() => setStatsLoading(false));
  }, []);

  // ── Carregar lista de tenants para o filtro ───────────────────────────────
  useEffect(() => {
    supabase.rpc('get_platform_tenants').then(({ data }) => {
      setTenants(
        ((data ?? []) as TenantOption[]).map((t: any) => ({ id: t.id, name: t.name, slug: t.slug }))
      );
    });
  }, []);

  // ── Fetch de diagnósticos ─────────────────────────────────────────────────
  const loadDiag = useCallback(async (page: number, reset: boolean) => {
    setDiagLoading(true);
    try {
      const rows = await getDiagnosticCorpus({
        tenantId:    tenantFilter || null,
        serviceType: stFilter     || null,
        limit:       PAGE_SIZE,
        offset:      page * PAGE_SIZE,
      });
      setDiagRows(prev => reset ? rows : [...prev, ...rows]);
      setDiagHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) {
      toast.error('Erro ao carregar diagnósticos', { description: err.message });
    } finally {
      setDiagLoading(false);
    }
  }, [tenantFilter, stFilter]);

  // ── Fetch de artigos KB ───────────────────────────────────────────────────
  const loadKb = useCallback(async (page: number, reset: boolean) => {
    setKbLoading(true);
    try {
      const rows = await getKbCorpus({
        tenantId:    tenantFilter || null,
        serviceType: stFilter     || null,
        limit:       PAGE_SIZE,
        offset:      page * PAGE_SIZE,
      });
      setKbRows(prev => reset ? rows : [...prev, ...rows]);
      setKbHasMore(rows.length === PAGE_SIZE);
    } catch (err: any) {
      toast.error('Erro ao carregar artigos', { description: err.message });
    } finally {
      setKbLoading(false);
    }
  }, [tenantFilter, stFilter]);

  // Recarrega ao mudar filtros ou aba
  useEffect(() => {
    if (activeTab === 'diagnostics') { setDiagPage(0); loadDiag(0, true); }
    else                             { setKbPage(0);   loadKb(0, true);   }
  }, [activeTab, tenantFilter, stFilter, loadDiag, loadKb]);

  // ── Filtro de busca local ─────────────────────────────────────────────────
  const filteredDiag = search
    ? diagRows.filter(r =>
        [r.reported_problem, r.final_diagnosis, r.preliminary_diagnosis, r.technical_recommendation]
          .some(f => f?.toLowerCase().includes(search.toLowerCase()))
      )
    : diagRows;

  const filteredKb = search
    ? kbRows.filter(r =>
        [r.title, r.content].some(f => f?.toLowerCase().includes(search.toLowerCase()))
      )
    : kbRows;

  // ── Export ────────────────────────────────────────────────────────────────
  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true);
    try {
      if (activeTab === 'diagnostics') {
        const all = await fetchAllDiagnosticsForExport({
          tenantId: tenantFilter || null, serviceType: stFilter || null,
        });
        const blob = format === 'json' ? toJsonBlob(all) : toCsvBlob(all as any);
        downloadBlob(blob, `nextai-diagnostics-${Date.now()}.${format}`);
        await logExport('diagnostics', tenantFilter || null, all.length);
        toast.success(`${all.length} diagnósticos exportados.`);
      } else {
        const all = await fetchAllKbForExport({
          tenantId: tenantFilter || null, serviceType: stFilter || null,
        });
        const blob = format === 'json' ? toJsonBlob(all) : toCsvBlob(all as any);
        downloadBlob(blob, `nextai-kb-${Date.now()}.${format}`);
        await logExport('kb', tenantFilter || null, all.length);
        toast.success(`${all.length} artigos exportados.`);
      }
    } catch (err: any) {
      toast.error('Erro ao exportar', { description: err.message });
    } finally {
      setExporting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 h-full w-full pb-8 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Brain className="h-6 w-6 text-primary" />
            Inteligência
          </h1>
          <p className="text-sm text-muted-foreground">
            Corpus técnico cross-tenant para treinar a IA do NextAI.
          </p>
        </div>
      </div>

      {/* Banner de transparência */}
      <div className="flex items-start gap-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3">
        <ShieldCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 shrink-0" />
        <p className="text-sm text-blue-800 dark:text-blue-300">
          Todos os dados aqui são <strong>anonimizados</strong>: sem nomes de técnicos ou clientes,
          sem notas internas e sem localização GPS. Coletados exclusivamente para melhoria contínua
          da IA do NextAI.
        </p>
      </div>

      {/* Cards de métricas */}
      {statsLoading ? (
        <div className="flex items-center justify-center h-28">
          <Loader2 className="h-7 w-7 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'OS no Corpus',         value: stats.total_reports,        icon: Stethoscope, color: 'text-indigo-500' },
            { label: 'Com Diagnóstico IA',    value: stats.reports_with_diag,    icon: Brain,       color: 'text-violet-500' },
            { label: 'Artigos KB',            value: stats.total_kb,             icon: BookOpen,    color: 'text-emerald-500' },
            { label: 'Tenants Contribuindo',  value: stats.tenants_contributing, icon: Building2,   color: 'text-amber-500' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
              <div className={`p-2 rounded-lg bg-muted ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {/* Breakdown por tipo de serviço */}
      {stats && stats.by_service_type.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
            <BarChart3 className="h-3.5 w-3.5" /> OS por Tipo de Serviço
          </p>
          <div className="flex flex-wrap gap-2">
            {stats.by_service_type.map(({ service_type, n }) => (
              <Badge key={service_type} variant="secondary" className="text-sm font-semibold">
                {service_type} — {n}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {([
          { id: 'diagnostics', label: 'Diagnósticos (OS)', icon: Stethoscope },
          { id: 'kb',          label: 'Base de Conhecimento', icon: BookOpen },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setSearch(''); }}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === id
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Filtros + Export */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-2 flex-1">
          {/* Filtro tenant */}
          <Select value={tenantFilter} onValueChange={v => { setTenantFilter(v === '_all' ? '' : v); }}>
            <SelectTrigger className="h-9 w-44 rounded-lg text-sm">
              <SelectValue placeholder="Todas as empresas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todas as empresas</SelectItem>
              {tenants.map(t => (
                <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Filtro service_type */}
          <Select value={stFilter} onValueChange={v => { setStFilter(v === '_all' ? '' : v); }}>
            <SelectTrigger className="h-9 w-44 rounded-lg text-sm">
              <SelectValue placeholder="Todos os tipos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="_all">Todos os tipos</SelectItem>
              {(stats?.by_service_type ?? []).map(({ service_type }) => (
                <SelectItem key={service_type} value={service_type}>{service_type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Busca local */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar no corpus..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 pl-8 rounded-lg text-sm w-52"
            />
          </div>
        </div>

        {/* Botões de export */}
        <div className="flex gap-2 shrink-0">
          <Button
            size="sm" variant="outline"
            className="h-9 rounded-lg gap-1.5 font-semibold"
            onClick={() => handleExport('json')}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileJson className="h-3.5 w-3.5" />}
            JSON
          </Button>
          <Button
            size="sm" variant="outline"
            className="h-9 rounded-lg gap-1.5 font-semibold"
            onClick={() => handleExport('csv')}
            disabled={exporting}
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
            CSV
          </Button>
          <Button
            size="sm"
            className="h-9 rounded-lg gap-1.5 font-semibold"
            onClick={() => handleExport('json')}
            disabled={exporting}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar corpus
          </Button>
        </div>
      </div>

      {/* ── Tabela de Diagnósticos ─────────────────────────────────────────── */}
      {activeTab === 'diagnostics' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {diagLoading && diagRows.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Problema Relatado</TableHead>
                    <TableHead className="font-semibold">Diagnóstico Final</TableHead>
                    <TableHead className="font-semibold">Recomendação</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Data OS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDiag.map(r => (
                    <TableRow key={r.report_id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="whitespace-nowrap">
                        <Badge variant="outline" className="text-xs">{r.service_type ?? '—'}</Badge>
                      </TableCell>
                      <TableCell className="text-sm max-w-[220px]">
                        <p className="line-clamp-3 text-muted-foreground">{r.reported_problem ?? '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm max-w-[260px]">
                        <p className="line-clamp-3">{r.final_diagnosis ?? r.preliminary_diagnosis ?? '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm max-w-[220px]">
                        <p className="line-clamp-3 text-muted-foreground">{r.technical_recommendation ?? r.services_performed ?? '—'}</p>
                      </TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {r.service_date
                          ? format(new Date(r.service_date), 'dd MMM yy', { locale: ptBR })
                          : '—'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredDiag.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {search ? 'Nenhum resultado para a busca.' : 'Nenhuma OS aprovada no corpus ainda.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {diagHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button
                variant="outline" size="sm"
                className="h-9 rounded-lg font-semibold"
                disabled={diagLoading}
                onClick={() => { const next = diagPage + 1; setDiagPage(next); loadDiag(next, false); }}
              >
                {diagLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Tabela de KB ──────────────────────────────────────────────────── */}
      {activeTab === 'kb' && (
        <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
          {kbLoading && kbRows.length === 0 ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/40">
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="font-semibold">Título</TableHead>
                    <TableHead className="font-semibold">Tipo</TableHead>
                    <TableHead className="font-semibold">Tags</TableHead>
                    <TableHead className="font-semibold">Visualizações</TableHead>
                    <TableHead className="font-semibold whitespace-nowrap">Criado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredKb.map(r => (
                    <TableRow key={r.article_id} className="hover:bg-muted/50 transition-colors border-border align-top">
                      <TableCell className="font-medium text-sm max-w-[280px]">
                        <p className="line-clamp-2">{r.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{r.content}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{r.service_type ?? '—'}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <div className="flex flex-wrap gap-1">
                          {(r.tags ?? []).slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-xs">{tag}</Badge>
                          ))}
                          {(r.tags ?? []).length > 3 && (
                            <Badge variant="secondary" className="text-xs">+{r.tags.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.view_count}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap text-muted-foreground">
                        {format(new Date(r.created_at), 'dd MMM yy', { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredKb.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                        {search ? 'Nenhum resultado para a busca.' : 'Nenhum artigo ativo no corpus ainda.'}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
          {kbHasMore && !search && (
            <div className="p-4 border-t border-border flex justify-center">
              <Button
                variant="outline" size="sm"
                className="h-9 rounded-lg font-semibold"
                disabled={kbLoading}
                onClick={() => { const next = kbPage + 1; setKbPage(next); loadKb(next, false); }}
              >
                {kbLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Carregar mais
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
