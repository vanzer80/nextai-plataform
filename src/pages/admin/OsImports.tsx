import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronDown, ChevronRight, RotateCcw, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';

// ── Tipos ──────────────────────────────────────────────────────────────────────

interface OsImportLogEntry {
  id: string;
  team_id: string;
  api_key_id: string | null;
  external_source: string;
  external_ref_id: string | null;
  import_mode: 'json' | 'pdf';
  status: 'pending' | 'success' | 'failed' | 'duplicate';
  os_id: string | null;
  client_resolution: string | null;
  technician_resolution: string | null;
  error_detail: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

// ── Constantes visuais ────────────────────────────────────────────────────────

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  success:   { label: 'Sucesso',    className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  failed:    { label: 'Falha',      className: 'bg-red-100 text-red-800 border-red-200' },
  duplicate: { label: 'Duplicado',  className: 'bg-amber-100 text-amber-800 border-amber-200' },
  pending:   { label: 'Pendente',   className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  totvs:  { label: 'TOTVS',  className: 'bg-blue-100 text-blue-800 border-blue-200' },
  sap:    { label: 'SAP',    className: 'bg-violet-100 text-violet-800 border-violet-200' },
  omie:   { label: 'Omie',   className: 'bg-sky-100 text-sky-800 border-sky-200' },
  pdf:    { label: 'PDF',    className: 'bg-orange-100 text-orange-800 border-orange-200' },
  custom: { label: 'Custom', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const CLIENT_RES_LABEL: Record<string, string> = {
  matched_cnpj:  'CNPJ',
  matched_name:  'Nome',
  auto_created:  'Criado auto',
  not_found:     '—',
};

const TECH_RES_LABEL: Record<string, string> = {
  matched_email: 'Email',
  matched_name:  'Nome',
  not_found:     '—',
};

// ── Componente ────────────────────────────────────────────────────────────────

export default function OsImports() {
  const [entries, setEntries]         = useState<OsImportLogEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [expandedId, setExpandedId]   = useState<string | null>(null);
  const [filterStatus, setFilterStatus]   = useState<string>('all');
  const [filterSource, setFilterSource]   = useState<string>('all');
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    let q = supabase
      .from('os_import_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (filterStatus !== 'all') q = q.eq('status', filterStatus);
    if (filterSource !== 'all') q = q.eq('external_source', filterSource);

    const { data, error } = await q;
    if (error) {
      toast.error('Erro ao carregar importações.');
    } else {
      setEntries((data as OsImportLogEntry[]) ?? []);
    }
    setLoading(false);
  }, [filterStatus, filterSource]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  };

  // Reprocessar: copia o payload sanitizado para a área de transferência
  // e orienta o usuário a reenviar via API (payload salvo não tem pdf_base64
  // por segurança — o usuário deve reenviar o payload original completo).
  const handleReprocess = async (entry: OsImportLogEntry) => {
    if (reprocessingId) return;
    setReprocessingId(entry.id);
    try {
      const payload = JSON.stringify(entry.raw_payload ?? {}, null, 2);
      await navigator.clipboard.writeText(payload);
      toast.info('Payload copiado', {
        description: 'Cole no seu cliente de API e reenvie para /functions/v1/os-import-processor com X-API-Key e o pdf_base64 original se necessário.',
        duration: 8000,
      });
    } catch {
      toast.error('Não foi possível copiar o payload.');
    } finally {
      setReprocessingId(null);
    }
  };

  const uniqueSources: string[] = Array.from(new Set(entries.map(e => e.external_source)));

  return (
    <div className="flex flex-col gap-6 p-4 md:p-6 max-w-7xl mx-auto" data-onboarding="os-imports-page">

      {/* Cabeçalho */}
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Importação de OS</h1>
        <p className="text-sm text-muted-foreground">
          Log de OSs recebidas de sistemas externos via API. OSs importadas ficam disponíveis
          imediatamente para gerar orçamento com um clique.
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center" data-onboarding="os-imports-filters">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os status</SelectItem>
            <SelectItem value="success">Sucesso</SelectItem>
            <SelectItem value="failed">Falha</SelectItem>
            <SelectItem value="duplicate">Duplicado</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-40 h-9">
            <SelectValue placeholder="Sistema" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os sistemas</SelectItem>
            {uniqueSources.map(s => (
              <SelectItem key={s} value={s}>
                {SOURCE_BADGE[s]?.label ?? s}
              </SelectItem>
            ))}
            {uniqueSources.length === 0 && (
              <>
                <SelectItem value="totvs">TOTVS</SelectItem>
                <SelectItem value="sap">SAP</SelectItem>
                <SelectItem value="omie">Omie</SelectItem>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>

        <Button variant="outline" size="sm" onClick={fetchEntries} className="h-9">
          Atualizar
        </Button>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <p className="text-muted-foreground text-sm">Nenhuma importação encontrada.</p>
          <p className="text-xs text-muted-foreground max-w-md">
            Envie OSs via <code className="bg-muted px-1 rounded text-xs">POST /functions/v1/os-import-processor</code> com
            header <code className="bg-muted px-1 rounded text-xs">X-API-Key</code> e escopo <code className="bg-muted px-1 rounded text-xs">orders:write</code>.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {/* Header da tabela */}
          <div className="hidden md:grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_auto] gap-x-3 px-4 py-2 bg-muted/40 border-b border-border text-xs font-medium text-muted-foreground">
            <span className="w-4" />
            <span>Data/Hora</span>
            <span>Sistema</span>
            <span>Ref. Externa</span>
            <span>Status</span>
            <span>Cliente</span>
            <span>OS Criada</span>
            <span>Modo</span>
          </div>

          {/* Linhas */}
          {entries.map(entry => {
            const isExpanded = expandedId === entry.id;
            const statusBadge = STATUS_BADGE[entry.status] ?? STATUS_BADGE.pending;
            const sourceBadge = SOURCE_BADGE[entry.external_source] ?? SOURCE_BADGE.custom;
            return (
              <div key={entry.id} className="border-b border-border last:border-0">
                {/* Linha principal */}
                <button
                  type="button"
                  onClick={() => toggleExpand(entry.id)}
                  className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors"
                >
                  <div className="grid md:grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_1fr_auto] grid-cols-1 gap-x-3 gap-y-1 items-center">
                    {/* Expand icon */}
                    <span className="hidden md:block text-muted-foreground">
                      {isExpanded
                        ? <ChevronDown className="h-3.5 w-3.5" />
                        : <ChevronRight className="h-3.5 w-3.5" />
                      }
                    </span>

                    {/* Data/Hora */}
                    <span className="text-xs text-foreground font-mono">
                      {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
                    </span>

                    {/* Sistema */}
                    <span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${sourceBadge.className}`}>
                        {sourceBadge.label}
                      </Badge>
                    </span>

                    {/* Ref. Externa */}
                    <span className="text-xs font-mono text-foreground truncate max-w-[140px]" title={entry.external_ref_id ?? ''}>
                      {entry.external_ref_id ?? '—'}
                    </span>

                    {/* Status */}
                    <span>
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusBadge.className}`}>
                        {statusBadge.label}
                      </Badge>
                    </span>

                    {/* Cliente resolvido */}
                    <span className="text-xs text-muted-foreground">
                      {entry.client_resolution ? (CLIENT_RES_LABEL[entry.client_resolution] ?? entry.client_resolution) : '—'}
                    </span>

                    {/* OS Criada */}
                    <span>
                      {entry.os_id ? (
                        <Link
                          to={`/reports/${entry.os_id}`}
                          onClick={e => e.stopPropagation()}
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          Ver OS
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </span>

                    {/* Modo */}
                    <span className="text-xs text-muted-foreground uppercase font-mono">
                      {entry.import_mode}
                    </span>
                  </div>
                </button>

                {/* Linha expandida */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-1 bg-muted/20 border-t border-border/50 flex flex-col gap-3">

                    {/* Resoluções */}
                    <div className="flex flex-wrap gap-4 text-xs">
                      <div>
                        <span className="text-muted-foreground">Cliente: </span>
                        <span className="font-medium">{CLIENT_RES_LABEL[entry.client_resolution ?? ''] ?? entry.client_resolution ?? '—'}</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Técnico: </span>
                        <span className="font-medium">{TECH_RES_LABEL[entry.technician_resolution ?? ''] ?? entry.technician_resolution ?? '—'}</span>
                      </div>
                    </div>

                    {/* Erro */}
                    {entry.error_detail && (
                      <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                        <p className="text-xs font-medium text-red-700 mb-1">Detalhe do erro</p>
                        <pre className="text-xs text-red-600 whitespace-pre-wrap break-all font-mono">
                          {entry.error_detail}
                        </pre>
                      </div>
                    )}

                    {/* Payload */}
                    {entry.raw_payload && (
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-3">
                        <p className="text-xs font-medium text-slate-700 mb-1">Payload (sanitizado)</p>
                        <pre className="text-xs text-slate-600 whitespace-pre-wrap break-all font-mono max-h-48 overflow-y-auto">
                          {JSON.stringify(entry.raw_payload, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* Botão Reprocessar — apenas status failed */}
                    {entry.status === 'failed' && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReprocess(entry)}
                          disabled={reprocessingId === entry.id}
                          className="h-8 text-xs gap-1.5"
                          data-onboarding="os-imports-reprocessar"
                        >
                          <RotateCcw className="h-3 w-3" />
                          Reprocessar (copiar payload)
                        </Button>
                        <p className="text-xs text-muted-foreground">
                          Copia o payload para reenvio via API. Inclua o pdf_base64 original se necessário.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
