import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { MapPin, Phone, Mail, User, Building2, FileText, Plus, Trash2, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { addLocation, deleteLocation, deleteClient } from '@/src/services/clientService';
import { invalidateClientsCache } from '@/src/hooks/useClients';
import type { ClientWithLocations, ClientLocation } from '@/src/types/client';

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function maskCEP(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

async function fetchViaCep(cep: string): Promise<{ logradouro: string; bairro: string; cidade: string; estado: string } | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return { logradouro: data.logradouro ?? '', bairro: data.bairro ?? '', cidade: data.localidade ?? '', estado: data.uf ?? '' };
  } catch { return null; }
}

const emptyUnit = { nome: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', contato_nome: '', contato_telefone: '' };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: ClientWithLocations | null;
  onEdit: () => void;
  onRefresh: () => void;
  onDeleted: () => void;
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="mt-0.5 text-muted-foreground shrink-0">{icon}</span>
      <div>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-foreground font-medium">{value}</p>
      </div>
    </div>
  );
}

export default function ClientDetailSheet({ open, onOpenChange, client, onEdit, onRefresh, onDeleted }: Props) {
  const [locations, setLocations] = useState<ClientLocation[]>(client?.client_locations ?? []);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitDraft, setUnitDraft] = useState(emptyUnit);
  const [addingUnit, setAddingUnit] = useState(false);
  const [deletingLocationId, setDeletingLocationId] = useState<string | null>(null);
  const [deletingClient, setDeletingClient] = useState(false);

  useEffect(() => { setLocations(client?.client_locations ?? []); }, [client]);

  const handleUnitCepBlur = useCallback(async (cep: string) => {
    const result = await fetchViaCep(cep);
    if (result) setUnitDraft(p => ({ ...p, logradouro: result.logradouro, bairro: result.bairro, cidade: result.cidade, estado: result.estado }));
  }, []);

  const handleAddUnit = async () => {
    if (!unitDraft.nome.trim()) { toast.error('Nome da unidade obrigatório.'); return; }
    if (!client) return;
    setAddingUnit(true);
    try {
      const loc = await addLocation(client.id, {
        nome: unitDraft.nome,
        cep: unitDraft.cep || undefined,
        logradouro: unitDraft.logradouro || undefined,
        numero: unitDraft.numero || undefined,
        complemento: unitDraft.complemento || undefined,
        bairro: unitDraft.bairro || undefined,
        cidade: unitDraft.cidade || undefined,
        estado: unitDraft.estado || undefined,
        contato_nome: unitDraft.contato_nome || undefined,
        contato_telefone: unitDraft.contato_telefone || undefined,
        is_principal: false,
      });
      setLocations(prev => [...prev, loc]);
      setUnitDraft(emptyUnit);
      setShowAddUnit(false);
      toast.success('Unidade adicionada.');
      onRefresh();
    } catch {
      toast.error('Erro ao adicionar unidade.');
    } finally {
      setAddingUnit(false);
    }
  };

  const handleDeleteLocation = async (id: string) => {
    setDeletingLocationId(id);
    try {
      await deleteLocation(id);
      setLocations(prev => prev.filter(l => l.id !== id));
      toast.info('Unidade removida.');
      onRefresh();
    } catch {
      toast.error('Erro ao remover unidade.');
    } finally {
      setDeletingLocationId(null);
    }
  };

  const handleDeleteClient = async () => {
    if (!client) return;
    setDeletingClient(true);
    try {
      await deleteClient(client.id);
      invalidateClientsCache();
      toast.info('Cliente excluído.');
      onOpenChange(false);
      onDeleted();
    } catch {
      toast.error('Erro ao excluir cliente.');
    } finally {
      setDeletingClient(false);
    }
  };

  if (!client) return null;

  const addressLine = [client.logradouro, client.numero, client.complemento].filter(Boolean).join(', ');
  const cityLine = [client.bairro, client.cidade, client.estado].filter(Boolean).join(' — ');

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <SheetTitle className="text-xl font-bold text-foreground">{client.name}</SheetTitle>
              {client.cnpj && <p className="text-sm text-muted-foreground font-mono mt-0.5">{client.cnpj}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={onEdit} className="h-9 rounded-xl gap-1.5 text-xs">
                <Pencil className="h-3.5 w-3.5" /> Editar
              </Button>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">

          {/* Endereço */}
          {(addressLine || cityLine || client.cep) && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Endereço</p>
              <div className="bg-muted/40 rounded-xl border border-border p-4 space-y-2">
                {client.cep && <InfoRow icon={<MapPin className="h-4 w-4" />} label="CEP" value={client.cep} />}
                {addressLine && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Logradouro" value={addressLine} />}
                {cityLine && <InfoRow icon={<MapPin className="h-4 w-4" />} label="Cidade" value={cityLine} />}
              </div>
            </div>
          )}

          {/* Contato */}
          {(client.contato_nome || client.contato_telefone || client.contato_email) && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Contato</p>
              <div className="bg-muted/40 rounded-xl border border-border p-4 space-y-2">
                <InfoRow icon={<User className="h-4 w-4" />} label="Nome" value={client.contato_nome} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Telefone" value={client.contato_telefone} />
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email" value={client.contato_email} />
              </div>
            </div>
          )}

          {/* Observações */}
          {client.observacoes && (
            <div className="space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Observações</p>
              <div className="bg-muted/40 rounded-xl border border-border p-4">
                <p className="text-sm text-foreground whitespace-pre-wrap">{client.observacoes}</p>
              </div>
            </div>
          )}

          {/* Unidades */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Unidades / Lojas ({locations.length})</p>
              {!showAddUnit && (
                <button type="button" onClick={() => setShowAddUnit(true)} className="text-xs text-primary font-semibold flex items-center gap-1 hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </button>
              )}
            </div>

            {locations.length === 0 && !showAddUnit && (
              <p className="text-xs text-muted-foreground italic">Nenhuma unidade cadastrada.</p>
            )}

            {locations.map(loc => (
              <div key={loc.id} className="bg-muted/40 rounded-xl border border-border p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-foreground">{loc.nome}</p>
                    {(loc.cidade || loc.estado) && <p className="text-xs text-muted-foreground mt-0.5">{[loc.cidade, loc.estado].filter(Boolean).join(' — ')}</p>}
                    {loc.logradouro && <p className="text-xs text-muted-foreground">{[loc.logradouro, loc.numero].filter(Boolean).join(', ')}</p>}
                    {loc.contato_nome && <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><User className="h-3 w-3" /> {loc.contato_nome}{loc.contato_telefone ? ` • ${loc.contato_telefone}` : ''}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteLocation(loc.id)}
                    disabled={deletingLocationId === loc.id}
                    className="shrink-0 text-muted-foreground hover:text-rose-500 transition-colors p-1"
                  >
                    {deletingLocationId === loc.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}

            {showAddUnit && (
              <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nova Unidade</p>
                  <button type="button" onClick={() => setShowAddUnit(false)} className="text-muted-foreground hover:text-foreground"><X className="h-4 w-4" /></button>
                </div>
                <div>
                  <Label className="text-sm font-semibold text-foreground">Nome <span className="text-rose-500">*</span></Label>
                  <Input value={unitDraft.nome} onChange={e => setUnitDraft(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Filial Centro" className="mt-1 h-10 rounded-xl bg-background border-input focus-visible:ring-ring text-sm" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">CEP</Label>
                    <Input value={unitDraft.cep} onChange={e => setUnitDraft(p => ({ ...p, cep: maskCEP(e.target.value) }))} onBlur={() => handleUnitCepBlur(unitDraft.cep)} placeholder="00000-000" className="mt-1 h-9 rounded-xl bg-background border-input text-xs font-mono" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Cidade</Label>
                    <Input value={unitDraft.cidade} onChange={e => setUnitDraft(p => ({ ...p, cidade: e.target.value }))} className="mt-1 h-9 rounded-xl bg-background border-input text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-foreground">UF</Label>
                    <Input value={unitDraft.estado} onChange={e => setUnitDraft(p => ({ ...p, estado: e.target.value.toUpperCase().slice(0, 2) }))} className="mt-1 h-9 rounded-xl bg-background border-input text-xs uppercase" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <Label className="text-xs font-semibold text-foreground">Logradouro</Label>
                    <Input value={unitDraft.logradouro} onChange={e => setUnitDraft(p => ({ ...p, logradouro: e.target.value }))} className="mt-1 h-9 rounded-xl bg-background border-input text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Número</Label>
                    <Input value={unitDraft.numero} onChange={e => setUnitDraft(p => ({ ...p, numero: e.target.value }))} className="mt-1 h-9 rounded-xl bg-background border-input text-xs" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Contato</Label>
                    <Input value={unitDraft.contato_nome} onChange={e => setUnitDraft(p => ({ ...p, contato_nome: e.target.value }))} className="mt-1 h-9 rounded-xl bg-background border-input text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs font-semibold text-foreground">Telefone</Label>
                    <Input value={unitDraft.contato_telefone} onChange={e => setUnitDraft(p => ({ ...p, contato_telefone: maskPhone(e.target.value) }))} className="mt-1 h-9 rounded-xl bg-background border-input text-xs font-mono" />
                  </div>
                </div>
                <Button type="button" onClick={handleAddUnit} disabled={addingUnit} className="w-full h-9 rounded-xl text-sm">
                  {addingUnit ? <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> : null}
                  Confirmar Unidade
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Rodapé — excluir cliente */}
        <div className="px-6 py-4 border-t border-border bg-muted/40 shrink-0">
          <Button
            variant="ghost"
            onClick={handleDeleteClient}
            disabled={deletingClient}
            className="w-full h-10 rounded-xl text-rose-600 hover:bg-rose-50 hover:text-rose-700 text-sm font-semibold gap-2"
          >
            {deletingClient ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Excluir Cliente
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
