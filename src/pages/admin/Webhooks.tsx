import { useState, useEffect, useCallback } from 'react';
import { Plus, Copy, Check, Webhook, Trash2, Power, PowerOff, ChevronDown, ChevronRight, Loader2, AlertTriangle, RefreshCw, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/src/lib/supabase';
import type { WebhookEndpoint, WebhookDelivery } from '@/src/types/integrations';
import { WEBHOOK_EVENTS } from '@/src/types/integrations';

const EVENT_GROUPS = Array.from(new Set(WEBHOOK_EVENTS.map(e => e.group))).map(group => ({
  group,
  events: WEBHOOK_EVENTS.filter(e => e.group === group),
}));

function EventLabel({ event }: { event: string }) {
  const def = WEBHOOK_EVENTS.find(e => e.value === event);
  return <span>{def?.label ?? event}</span>;
}

function DeliveryStatusBadge({ status }: { status: WebhookDelivery['status'] }) {
  const map: Record<WebhookDelivery['status'], { label: string; className: string }> = {
    pending:   { label: 'Pendente',   className: 'border-yellow-300 bg-yellow-50 text-yellow-700 dark:bg-yellow-950 dark:border-yellow-800' },
    sent:      { label: 'Enviado',    className: 'border-blue-300 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:border-blue-800' },
    delivered: { label: 'Entregue',   className: 'border-green-300 bg-green-50 text-green-700 dark:bg-green-950 dark:border-green-800' },
    failed:    { label: 'Falhou',     className: 'border-red-300 bg-red-50 text-red-700 dark:bg-red-950 dark:border-red-800' },
    dead:      { label: 'Expirado',   className: 'border-muted bg-muted text-muted-foreground' },
  };
  const { label, className } = map[status] ?? map.failed;
  return <Badge variant="outline" className={`text-xs ${className}`}>{label}</Badge>;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <Button variant="outline" size="sm" onClick={handleCopy} className="shrink-0">
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}

export default function Webhooks() {
  const [endpoints, setEndpoints]         = useState<WebhookEndpoint[]>([]);
  const [deliveries, setDeliveries]       = useState<Record<string, WebhookDelivery[]>>({});
  const [expanded, setExpanded]           = useState<string | null>(null);
  const [loading, setLoading]             = useState(true);
  const [loadingDeliveries, setLoadingDeliveries] = useState<string | null>(null);
  const [createOpen, setCreateOpen]       = useState(false);
  const [creating, setCreating]           = useState(false);
  const [revealOpen, setRevealOpen]       = useState(false);
  const [newSecret, setNewSecret]         = useState<{ secret: string; url: string } | null>(null);
  const [dispatching, setDispatching]     = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<WebhookEndpoint | null>(null);
  const [deleting, setDeleting]           = useState(false);

  // Form
  const [formUrl, setFormUrl]           = useState('');
  const [formDesc, setFormDesc]         = useState('');
  const [formEvents, setFormEvents]     = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_webhook_endpoints');
    if (error) toast.error('Erro ao carregar webhooks.');
    else setEndpoints((data ?? []) as WebhookEndpoint[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function loadDeliveries(endpointId: string) {
    setLoadingDeliveries(endpointId);
    const { data, error } = await supabase.rpc('get_webhook_deliveries', {
      p_endpoint_id: endpointId,
      p_limit: 20,
    });
    setLoadingDeliveries(null);
    if (error) { toast.error('Erro ao carregar entregas.'); return; }
    setDeliveries(prev => ({ ...prev, [endpointId]: (data ?? []) as WebhookDelivery[] }));
  }

  function toggleExpanded(id: string) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!deliveries[id]) loadDeliveries(id);
  }

  function resetForm() { setFormUrl(''); setFormDesc(''); setFormEvents([]); }

  async function handleCreate() {
    if (!formUrl.trim()) { toast.warning('Informe a URL do endpoint.'); return; }
    if (!formUrl.startsWith('https://')) { toast.warning('Use uma URL HTTPS.'); return; }
    if (formEvents.length === 0) { toast.warning('Selecione ao menos um evento.'); return; }
    setCreating(true);
    const { data, error } = await supabase.rpc('create_webhook_endpoint', {
      p_url: formUrl.trim(),
      p_events: formEvents,
      p_description: formDesc.trim() || null,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { id: string; secret: string };
    setNewSecret({ secret: result.secret, url: formUrl.trim() });
    setCreateOpen(false);
    setRevealOpen(true);
    resetForm();
    load();
  }

  async function handleToggle(ep: WebhookEndpoint) {
    const { error } = await supabase.rpc('update_webhook_endpoint', {
      p_id: ep.id,
      p_is_active: !ep.is_active,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(ep.is_active ? 'Webhook desativado.' : 'Webhook ativado.');
    load();
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.rpc('delete_webhook_endpoint', { p_id: deleteTarget.id });
    setDeleting(false);
    setDeleteTarget(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Webhook removido.');
    setEndpoints(prev => prev.filter(e => e.id !== deleteTarget.id));
  }

  async function handleDispatch(endpointId: string) {
    setDispatching(endpointId);
    const { data, error } = await supabase.functions.invoke('webhook-dispatcher', { body: {} });
    setDispatching(null);
    if (error) { toast.error('Erro ao disparar entregas.'); return; }
    const json = data as { processed: number; succeeded: number; failed: number };
    toast.success(`${json.succeeded ?? 0} entrega(s) concluída(s), ${json.failed ?? 0} falha(s).`);
    if (expanded === endpointId) loadDeliveries(endpointId);
  }

  function toggleEvent(ev: string) {
    setFormEvents(prev => prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]);
  }

  return (
    <div data-onboarding="webhooks-page" className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <Webhook className="h-5 w-5 text-primary" />
            Webhooks
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Receba notificações em tempo real de eventos do NextAI
          </p>
        </div>
        <Button data-onboarding="webhooks-novo" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Novo Webhook
        </Button>
      </div>

      {/* Endpoints list */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Endpoints ({endpoints.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : endpoints.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              <Webhook className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>Nenhum webhook configurado.</p>
              <p className="text-xs mt-1">Crie um endpoint para receber eventos.</p>
            </div>
          ) : (
            <div className="divide-y">
              {endpoints.map(ep => (
                <div key={ep.id}>
                  {/* Endpoint row */}
                  <div className="py-3 flex flex-col sm:flex-row sm:items-start gap-2">
                    <button
                      className="flex items-center gap-1.5 text-left min-w-0"
                      onClick={() => toggleExpanded(ep.id)}
                    >
                      {expanded === ep.id
                        ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm truncate max-w-xs">{ep.url}</span>
                          <Badge
                            variant="outline"
                            className={ep.is_active
                              ? 'text-green-700 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 text-xs'
                              : 'text-muted-foreground text-xs'}
                          >
                            {ep.is_active ? 'Ativo' : 'Inativo'}
                          </Badge>
                        </div>
                        {ep.description && (
                          <p className="text-xs text-muted-foreground">{ep.description}</p>
                        )}
                        <div className="flex flex-wrap gap-1 mt-1">
                          {ep.events.map(ev => (
                            <Badge key={ev} variant="secondary" className="text-xs px-1.5 py-0">
                              <EventLabel event={ev} />
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Criado {format(new Date(ep.created_at), "d MMM yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </button>

                    <div className="flex items-center gap-1 sm:ml-auto shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDispatch(ep.id)}
                        disabled={dispatching === ep.id}
                        title="Disparar entregas pendentes"
                      >
                        {dispatching === ep.id
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <RefreshCw className="h-4 w-4" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggle(ep)}
                        title={ep.is_active ? 'Desativar' : 'Ativar'}
                      >
                        {ep.is_active
                          ? <PowerOff className="h-4 w-4 text-muted-foreground" />
                          : <Power className="h-4 w-4 text-green-600" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(ep)}
                        title="Remover webhook"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Deliveries panel */}
                  {expanded === ep.id && (
                    <div className="pb-3 pl-6">
                      <div className="rounded-md border">
                        <div className="px-3 py-2 border-b bg-muted/40 flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">Últimas entregas</span>
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => loadDeliveries(ep.id)}>
                            Atualizar
                          </Button>
                        </div>
                        {loadingDeliveries === ep.id ? (
                          <div className="flex items-center gap-2 text-muted-foreground p-3 text-xs">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
                          </div>
                        ) : (deliveries[ep.id] ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground p-3">Sem entregas registradas.</p>
                        ) : (
                          <div className="divide-y max-h-64 overflow-y-auto">
                            {(deliveries[ep.id] ?? []).map(d => (
                              <div key={d.id} className="px-3 py-2 flex items-center gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <code className="text-xs font-mono text-muted-foreground">{d.event_type}</code>
                                    <DeliveryStatusBadge status={d.status} />
                                    {d.attempts > 1 && (
                                      <span className="text-xs text-muted-foreground">{d.attempts} tentativas</span>
                                    )}
                                  </div>
                                  {d.last_error && (
                                    <p className="text-xs text-destructive truncate">{d.last_error}</p>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground shrink-0">
                                  {format(new Date(d.created_at), "dd/MM HH:mm", { locale: ptBR })}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Novo Webhook</DialogTitle>
            <DialogDescription>
              Informe o endpoint HTTPS que receberá os eventos. O segredo HMAC será exibido apenas uma vez.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="wh-url">URL * (HTTPS)</Label>
              <Input
                id="wh-url"
                placeholder="https://meu-erp.com/webhooks/nextai"
                value={formUrl}
                onChange={e => setFormUrl(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wh-desc">Descrição (opcional)</Label>
              <Input
                id="wh-desc"
                placeholder="Ex: Integração ERP SAP"
                value={formDesc}
                onChange={e => setFormDesc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Eventos *</Label>
              {EVENT_GROUPS.map(({ group, events }) => (
                <div key={group}>
                  <p className="text-xs text-muted-foreground font-medium mb-1">{group}</p>
                  <div className="space-y-1.5 pl-1">
                    {events.map(ev => (
                      <div key={ev.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`ev-${ev.value}`}
                          checked={formEvents.includes(ev.value)}
                          onCheckedChange={() => toggleEvent(ev.value)}
                        />
                        <label htmlFor={`ev-${ev.value}`} className="text-sm cursor-pointer">
                          <span className="font-mono text-xs text-muted-foreground mr-1.5">{ev.value}</span>
                          {ev.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={open => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              Remover webhook?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O endpoint <strong className="break-all">{deleteTarget?.url}</strong> será removido
              permanentemente junto com todo o histórico de entregas.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Secret reveal dialog */}
      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" /> Webhook criado
            </DialogTitle>
            <DialogDescription>
              Copie o segredo HMAC abaixo. <strong>Ele não será exibido novamente.</strong>
              Use-o para verificar a assinatura <code>X-NextAI-Signature</code> nas requisições recebidas.
            </DialogDescription>
          </DialogHeader>
          {newSecret && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Segredo HMAC — {newSecret.url}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all select-all">{newSecret.secret}</code>
                  <CopyButton text={newSecret.secret} />
                </div>
              </div>
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1 font-medium">Como verificar (Node.js)</p>
                <pre className="text-xs font-mono whitespace-pre-wrap">{`const hmac = crypto.createHmac('sha256', SECRET);
hmac.update(rawBody);
const sig = 'sha256=' + hmac.digest('hex');
if (sig !== req.headers['x-nextai-signature']) {
  return res.status(401).send('Assinatura inválida');
}`}</pre>
              </div>
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md p-2.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Nunca exponha este segredo publicamente.</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setRevealOpen(false); setNewSecret(null); }}>
              Confirmar — guardei o segredo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
