import { useState, useEffect, useCallback } from 'react';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, Trash2, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/src/components/ui/sheet';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Textarea } from '@/src/components/ui/textarea';
import { createClient, updateClient } from '@/src/services/clientService';
import { invalidateClientsCache } from '@/src/hooks/useClients';
import type { ClientWithLocations } from '@/src/types/client';

// ── Máscaras ──────────────────────────────────────────────────

function maskCnpjCpf(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 11) {
    return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return d
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
  return d.replace(/(\d{2})(\d)/, '($1) $2').replace(/(\d{5})(\d)/, '$1-$2');
}

function maskCEP(v: string): string {
  return v.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2');
}

// ── ViaCEP ────────────────────────────────────────────────────

async function fetchViaCep(cep: string): Promise<{ logradouro: string; bairro: string; cidade: string; estado: string } | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const data = await res.json();
    if (data.erro) return null;
    return { logradouro: data.logradouro ?? '', bairro: data.bairro ?? '', cidade: data.localidade ?? '', estado: data.uf ?? '' };
  } catch {
    return null;
  }
}

// ── Schema ────────────────────────────────────────────────────

const locationSchema = z.object({
  nome: z.string().min(1, 'Nome da unidade obrigatório'),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  contato_nome: z.string().optional(),
  contato_telefone: z.string().optional(),
  is_principal: z.boolean(),
});

const clientSchema = z.object({
  name: z.string().min(2, 'Mínimo 2 caracteres'),
  cnpj: z.string().optional(),
  cep: z.string().optional(),
  logradouro: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  bairro: z.string().optional(),
  cidade: z.string().optional(),
  estado: z.string().max(2).optional(),
  contato_nome: z.string().optional(),
  contato_telefone: z.string().optional(),
  contato_email: z.string().optional().refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), { message: 'Email inválido' }),
  observacoes: z.string().optional(),
  locations: z.array(locationSchema).optional(),
});

type ClientFormValues = z.infer<typeof clientSchema>;

// ── Props ─────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: ClientWithLocations | null;
  onSuccess: () => void;
}

// ── Componente ────────────────────────────────────────────────

