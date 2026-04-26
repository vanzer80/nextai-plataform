import React, { useState, useEffect } from 'react';
import { 
  XCircle, Receipt, User as UserIcon, Paperclip, Copy, Check, RotateCcw, 
  CheckCircle, Pencil, History, Clock
} from 'lucide-react';
import { 
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import clsx from 'clsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HistoryItem {
  id: string;
  old_status: string;
  new_status: string;
  reason: string;
  created_at: string;
  changed_by: string;
}

interface ReimbursementDetailModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  item: any;
  isManager: boolean;
  onAction: (id: string, action: 'Aprovado' | 'Rejeitado' | 'Revisao', reason?: string) => Promise<void>;
  getStatusBadge: (status: string) => React.ReactNode;
  currentUserId: string | undefined;
}

export default function ReimbursementDetailModal({
  isOpen,
  onOpenChange,
  item,
  isManager,
  onAction,
  getStatusBadge,
  currentUserId
}: ReimbursementDetailModalProps) {
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [copiedPix, setCopiedPix] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isOpen && item?.id) {
      fetchHistory();
      setIsRejecting(false);
      setIsReturning(false);
      setRejectionReason("");
      setReturnReason("");
    }
  }, [isOpen, item?.id]);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const { data, error } = await supabase
        .from('reimbursement_history')
        .select('*')
        .eq('reimbursement_id', item.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (err) {
      console.error("Erro ao buscar histórico:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-4xl overflow-hidden p-0 border-0 bg-transparent shadow-none gap-0">
        <div className="bg-card rounded-2xl flex flex-col lg:flex-row overflow-hidden max-h-[92vh]">

          {/* Esquerda: Foto */}
          <div className="w-full lg:w-5/12 bg-slate-900 relative h-44 lg:h-auto overflow-hidden shrink-0">
             <img
               src={item.receipt_url || "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=60"}
               alt="Cupom Fiscal"
               referrerPolicy="no-referrer"
               className="absolute inset-0 w-full h-full object-cover opacity-80"
             />
             <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 to-transparent flex flex-col justify-end p-6">
               <p className="text-white font-bold text-lg">Comprovante</p>
               <p className="text-slate-300 text-sm">Escaneado via App Móvel</p>
             </div>
          </div>

          {/* Direita: Conteúdo */}
          <div className="w-full lg:w-7/12 bg-card flex flex-col min-h-0">
            <DialogHeader className="p-6 pb-4 border-b border-border shrink-0 text-left">
              <DialogTitle className="text-2xl font-bold flex items-center justify-between">
                Solicitação #{item.id?.slice(0,6)}
                {getStatusBadge(item.status)}
              </DialogTitle>
              <DialogDescription>
                Enviado em {item.created_at ? new Date(item.created_at).toLocaleDateString() : ''}
              </DialogDescription>
            </DialogHeader>

            <div className="p-6 space-y-6 flex-1 overflow-y-auto">
              
              {/* Abas Simples: Informações / Histórico */}
              <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 gap-4">
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Categoria</h4>
                  <p className="font-bold text-foreground">{item.category}</p>
                </div>
                <div className="bg-muted/40 p-4 rounded-xl border border-border">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Valor</h4>
                  <p className="font-extrabold text-blue-600 text-xl">
                    R$ {Number(item.amount).toFixed(2).replace('.', ',')}
                  </p>
                </div>
              </div>

              {/* Informações Auxiliares */}
              <div className="grid grid-cols-2 gap-4 bg-muted/40 p-4 rounded-xl border border-border">
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Colaborador</h4>
                  <p className="font-bold text-foreground flex items-center gap-1.5">
                    <UserIcon className="h-3 w-3 text-blue-500" />
                    {item.users?.full_name || 'Usuário'}
                  </p>
                </div>
                {item.maintenance_type && (
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Manutenção</h4>
                    <p className="font-semibold text-foreground">{item.maintenance_type}</p>
                  </div>
                )}
                {item.clients?.name && (
                  <div className="col-span-2 mt-1">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-1">Cliente / Filial</h4>
                    <p className="font-semibold text-foreground">{item.clients.name} {item.branch ? `(${item.branch})` : ''}</p>
                  </div>
                )}
              </div>

              {/* Descrição */}
              <div>
                 <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-1">Descrição</h4>
                 <div className="bg-muted/40 p-4 rounded-xl border border-border text-foreground font-medium">
                   {item.description || 'Nenhuma descrição informada.'}
                 </div>
              </div>

              {/* Dados de Pagamento */}
              {(item.favorecido || item.pix_key) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Pagamento</h4>
                  <div className="grid grid-cols-1 gap-3">
                    {item.favorecido && (
                      <div className="bg-muted/40 p-4 rounded-xl border border-border">
                        <Label className="text-[10px] font-bold text-muted-foreground uppercase">Favorecido</Label>
                        <p className="font-bold text-foreground">{item.favorecido}</p>
                      </div>
                    )}
                    {item.pix_key && (
                      <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <Label className="text-[10px] font-bold text-emerald-600 uppercase">Chave PIX</Label>
                          <p className="font-bold text-emerald-900 font-mono text-sm break-all">{item.pix_key}</p>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            navigator.clipboard.writeText(item.pix_key);
                            setCopiedPix(true);
                            setTimeout(() => setCopiedPix(false), 2000);
                          }}
                          className={clsx(
                            "shrink-0 flex items-center gap-1.5 font-bold transition-all",
                            copiedPix ? "text-emerald-600" : "text-emerald-700 hover:bg-emerald-100"
                          )}
                        >
                          {copiedPix ? <><Check className="h-3.5 w-3.5" /> Copiado</> : <><Copy className="h-3.5 w-3.5" /> Copiar</>}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* HISTÓRICO DE AUDITORIA */}
              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Histórico de Alterações</h4>
                </div>
                
                <div className="space-y-3">
                  {loadingHistory ? (
                    <div className="h-10 w-full animate-pulse bg-muted rounded-lg"></div>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">Nenhuma alteração registrada.</p>
                  ) : (
                    history.map((h) => (
                      <div key={h.id} className="relative pl-6 border-l-2 border-border pb-2">
                        <div className="absolute -left-[9px] top-0 h-4 w-4 rounded-full bg-muted border-2 border-card"></div>
                        <div className="flex flex-col">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-foreground">
                              {h.old_status ? `${h.old_status} → ${h.new_status}` : `Início: ${h.new_status}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {format(new Date(h.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          {h.reason && (
                            <p className="text-xs text-muted-foreground mt-1 bg-muted/40 p-2 rounded-lg border border-border">
                              "{h.reason}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* AÇÕES (Rodapé) */}
            <div className="p-6 border-t border-border bg-muted/40 shrink-0">
              {isManager && (item.status === 'Pendente' || item.status === 'Revisao') ? (
                isRejecting ? (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="Motivo da reprovação..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="bg-background resize-none"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setIsRejecting(false)}>Cancelar</Button>
                      <Button 
                        className="flex-1 bg-rose-600 hover:bg-rose-700 text-white" 
                        onClick={() => onAction(item.id, 'Rejeitado', rejectionReason)}
                        disabled={!rejectionReason.trim()}
                      >Confirmar Reprovação</Button>
                    </div>
                  </div>
                ) : isReturning ? (
                  <div className="space-y-3">
                    <Textarea
                      placeholder="O que o técnico deve ajustar?"
                      value={returnReason}
                      onChange={(e) => setReturnReason(e.target.value)}
                      className="bg-background resize-none border-orange-200"
                    />
                    <div className="flex gap-2">
                      <Button variant="outline" className="flex-1" onClick={() => setIsReturning(false)}>Cancelar</Button>
                      <Button 
                        className="flex-1 bg-orange-500 hover:bg-orange-600 text-white" 
                        onClick={() => onAction(item.id, 'Revisao', returnReason)}
                        disabled={!returnReason.trim()}
                      >Solicitar Ajuste</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      className="flex-1 text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100"
                      onClick={() => setIsReturning(true)}
                    >
                      <RotateCcw className="w-4 h-4 mr-2" /> Devolver
                    </Button>
                    <Button 
                      variant="outline" 
                      className="flex-1 text-rose-600 border-rose-200 bg-rose-50 hover:bg-rose-100"
                      onClick={() => setIsRejecting(true)}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Reprovar
                    </Button>
                    <Button 
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => onAction(item.id, 'Aprovado')}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Aprovar
                    </Button>
                  </div>
                )
              ) : (item.status === 'Pendente' || item.status === 'Revisao') && item.user_id === currentUserId ? (
                <Link
                  to={`/reimbursements/${item.id}/edit`}
                  className="inline-flex items-center justify-center w-full h-12 font-bold bg-amber-500 hover:bg-amber-600 text-white shadow-sm rounded-xl transition-colors"
                >
                  <Pencil className="w-5 h-5 mr-2" />
                  {item.status === 'Revisao' ? 'Ajustar e Reenviar' : 'Editar Reembolso'}
                </Link>
              ) : (
                <Button className="w-full h-12 rounded-xl bg-slate-800" onClick={() => onOpenChange(false)}>Fechar</Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={clsx("text-xs font-semibold text-muted-foreground mb-1 block", className)}>{children}</label>;
}
