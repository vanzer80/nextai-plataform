import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2, Loader2, Save, Hash, Phone, Globe2,
  Mail, MapPin, FileText, ChevronDown, Palette, Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue,
} from '@/components/ui/select';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  tenant_name:          z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  razao_social:         z.string().max(200).optional(),
  cnpj:                 z.string().max(18).optional(),
  ie:                   z.string().max(30).optional(),
  email_contato:        z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone:                z.string().max(20).optional(),
  website:              z.string().max(200).optional(),
  sector:               z.string().optional(),
  address_zip:          z.string().max(10).optional(),
  address_street:       z.string().max(200).optional(),
  address_number:       z.string().max(20).optional(),
  address_complement:   z.string().max(100).optional(),
  address_neighborhood: z.string().max(100).optional(),
  address_city:         z.string().max(100).optional(),
  address_state:        z.string().max(2).optional(),
  address_country:      z.string().max(100).optional(),
  primary_color:        z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
});
type FormValues = z.infer<typeof schema>;

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface TenantOption {
  id: string;
  name: string;
  slug: string;
  is_platform: boolean;
  logo_url: string | null;
  primary_color: string;
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const SECTORS = [
  'Engenharia Civil', 'Engenharia Elétrica', 'Manutenção Industrial',
  'Construção Civil', 'Instalações Prediais', 'Telecomunicações',
  'TI e Tecnologia', 'Outro',
];

const EMPTY: FormValues = {
  tenant_name: '', razao_social: '', cnpj: '', ie: '',
  email_contato: '', phone: '', website: '', sector: '',
  address_zip: '', address_street: '', address_number: '',
  address_complement: '', address_neighborhood: '',
  address_city: '', address_state: '', address_country: 'Brasil',
  primary_color: '#0066CC',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchCep(cep: string): Promise<{ logradouro: string; bairro: string; localidade: string; uf: string } | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const json = await res.json();
    return json.erro ? null : json;
  } catch {
    return null;
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function PlatformCompanyProfile() {
  const [tenants, setTenants]             = useState<TenantOption[]>([]);
  const [selectedId, setSelectedId]       = useState<string>('');
  const [loadingTenants, setLoadingTenants] = useState(true);
  const [loadingData, setLoadingData]     = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: EMPTY,
  });

  // ── Carrega lista de empresas ──────────────────────────────────────────────

  useEffect(() => {
    const load = async () => {
      setLoadingTenants(true);
      try {
        const { data, error } = await supabase.rpc('get_platform_tenants');
        if (error) throw error;
        const list = (data ?? []) as TenantOption[];
        setTenants(list);
        // Seleciona automaticamente a primeira empresa não-platform
        const first = list.find(t => !t.is_platform) ?? list[0];
        if (first) setSelectedId(first.id);
      } catch (err: unknown) {
        toast.error('Erro ao buscar empresas', { description: (err as Error).message });
      } finally {
        setLoadingTenants(false);
      }
    };
    load();
  }, []);

  // ── Carrega dados da empresa selecionada ───────────────────────────────────

  useEffect(() => {
    if (!selectedId) return;
    const load = async () => {
      setLoadingData(true);
      try {
        const { data, error } = await supabase
          .from('tenants')
          .select('name, primary_color, razao_social, cnpj, ie, email_contato, phone, website, sector, address_zip, address_street, address_number, address_complement, address_neighborhood, address_city, address_state, address_country')
          .eq('id', selectedId)
          .single();
        if (error) throw error;
        form.reset({
          tenant_name:          data.name            ?? '',
          primary_color:        data.primary_color   ?? '#0066CC',
          razao_social:         data.razao_social     ?? '',
          cnpj:                 data.cnpj             ?? '',
          ie:                   data.ie               ?? '',
          email_contato:        data.email_contato    ?? '',
          phone:                data.phone            ?? '',
          website:              data.website          ?? '',
          sector:               data.sector           ?? '',
          address_zip:          data.address_zip      ?? '',
          address_street:       data.address_street   ?? '',
          address_number:       data.address_number   ?? '',
          address_complement:   data.address_complement ?? '',
          address_neighborhood: data.address_neighborhood ?? '',
          address_city:         data.address_city     ?? '',
          address_state:        (data.address_state   ?? '').toUpperCase(),
          address_country:      data.address_country  ?? 'Brasil',
        });
      } catch (err: unknown) {
        toast.error('Erro ao carregar dados', { description: (err as Error).message });
      } finally {
        setLoadingData(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  // ── CEP auto-fill ──────────────────────────────────────────────────────────

  const handleCepBlur = async (value: string) => {
    setIsFetchingCep(true);
    const result = await fetchCep(value);
    setIsFetchingCep(false);
    if (!result) {
      if (value.replace(/\D/g, '').length === 8) toast.info('CEP não encontrado.');
      return;
    }
    form.setValue('address_street', result.logradouro);
    form.setValue('address_neighborhood', result.bairro);
    form.setValue('address_city', result.localidade);
    form.setValue('address_state', result.uf.toUpperCase());
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    if (!selectedId) return;
    setSubmitting(true);
    try {
      // update_tenant_commercial: SECURITY DEFINER, verifica is_platform_master() internamente
      const { error } = await supabase.rpc('update_tenant_commercial', {
        p_tenant_id:            selectedId,
        p_name:                 data.tenant_name,
        p_primary_color:        data.primary_color,
        p_logo_url:             null,
        p_logo_removed:         false,
        p_cnpj:                 data.cnpj                 || null,
        p_phone:                data.phone                || null,
        p_website:              data.website              || null,
        p_sector:               data.sector               || null,
        p_razao_social:         data.razao_social         || null,
        p_ie:                   data.ie                   || null,
        p_email_contato:        data.email_contato        || null,
        p_address_zip:          data.address_zip          || null,
        p_address_street:       data.address_street       || null,
        p_address_number:       data.address_number       || null,
        p_address_complement:   data.address_complement   || null,
        p_address_neighborhood: data.address_neighborhood || null,
        p_address_city:         data.address_city         || null,
        p_address_state:        data.address_state        ? data.address_state.toUpperCase() : null,
        p_address_country:      data.address_country      || null,
      });
      if (error) throw error;

      const nome = tenants.find(t => t.id === selectedId)?.name ?? 'Empresa';
      toast.success('Dados atualizados!', { description: `Perfil de "${nome}" salvo com sucesso.` });
    } catch (err: unknown) {
      toast.error('Erro ao salvar', { description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Selected tenant meta ───────────────────────────────────────────────────

  const selectedTenant = tenants.find(t => t.id === selectedId);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loadingTenants) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm">Carregando empresas...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl pb-10">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Perfil Comercial das Empresas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione uma empresa e preencha os dados comerciais, fiscais e de endereço.
          Essas informações aparecem em documentos e PDFs gerados pelo sistema.
        </p>
      </div>

      {/* Seletor de empresa */}
      <div className="bg-card border border-border rounded-xl p-4 space-y-3" data-onboarding="platform-company-profile-seletor">
        <Label className="text-sm font-semibold flex items-center gap-2">
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
          Empresa a editar
        </Label>
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="h-12 rounded-lg text-sm font-medium">
            <SelectValue placeholder="Selecione uma empresa...">
              {selectedTenant ? (
                <div className="flex items-center gap-2">
                  {selectedTenant.logo_url
                    ? <img src={selectedTenant.logo_url} className="h-5 w-5 rounded object-cover" alt="" />
                    : <div className="h-5 w-5 rounded flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ backgroundColor: selectedTenant.primary_color }}>{selectedTenant.name[0]}</div>
                  }
                  <span>{selectedTenant.name}</span>
                  {selectedTenant.is_platform && (
                    <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">Platform</Badge>
                  )}
                </div>
              ) : ''}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tenants.map(t => (
              <SelectItem key={t.id} value={t.id}>
                <div className="flex items-center gap-2">
                  {t.logo_url
                    ? <img src={t.logo_url} className="h-4 w-4 rounded object-cover" alt="" />
                    : <div className="h-4 w-4 rounded flex items-center justify-center text-[8px] font-bold text-white shrink-0" style={{ backgroundColor: t.primary_color }}>{t.name[0]}</div>
                  }
                  <span>{t.name}</span>
                  <span className="text-muted-foreground text-xs font-mono">({t.slug})</span>
                  {t.is_platform && <Badge className="text-[10px] px-1 py-0 bg-primary/10 text-primary border-0">Platform</Badge>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Formulário */}
      {loadingData ? (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          <span className="text-sm">Carregando dados...</span>
        </div>
      ) : selectedId ? (
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

          {/* ── Seção 1: Identificação ──────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Identificação</p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">Nome fantasia *</Label>
              <Input
                placeholder="Ex: ACME Engenharia"
                className="h-11 rounded-lg"
                {...form.register('tenant_name')}
              />
              {form.formState.errors.tenant_name && (
                <p className="text-xs text-destructive font-medium">{form.formState.errors.tenant_name.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">Razão Social</Label>
              <Input
                placeholder="Ex: ACME Engenharia e Construções Ltda"
                className="h-11 rounded-lg"
                {...form.register('razao_social')}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Segmento de Mercado</Label>
                <Controller
                  control={form.control}
                  name="sector"
                  render={({ field }) => (
                    <Select value={field.value || ''} onValueChange={v => field.onChange(v ?? '')}>
                      <SelectTrigger className="min-h-[44px] rounded-lg text-sm">
                        <SelectValue placeholder="Selecione...">
                          {field.value || ''}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {SECTORS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" /> Cor primária
                </Label>
                <Controller
                  control={form.control}
                  name="primary_color"
                  render={({ field }) => (
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={field.value}
                        onChange={e => field.onChange(e.target.value)}
                        className="h-11 w-14 rounded-lg cursor-pointer border border-input bg-background p-1 shrink-0"
                      />
                      <Input
                        placeholder="#0066CC"
                        className="h-11 rounded-lg font-mono flex-1"
                        value={field.value}
                        onChange={e => field.onChange(e.target.value)}
                      />
                    </div>
                  )}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Seção 2: Dados Fiscais ──────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Dados Fiscais</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" /> CNPJ
                </Label>
                <Input placeholder="00.000.000/0001-00" className="h-11 rounded-lg" {...form.register('cnpj')} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Inscrição Estadual</Label>
                <Input placeholder="000.000.000.000" className="h-11 rounded-lg" {...form.register('ie')} />
              </div>
            </div>
          </div>

          <Separator />

          {/* ── Seção 3: Contato Comercial ──────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Contato Comercial</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> E-mail de contato
                </Label>
                <Input
                  placeholder="contato@empresa.com.br"
                  className="h-11 rounded-lg"
                  {...form.register('email_contato')}
                />
                {form.formState.errors.email_contato && (
                  <p className="text-xs text-destructive font-medium">{form.formState.errors.email_contato.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5" /> Telefone
                </Label>
                <Input placeholder="(11) 99999-9999" className="h-11 rounded-lg" {...form.register('phone')} />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold flex items-center gap-1.5">
                <Globe2 className="h-3.5 w-3.5" /> Website
              </Label>
              <Input placeholder="https://www.empresa.com.br" className="h-11 rounded-lg" {...form.register('website')} />
            </div>
          </div>

          <Separator />

          {/* ── Seção 4: Endereço ───────────────────────────────────────── */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Endereço</p>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">CEP</Label>
              <div className="relative">
                <Input
                  placeholder="00000-000"
                  className="h-11 rounded-lg pr-10"
                  {...form.register('address_zip', {
                    onBlur: e => handleCepBlur(e.target.value),
                  })}
                />
                {isFetchingCep && (
                  <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">Ao sair do campo, logradouro e cidade são preenchidos automaticamente.</p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-sm font-semibold">Logradouro</Label>
                <Input placeholder="Rua, Avenida..." className="h-11 rounded-lg" {...form.register('address_street')} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Número</Label>
                <Input placeholder="123" className="h-11 rounded-lg" {...form.register('address_number')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Complemento</Label>
                <Input placeholder="Sala, Andar..." className="h-11 rounded-lg" {...form.register('address_complement')} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Bairro</Label>
                <Input placeholder="Centro" className="h-11 rounded-lg" {...form.register('address_neighborhood')} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-sm font-semibold">Cidade</Label>
                <Input placeholder="São Paulo" className="h-11 rounded-lg" {...form.register('address_city')} />
              </div>
              <div className="space-y-1">
                <Label className="text-sm font-semibold">UF</Label>
                <Input
                  placeholder="SP"
                  maxLength={2}
                  className="h-11 rounded-lg"
                  {...form.register('address_state', {
                    onChange: e => { e.target.value = e.target.value.toUpperCase(); },
                  })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-sm font-semibold">País</Label>
              <Input placeholder="Brasil" className="h-11 rounded-lg" {...form.register('address_country')} />
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              className="h-11 px-8 rounded-xl font-semibold"
              disabled={submitting || loadingData}
            >
              {submitting
                ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
                : <><Save className="h-4 w-4 mr-2" />Salvar Alterações</>
              }
            </Button>
          </div>

        </form>
      ) : (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <p className="text-sm">Selecione uma empresa para editar.</p>
        </div>
      )}
    </div>
  );
}