export default function ClientFormSheet({ open, onOpenChange, client, onSuccess }: Props) {
  const isEdit = !!client;
  const [submitting, setSubmitting] = useState(false);
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [unitDraft, setUnitDraft] = useState({ nome: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', contato_nome: '', contato_telefone: '' });

  const { control, register, handleSubmit, setValue, reset, formState: { errors } } = useForm<ClientFormValues, unknown, ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: { name: '', cnpj: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', contato_nome: '', contato_telefone: '', contato_email: '', observacoes: '', locations: [] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: 'locations' });

  useEffect(() => {
    if (open) {
      if (client) {
        reset({
          name: client.name,
          cnpj: client.cnpj ?? '',
          cep: client.cep ?? '',
          logradouro: client.logradouro ?? '',
          numero: client.numero ?? '',
          complemento: client.complemento ?? '',
          bairro: client.bairro ?? '',
          cidade: client.cidade ?? '',
          estado: client.estado ?? '',
          contato_nome: client.contato_nome ?? '',
          contato_telefone: client.contato_telefone ?? '',
          contato_email: client.contato_email ?? '',
          observacoes: client.observacoes ?? '',
          locations: [],
        });
      } else {
        reset({ name: '', cnpj: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', contato_nome: '', contato_telefone: '', contato_email: '', observacoes: '', locations: [] });
      }
      setShowUnitForm(false);
      setUnitDraft({ nome: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', contato_nome: '', contato_telefone: '' });
    }
  }, [open, client, reset]);

  const handleMainCepBlur = useCallback(async (cep: string) => {
    const result = await fetchViaCep(cep);
    if (result) {
      setValue('logradouro', result.logradouro);
      setValue('bairro', result.bairro);
      setValue('cidade', result.cidade);
      setValue('estado', result.estado);
    }
  }, [setValue]);

  const handleUnitCepBlur = useCallback(async (cep: string) => {
    const result = await fetchViaCep(cep);
    if (result) {
      setUnitDraft(prev => ({ ...prev, logradouro: result.logradouro, bairro: result.bairro, cidade: result.cidade, estado: result.estado }));
    }
  }, []);

  const confirmUnit = () => {
    if (!unitDraft.nome.trim()) { toast.error('Nome da unidade obrigatório.'); return; }
    append({ ...unitDraft, is_principal: false });
    setUnitDraft({ nome: '', cep: '', logradouro: '', numero: '', complemento: '', bairro: '', cidade: '', estado: '', contato_nome: '', contato_telefone: '' });
    setShowUnitForm(false);
  };

  const onSubmit = async (data: ClientFormValues) => {
    setSubmitting(true);
    try {
      const clean = (v?: string | null) => v || undefined;
      const clientData = {
        name: data.name,
        cnpj: clean(data.cnpj),
        cep: clean(data.cep),
        logradouro: clean(data.logradouro),
        numero: clean(data.numero),
        complemento: clean(data.complemento),
        bairro: clean(data.bairro),
        cidade: clean(data.cidade),
        estado: clean(data.estado),
        contato_nome: clean(data.contato_nome),
        contato_telefone: clean(data.contato_telefone),
        contato_email: clean(data.contato_email),
        observacoes: clean(data.observacoes),
      };

      if (isEdit) {
        await updateClient(client!.id, clientData);
        toast.success('Cliente atualizado.');
      } else {
        await createClient({ ...clientData, locations: data.locations?.map(l => ({ ...l, estado: l.estado ?? '', contato_nome: l.contato_nome ?? undefined, contato_telefone: l.contato_telefone ?? undefined })) });
        toast.success('Cliente cadastrado.');
      }

      invalidateClientsCache();
      onSuccess();
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error('Erro ao salvar cliente.', { description: err instanceof Error ? err.message : undefined });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden">
        <SheetHeader className="px-6 py-5 border-b border-border shrink-0">
          <SheetTitle className="text-xl font-bold">{isEdit ? 'Editar Cliente' : 'Cadastrar Cliente'}</SheetTitle>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-8">

            {/* Dados Principais */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Dados Principais</h3>
              <div className="space-y-3">
                <div>
                  <Label className="text-sm font-semibold text-foreground">Razão Social / Nome <span className="text-rose-500">*</span></Label>
                  <Input {...register('name')} placeholder="Ex: Construtora ABC Ltda" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring" />
                  {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name.message}</p>}
                </div>
                <div>
                  <Label className="text-sm font-semibold text-foreground">CNPJ / CPF</Label>
                  <Controller name="cnpj" control={control} render={({ field }) => (
                    <Input {...field} onChange={e => field.onChange(maskCnpjCpf(e.target.value))} placeholder="00.000.000/0000-00" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring font-mono" />
                  )} />
                </div>
              </div>
            </section>

            {/* Endereço */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Endereço</h3>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-sm font-semibold text-foreground">CEP</Label>
                  <Controller name="cep" control={control} render={({ field }) => (
                    <Input {...field} onChange={e => field.onChange(maskCEP(e.target.value))} onBlur={() => handleMainCepBlur(field.value ?? '')} placeholder="00000-000" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring font-mono" />
                  )} />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-foreground">Cidade</Label>
                  <Input {...register('cidade')} placeholder="São Paulo" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-foreground">Estado</Label>
                  <Input {...register('estado')} placeholder="SP" maxLength={2} className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring uppercase" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-sm font-semibold text-foreground">Logradouro</Label>
                  <Input {...register('logradouro')} placeholder="Rua, Av., Alameda..." className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-foreground">Número</Label>
                  <Input {...register('numero')} placeholder="123" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold text-foreground">Complemento</Label>
                  <Input {...register('complemento')} placeholder="Sala 10, Andar 3..." className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring" />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-foreground">Bairro</Label>
                  <Input {...register('bairro')} placeholder="Centro" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring" />
                </div>
              </div>
            </section>

            {/* Contato */}
            <section className="space-y-4">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Contato Principal</h3>
              <div>
                <Label className="text-sm font-semibold text-foreground">Nome do contato</Label>
                <Input {...register('contato_nome')} placeholder="Nome do responsável" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-sm font-semibold text-foreground">Telefone</Label>
                  <Controller name="contato_telefone" control={control} render={({ field }) => (
                    <Input {...field} onChange={e => field.onChange(maskPhone(e.target.value))} placeholder="(11) 99999-9999" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring font-mono" />
                  )} />
                </div>
                <div>
                  <Label className="text-sm font-semibold text-foreground">Email</Label>
                  <Input {...register('contato_email')} type="email" placeholder="contato@empresa.com" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring" />
                  {errors.contato_email && <p className="text-xs text-rose-500 mt-1">{errors.contato_email.message}</p>}
                </div>
              </div>
            </section>

            {/* Unidades — apenas no cadastro */}
            {!isEdit && (
              <section className="space-y-4">
                <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Unidades / Lojas</h3>

                {fields.length > 0 && (
                  <div className="space-y-2">
                    {fields.map((field, idx) => (
                      <div key={field.id} className="flex items-center justify-between gap-3 bg-muted/40 border border-border rounded-xl px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground truncate">{field.nome}</p>
                          {field.cidade && <p className="text-xs text-muted-foreground">{field.cidade}{field.estado ? ` — ${field.estado}` : ''}</p>}
                        </div>
                        <button type="button" onClick={() => remove(idx)} className="shrink-0 text-muted-foreground hover:text-rose-500 transition-colors p-1">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!showUnitForm ? (
                  <Button type="button" variant="outline" onClick={() => setShowUnitForm(true)} className="w-full h-10 rounded-xl border-dashed gap-2 text-muted-foreground hover:text-foreground">
                    <Plus className="h-4 w-4" /> Adicionar Unidade
                  </Button>
                ) : (
                  <div className="border border-border rounded-xl p-4 space-y-3 bg-muted/20">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Nova Unidade</p>
                    <div>
                      <Label className="text-sm font-semibold text-foreground">Nome da unidade <span className="text-rose-500">*</span></Label>
                      <Input value={unitDraft.nome} onChange={e => setUnitDraft(p => ({ ...p, nome: e.target.value }))} placeholder="Ex: Loja Shopping Iguatemi" className="mt-1 h-11 rounded-xl bg-background border-input focus-visible:ring-ring" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <Label className="text-sm font-semibold text-foreground">CEP</Label>
                        <Input
                          value={unitDraft.cep}
                          onChange={e => setUnitDraft(p => ({ ...p, cep: maskCEP(e.target.value) }))}
                          onBlur={() => handleUnitCepBlur(unitDraft.cep)}
                          placeholder="00000-000"
                          className="mt-1 h-10 rounded-xl bg-background border-input focus-visible:ring-ring font-mono text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-foreground">Cidade</Label>
                        <Input value={unitDraft.cidade} onChange={e => setUnitDraft(p => ({ ...p, cidade: e.target.value }))} placeholder="Cidade" className="mt-1 h-10 rounded-xl bg-background border-input focus-visible:ring-ring text-sm" />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-foreground">Estado</Label>
                        <Input value={unitDraft.estado} onChange={e => setUnitDraft(p => ({ ...p, estado: e.target.value.toUpperCase().slice(0, 2) }))} placeholder="SP" className="mt-1 h-10 rounded-xl bg-background border-input focus-visible:ring-ring text-sm uppercase" />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-2">
                        <Label className="text-sm font-semibold text-foreground">Logradouro</Label>
                        <Input value={unitDraft.logradouro} onChange={e => setUnitDraft(p => ({ ...p, logradouro: e.target.value }))} placeholder="Rua, Av..." className="mt-1 h-10 rounded-xl bg-background border-input focus-visible:ring-ring text-sm" />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-foreground">Número</Label>
                        <Input value={unitDraft.numero} onChange={e => setUnitDraft(p => ({ ...p, numero: e.target.value }))} placeholder="123" className="mt-1 h-10 rounded-xl bg-background border-input focus-visible:ring-ring text-sm" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-sm font-semibold text-foreground">Contato</Label>
                        <Input value={unitDraft.contato_nome} onChange={e => setUnitDraft(p => ({ ...p, contato_nome: e.target.value }))} placeholder="Nome" className="mt-1 h-10 rounded-xl bg-background border-input focus-visible:ring-ring text-sm" />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold text-foreground">Telefone</Label>
                        <Input value={unitDraft.contato_telefone} onChange={e => setUnitDraft(p => ({ ...p, contato_telefone: maskPhone(e.target.value) }))} placeholder="(11) 99999-9999" className="mt-1 h-10 rounded-xl bg-background border-input focus-visible:ring-ring text-sm font-mono" />
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <Button type="button" variant="outline" onClick={() => setShowUnitForm(false)} className="flex-1 h-9 rounded-xl text-sm">Cancelar</Button>
                      <Button type="button" onClick={confirmUnit} className="flex-1 h-9 rounded-xl text-sm">Confirmar</Button>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Observações */}
            <section className="space-y-3">
              <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Observações</h3>
              <Textarea {...register('observacoes')} placeholder="Informações adicionais sobre o cliente..." rows={3} className="resize-none rounded-xl bg-background border-input focus-visible:ring-ring" />
            </section>
          </div>

          <SheetFooter className="px-6 py-4 border-t border-border bg-muted/40 shrink-0 gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting} className="flex-1 sm:flex-none h-11 rounded-xl">
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1 sm:flex-none h-11 rounded-xl font-semibold">
              {submitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
              {isEdit ? 'Salvar Alterações' : 'Cadastrar Cliente'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
