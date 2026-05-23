import React, { useState, useEffect, useRef, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Download, FileText, Loader2 } from 'lucide-react';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { extractStoragePath, batchSignedUrls } from '@/src/lib/storage';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Components
import ReimbursementTable from './components/ReimbursementTable';
import ReimbursementCard from './components/ReimbursementCard';
import ReimbursementDetailModal from './components/ReimbursementDetailModal';

export default function ReimbursementsList() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const isManager = ['Gestor', 'Admin', 'Financeiro', 'Master', 'Supervisor'].some(r => user?.role?.includes(r));
  const isFinanceiro = ['Financeiro', 'Admin', 'Master'].some(r => user?.role?.includes(r));

  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const itemsPerPage = 20;

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  const fetchReimbursementsRef = useRef<() => void>(() => {});

  const fetchReimbursements = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('reimbursements')
        .select(`
          id, created_at, category, amount, status, receipt_url,
          user_id, description, maintenance_type, client_id, branch, budget,
          favorecido, pix_key, rejection_reason, revision_reason,
          paid_at, paid_by,
          clients(name),
          users:user_id(full_name)
        `)
        .order('created_at', { ascending: false })
        .range(page * itemsPerPage, (page + 1) * itemsPerPage - 1);

      if (!isManager) {
        query = query.eq('user_id', user?.id);
      }

      const { data: result, error } = await query;
      if (error) throw error;

      if (result) {
        const rawItems = result.map(item => ({
          ...item,
          users: Array.isArray(item.users) ? item.users[0] : item.users,
        }));

        // Batch-resolve signed URLs for all receipt_url values (handles both old full URLs and new paths)
        const uniquePaths: string[] = [...new Set<string>(
          rawItems
            .filter(item => typeof item.receipt_url === 'string')
            .map(item => extractStoragePath(item.receipt_url as string, 'reimbursements_media'))
        )];
        const signedMap = await batchSignedUrls(uniquePaths, 'reimbursements_media');

        const processed = rawItems.map(item => ({
          ...item,
          receipt_url: item.receipt_url
            ? (signedMap[extractStoragePath(item.receipt_url, 'reimbursements_media')] || item.receipt_url)
            : null,
        }));

        if (page === 0) {
          setData(processed);
        } else {
          setData(prev => [...prev, ...processed]);
        }
        setHasMore(result.length === itemsPerPage);
      }
    } catch (err: any) {
      toast.error('Erro ao listar reembolsos.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReimbursementsRef.current = fetchReimbursements; });

  // Canal Realtime — sem `page` nas deps para não re-criar o canal a cada troca de página
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase.channel('realtime_reimbursements')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reimbursements' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          if (isManager || payload.new.user_id === user?.id) {
            setPage(0);
            fetchReimbursementsRef.current();
            if (isManager) toast.info('Nova solicitação de reembolso recebida!');
          }
        } else if (payload.eventType === 'UPDATE') {
          setData(prev => prev.map(item => item.id === payload.new.id ? { ...item, ...payload.new } : item));
          setSelectedItem((prev: any) => prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev);
          if (payload.new.user_id === user?.id && payload.old.status !== payload.new.status) {
            toast.info(`Status do reembolso alterado para: ${payload.new.status}`);
          }
        } else if (payload.eventType === 'DELETE') {
          setData(prev => prev.filter(item => item.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, isManager]);

  // Fetch — reage à troca de página
  useEffect(() => {
    if (user?.id) fetchReimbursements();
  }, [user?.id, isManager, page]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Aprovado':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300 border-0 text-xs font-semibold">Aprovado</Badge>;
      case 'Pago':
        return <Badge className="bg-violet-100 text-violet-800 dark:bg-violet-900/50 dark:text-violet-300 border-0 text-xs font-semibold">Pago</Badge>;
      case 'Rejeitado':
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-900/50 dark:text-rose-300 border-0 text-xs font-semibold">Rejeitado</Badge>;
      case 'Revisao':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300 border-0 text-xs font-semibold">Em Revisão</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300 border-0 text-xs font-semibold">Pendente</Badge>;
    }
  };

  const handleAction = async (id: string, action: 'Aprovado' | 'Rejeitado' | 'Revisao' | 'Pago', reason?: string) => {
    try {
      const { data: rpcResult, error: rpcError } = await supabase.rpc(
        'process_reimbursement_action',
        {
          p_reimbursement_id: id,
          p_action: action,
          p_reason: reason || null,
        }
      );

      if (rpcError) throw new Error(rpcError.message);
      if (rpcResult && rpcResult.success === false) throw new Error(rpcResult.error);

      const msgs: Record<string, string> = {
        'Aprovado': 'Reembolso aprovado!',
        'Rejeitado': 'Reembolso reprovado.',
        'Revisao': 'Solicitação devolvida para ajuste.',
        'Pago': 'Pagamento confirmado!',
      };
      toast.success(msgs[action] ?? 'Ação realizada.');
      setIsModalOpen(false);
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`);
    }
  };

  const handleBulkAction = async (action: 'Aprovado') => {
    if (selectedIds.length === 0) return;
    
    try {
      setIsBulkProcessing(true);
      const toastId = toast.loading(`Processando ${selectedIds.length} reembolsos...`);
      
      const results = await Promise.all(
        selectedIds.map(id => 
          supabase.rpc('process_reimbursement_action', {
            p_reimbursement_id: id,
            p_action: action,
            p_reason: null
          })
        )
      );

      const errors = results.filter(r => r.error);
      if (errors.length > 0) {
        toast.error(`${errors.length} reembolsos falharam ao ser processados.`, { id: toastId });
      } else {
        toast.success(`${selectedIds.length} reembolsos aprovados com sucesso!`, { id: toastId });
      }
      
      setSelectedIds([]);
      fetchReimbursements();
    } catch (err) {
      toast.error("Erro no processamento em lote.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const onSelectAll = (checked: boolean) => {
    if (checked) {
      const actionable = filteredData
        .filter(item => item.status === 'Pendente' || item.status === 'Revisao')
        .map(item => item.id);
      setSelectedIds(actionable);
    } else {
      setSelectedIds([]);
    }
  };

  const onSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const filteredData = data.filter(item => {
    if (statusFilter !== 'all' && item.status !== statusFilter) return false;
    if (dateFrom) {
      const itemDate = new Date(item.created_at).toISOString().split('T')[0];
      if (itemDate < dateFrom) return false;
    }
    if (dateTo) {
      const itemDate = new Date(item.created_at).toISOString().split('T')[0];
      if (itemDate > dateTo) return false;
    }
    return true;
  });

  const totals = filteredData.reduce((acc, item) => {
    const amount = Number(item.amount);
    acc[item.status] = (acc[item.status] || 0) + amount;
    acc.total += amount;
    return acc;
  }, { total: 0 } as Record<string, number>);

  const handleExportExcel = () => {
    try {
      const exportData = filteredData.map(item => ({
        'ID': item.id,
        'Data': new Date(item.created_at).toLocaleDateString(),
        'Colaborador': item.users?.full_name || 'Desconhecido',
        'Categoria': item.category,
        'Descricao': item.description || '-',
        'Tipo Manutencao': item.maintenance_type || '-',
        'Cliente': item.clients?.name || '-',
        'Filial': item.branch || '-',
        'Orcamento': item.budget || '-',
        'Favorecido': item.favorecido || '-',
        'Chave PIX': item.pix_key || '-',
        'Valor (R$)': Number(item.amount),
        'Status': item.status,
        'Comprovante': item.receipt_url || 'Sem anexo',
      }));
      const ws = XLSX.utils.json_to_sheet(exportData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Reembolsos");
      XLSX.writeFile(wb, `Reembolsos_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.xlsx`);
      toast.success("Excel exportado!");
    } catch (error) {
      toast.error("Erro ao exportar.");
    }
  };

  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      const pageW = doc.internal.pageSize.getWidth();
      const now = new Date();
      const dateStr = now.toLocaleDateString('pt-BR');
      const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

      // Cabeçalho
      doc.setFillColor(30, 58, 138); // azul escuro
      doc.rect(0, 0, pageW, 22, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(tenant?.name ?? 'Portal', 14, 10);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text('Relatorio de Reembolsos e Despesas', 14, 17);
      doc.setFontSize(9);
      doc.text(`Gerado em: ${dateStr} as ${timeStr}`, pageW - 14, 17, { align: 'right' });

      // Filtros aplicados
      doc.setTextColor(80, 80, 80);
      doc.setFontSize(8);
      const filtros: string[] = [];
      if (statusFilter !== 'all') filtros.push(`Status: ${statusFilter}`);
      if (dateFrom) filtros.push(`De: ${new Date(dateFrom).toLocaleDateString('pt-BR')}`);
      if (dateTo) filtros.push(`Ate: ${new Date(dateTo).toLocaleDateString('pt-BR')}`);
      if (filtros.length > 0) {
        doc.text(`Filtros: ${filtros.join('  |  ')}`, 14, 28);
      }

      // Tabela principal
      const columns = isManager
        ? ['Data', 'Colaborador', 'Categoria', 'Cliente', 'Filial', 'Valor (R$)', 'Status']
        : ['Data', 'Categoria', 'Descricao', 'Favorecido', 'Valor (R$)', 'Status'];

      const rows = filteredData.map(item => {
        const valor = `R$ ${Number(item.amount).toFixed(2).replace('.', ',')}`;
        if (isManager) {
          return [
            new Date(item.created_at).toLocaleDateString('pt-BR'),
            item.users?.full_name || '-',
            item.category,
            item.clients?.name || '-',
            item.branch || '-',
            valor,
            item.status,
          ];
        }
        return [
          new Date(item.created_at).toLocaleDateString('pt-BR'),
          item.category,
          item.description || '-',
          item.favorecido || '-',
          valor,
          item.status,
        ];
      });

      const statusColors: Record<string, [number, number, number]> = {
        'Aprovado':  [209, 250, 229],
        'Pago':      [237, 233, 254],
        'Rejeitado': [255, 228, 230],
        'Revisao':   [255, 237, 213],
        'Pendente':  [254, 243, 199],
      };

      autoTable(doc, {
        startY: filtros.length > 0 ? 32 : 26,
        head: [columns],
        body: rows,
        theme: 'grid',
        headStyles: {
          fillColor: [30, 58, 138],
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
        },
        bodyStyles: { fontSize: 8, textColor: [30, 30, 30] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          [columns.length - 2]: { halign: 'right', fontStyle: 'bold' }, // Valor
          [columns.length - 1]: { halign: 'center' }, // Status
        },
        didParseCell: (data) => {
          if (data.section === 'body' && data.column.index === columns.length - 1) {
            const status = String(data.cell.raw);
            const color = statusColors[status] || [248, 250, 252];
            data.cell.styles.fillColor = color;
            data.cell.styles.fontStyle = 'bold';
          }
        },
        margin: { left: 14, right: 14 },
      });

      // Rodapé com totais
      const finalY = (doc as any).lastAutoTable.finalY + 6;
      const totalItems = filteredData.length;
      const totalGeral = totals.total || 0;
      const totalAprovado = totals['Aprovado'] || 0;
      const totalPendente = totals['Pendente'] || 0;
      const totalRejeitado = totals['Rejeitado'] || 0;

      doc.setFillColor(248, 250, 252);
      doc.roundedRect(14, finalY, pageW - 28, 18, 2, 2, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(14, finalY, pageW - 28, 18, 2, 2, 'D');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 30, 30);
      doc.text(`Total de registros: ${totalItems}`, 18, finalY + 6);
      doc.setTextColor(180, 83, 9);
      doc.text(`Pendente: R$ ${totalPendente.toFixed(2).replace('.', ',')}`, 18, finalY + 13);
      doc.setTextColor(4, 120, 87);
      doc.text(`Aprovado: R$ ${totalAprovado.toFixed(2).replace('.', ',')}`, 80, finalY + 13);
      doc.setTextColor(190, 18, 60);
      doc.text(`Rejeitado: R$ ${totalRejeitado.toFixed(2).replace('.', ',')}`, 155, finalY + 13);
      doc.setTextColor(30, 58, 138);
      doc.text(`TOTAL GERAL: R$ ${totalGeral.toFixed(2).replace('.', ',')}`, pageW - 18, finalY + 13, { align: 'right' });

      // Numeração de páginas
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(150, 150, 150);
        doc.text(`Pagina ${i} de ${totalPages}  |  ${tenant?.name ?? 'Portal'}`, pageW / 2, doc.internal.pageSize.getHeight() - 5, { align: 'center' });
      }

      const filename = `Reembolsos_${now.toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
      doc.save(filename);
      toast.success('PDF exportado com sucesso!');
    } catch (error) {
      console.error(error);
      toast.error('Erro ao gerar PDF.');
    }
  };

  return (
    <div className="min-h-full w-full flex flex-col gap-6 pb-6 animate-in fade-in duration-300">
      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Reembolsos e Despesas</h1>
          <p className="text-sm text-slate-600">{isManager ? 'Gestão financeira' : 'Minhas solicitações'}</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          {isManager && (
            <>
              <Button onClick={handleExportExcel} variant="outline" className="flex-1 sm:flex-none h-11 px-4 rounded-xl font-semibold shadow-sm">
                <Download className="w-4 h-4 mr-2" /> Excel
              </Button>
              <Button onClick={handleExportPDF} variant="outline" className="flex-1 sm:flex-none h-11 px-4 rounded-xl font-semibold shadow-sm border-rose-200 text-rose-700 hover:bg-rose-50">
                <FileText className="w-4 h-4 mr-2" /> PDF
              </Button>
            </>
          )}
          <Link to="/reimbursements/new" data-onboarding="reimb-novo" className="inline-flex items-center justify-center text-white flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 h-11 px-6 rounded-xl shadow-sm font-semibold transition-colors">
            <Plus className="mr-2 h-5 w-5" /> {isManager ? 'Novo' : 'Solicitar'}
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: 'Pendente',  val: totals['Pendente'],  card: 'bg-amber-50 border border-amber-200',     lbl: 'text-amber-600',   num: 'text-amber-800'   },
          { label: 'Aprovado',  val: totals['Aprovado'],  card: 'bg-emerald-50 border border-emerald-200', lbl: 'text-emerald-600', num: 'text-emerald-800' },
          { label: 'Pago',      val: totals['Pago'],      card: 'bg-violet-50 border border-violet-200',   lbl: 'text-violet-600',  num: 'text-violet-800'  },
          { label: 'Rejeitado', val: totals['Rejeitado'], card: 'bg-rose-50 border border-rose-200',       lbl: 'text-rose-600',    num: 'text-rose-800'    },
          { label: 'Total',     val: totals.total,        card: 'bg-blue-50 border border-blue-200',       lbl: 'text-blue-600',    num: 'text-blue-800'    },
        ].map(t => (
          <div key={t.label} className={`${t.card} rounded-xl p-3 text-center`}>
            <p className={`text-xs font-semibold ${t.lbl} uppercase`}>{t.label}</p>
            <p className={`text-lg font-extrabold ${t.num}`}>R$ {(t.val || 0).toFixed(2).replace('.', ',')}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 bg-card p-4 rounded-xl border border-border shadow-sm">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="Pendente">Pendente</SelectItem>
              <SelectItem value="Aprovado">Aprovado</SelectItem>
              <SelectItem value="Pago">Pago</SelectItem>
              <SelectItem value="Rejeitado">Rejeitado</SelectItem>
              <SelectItem value="Revisao">Em Revisão</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Início</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-10 rounded-lg" />
        </div>
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-500 uppercase mb-1 block">Fim</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-10 rounded-lg" />
        </div>
      </div>

      {loading && page === 0 ? (
        <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : (
        <>
          <div className="lg:hidden">
            {filteredData.map((item, i) => (
              <Fragment key={item.id}>
                <div data-onboarding={i === 0 ? 'reimb-card-primeiro' : undefined}>
                  <ReimbursementCard
                    item={item} user={user} isManager={isManager}
                    getStatusBadge={getStatusBadge} onOpenDetails={() => { setSelectedItem(item); setIsModalOpen(true); }}
                  />
                </div>
              </Fragment>
            ))}
          </div>

          <div className="hidden lg:block">
            <ReimbursementTable
              data={filteredData} isManager={isManager} user={user}
              getStatusBadge={getStatusBadge} onAction={handleAction}
              onOpenDetails={(item) => { setSelectedItem(item); setIsModalOpen(true); }}
              onOpenReject={(item) => { setSelectedItem(item); setIsModalOpen(true); }}
              onOpenReturn={(item) => { setSelectedItem(item); setIsModalOpen(true); }}
              selectedIds={selectedIds}
              onSelectAll={onSelectAll}
              onSelectOne={onSelectOne}
              canPay={isFinanceiro}
            />
          </div>

          {/* Barra Flutuante de Ações em Lote */}
          {selectedIds.length > 0 && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 z-50 animate-in fade-in slide-in-from-bottom-4">
              <div className="flex flex-col">
                <span className="text-sm font-bold">{selectedIds.length} selecionados</span>
                <span className="text-[10px] text-slate-400 uppercase tracking-widest">Ações em lote</span>
              </div>
              <div className="h-8 w-px bg-slate-700"></div>
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setSelectedIds([])}
                  className="text-slate-300 hover:text-white hover:bg-slate-800 font-bold"
                >
                  Cancelar
                </Button>
                <Button 
                  size="sm" 
                  onClick={() => handleBulkAction('Aprovado')}
                  disabled={isBulkProcessing}
                  className="bg-emerald-600 hover:bg-emerald-700 font-bold min-w-[120px]"
                >
                  {isBulkProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Aprovar Todos'}
                </Button>
              </div>
            </div>
          )}

          {hasMore && (
            <div className="flex justify-center mt-4">
              <Button variant="outline" onClick={() => setPage(p => p + 1)} className="rounded-xl border-slate-200 text-blue-600 font-bold hover:bg-blue-50">
                Carregar mais
              </Button>
            </div>
          )}
        </>
      )}

      <ReimbursementDetailModal
        isOpen={isModalOpen} onOpenChange={setIsModalOpen} item={selectedItem}
        isManager={isManager} onAction={handleAction} getStatusBadge={getStatusBadge}
        currentUserId={user?.id} isFinanceiro={isFinanceiro}
      />
    </div>
  );
}



