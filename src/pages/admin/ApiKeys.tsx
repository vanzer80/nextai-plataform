import { useState, useEffect, useCallback } from 'react';
import { Plus, Copy, Check, KeyRound, ShieldOff, Loader2, AlertTriangle, Clock, Activity } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Checkbox } from '@/src/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/src/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/src/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/src/components/ui/alert-dialog';
import { supabase } from '@/src/lib/supabase';
import type { ApiKey, ApiUsageStats } from '@/src/types/integrations';
import { API_SCOPES } from '@/src/types/integrations';

// Group scopes for display
const SCOPE_GROUPS = Array.from(new Set(API_SCOPES.map(s => s.group))).map(group => ({
  group,
  scopes: API_SCOPES.filter(s => s.group === group),
}));

function ScopeLabel({ scope }: { scope: string }) {
  const def = API_SCOPES.find(s => s.value === scope);
  return <span>{def?.label ?? scope}</span>;
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

export default function ApiKeys() {
  const [keys, setKeys]           = useState<ApiKey[]>([]);
  const [stats, setStats]         = useState<ApiUsageStats | null>(null);
  const [loading, setLoading]     = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating]   = useState(false);
  const [revealOpen, setRevealOpen] = useState(false);
  const [newKey, setNewKey]       = useState<{ key: string; name: string } | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [revoking, setRevoking]   = useState(false);

  // Form state
  const [formName, setFormName]       = useState('');
  const [formScopes, setFormScopes]   = useState<string[]>([]);
  const [formExpires, setFormExpires] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [keysRes, statsRes] = await Promise.all([
      supabase.rpc('get_api_keys'),
      supabase.rpc('get_api_usage_stats', { p_days: 7 }),
    ]);
    if (keysRes.error) toast.error('Erro ao carregar API keys.');
    else setKeys((keysRes.data ?? []) as ApiKey[]);
    if (!statsRes.error) setStats(statsRes.data as ApiUsageStats);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function resetForm() {
    setFormName(''); setFormScopes([]); setFormExpires('');
  }

  async function handleCreate() {
    if (!formName.trim()) { toast.warning('Informe um nome para a chave.'); return; }
    if (formScopes.length === 0) { toast.warning('Selecione ao menos um escopo.'); return; }
    setCreating(true);
    const expiresAt = formExpires ? new Date(formExpires).toISOString() : null;
    const { data, error } = await supabase.rpc('create_api_key', {
      p_name: formName.trim(),
      p_scopes: formScopes,
      p_expires_at: expiresAt,
    });
    setCreating(false);
    if (error) { toast.error(error.message); return; }
    const result = data as { id: string; key: string; prefix: string };
    setNewKey({ key: result.key, name: formName.trim() });
    setCreateOpen(false);
    setRevealOpen(true);
    resetForm();
    load();
  }

  async function handleRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    const { error } = await supabase.rpc('revoke_api_key', { p_key_id: revokeTarget.id });
    setRevoking(false);
    setRevokeTarget(null);
    if (error) { toast.error(error.message); return; }
    toast.success('Chave revogada com sucesso.');
    load();
  }

  function toggleScope(scope: string) {
    setFormScopes(prev =>
      prev.includes(scope) ? prev.filter(s => s !== scope) : [...prev, scope]
    );
  }

  const activeKeys   = keys.filter(k => k.is_active);
  const revokedKeys  = keys.filter(k => !k.is_active);

  return (
    <div data-onboarding="api-keys-page" className="p-4 md:p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            API Keys
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie as chaves de acesso à API pública NextAI
          </p>
        </div>
        <Button data-onboarding="api-keys-nova" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Chave
        </Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Requisições (7d)', value: stats.total_requests, icon: Activity },
            { label: 'Sucesso',          value: stats.success_requests, icon: Check },
            { label: 'Erros',            value: stats.error_requests, icon: AlertTriangle },
            { label: 'Latência média',   value: `${stats.avg_duration_ms}ms`, icon: Clock },
          ].map(({ label, value, icon: Icon }) => (
            <Card key={label} className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Icon className="h-3.5 w-3.5" />
                <span className="text-xs">{label}</span>
              </div>
              <p className="text-lg font-semibold">{value}</p>
            </Card>
          ))}
        </div>
      )}

      {/* Active keys */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Chaves ativas ({activeKeys.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : activeKeys.length === 0 ? (
            <p className="text-muted-foreground text-sm py-4">Nenhuma API key criada.</p>
          ) : (
            <div className="divide-y">
              {activeKeys.map(key => (
                <div key={key.id} className="py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{key.name}</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {key.key_prefix}…
                      </code>
                      <Badge variant="outline" className="text-green-700 border-green-300 bg-green-50 dark:bg-green-950 dark:border-green-800 text-xs">
                        Ativa
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {key.scopes.map(s => (
                        <Badge key={s} variant="secondary" className="text-xs px-1.5 py-0">
                          <ScopeLabel scope={s} />
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criada {format(new Date(key.created_at), "d MMM yyyy", { locale: ptBR })}
                      {key.last_used_at && ` · Último uso ${format(new Date(key.last_used_at), "d MMM yyyy 'às' HH:mm", { locale: ptBR })}`}
                      {key.expires_at && ` · Expira ${format(new Date(key.expires_at), "d MMM yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive shrink-0"
                    onClick={() => setRevokeTarget(key)}
                  >
                    <ShieldOff className="h-4 w-4 mr-1.5" /> Revogar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Revoked keys */}
      {revokedKeys.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground">Revogadas ({revokedKeys.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {revokedKeys.map(key => (
                <div key={key.id} className="py-3 flex items-center gap-3 opacity-60">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm line-through">{key.name}</span>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{key.key_prefix}…</code>
                      <Badge variant="outline" className="text-xs">Revogada</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Criada {format(new Date(key.created_at), "d MMM yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={open => { setCreateOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
            <DialogDescription>
              A chave será exibida apenas uma vez após a criação. Guarde-a com segurança.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="key-name">Nome *</Label>
              <Input
                id="key-name"
                placeholder="Ex: Integração SAP Produção"
                value={formName}
                onChange={e => setFormName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Escopos *</Label>
              {SCOPE_GROUPS.map(({ group, scopes }) => (
                <div key={group}>
                  <p className="text-xs text-muted-foreground font-medium mb-1">{group}</p>
                  <div className="space-y-1.5 pl-1">
                    {scopes.map(s => (
                      <div key={s.value} className="flex items-center gap-2">
                        <Checkbox
                          id={`scope-${s.value}`}
                          checked={formScopes.includes(s.value)}
                          onCheckedChange={() => toggleScope(s.value)}
                        />
                        <label htmlFor={`scope-${s.value}`} className="text-sm cursor-pointer">
                          {s.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="key-expires">Expiração (opcional)</Label>
              <Input
                id="key-expires"
                type="date"
                value={formExpires}
                onChange={e => setFormExpires(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
              <p className="text-xs text-muted-foreground">Sem data = sem expiração.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reveal dialog — key shown once */}
      <Dialog open={revealOpen} onOpenChange={setRevealOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" /> Chave criada com sucesso
            </DialogTitle>
            <DialogDescription>
              Copie a chave abaixo agora. <strong>Ela não será exibida novamente.</strong>
            </DialogDescription>
          </DialogHeader>
          {newKey && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground mb-1 font-medium">{newKey.name}</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono break-all select-all">{newKey.key}</code>
                  <CopyButton text={newKey.key} />
                </div>
              </div>
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 rounded-md p-2.5">
                <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                <span>Armazene esta chave em um secret manager. Não é possível recuperá-la depois.</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => { setRevealOpen(false); setNewKey(null); }}>
              Confirmar — guardei a chave
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Revoke confirmation */}
      <AlertDialog open={!!revokeTarget} onOpenChange={open => { if (!open) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar "{revokeTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              A chave será desativada imediatamente. Qualquer integração que a usa deixará de funcionar.
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel variant="outline" size="default">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleRevoke}
              disabled={revoking}
            >
              {revoking && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Revogar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
