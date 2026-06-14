import React, { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Building2, Loader2, Save, Hash, Phone, Globe2,
  Mail, MapPin, FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { fetchOwnTenantCommercial, updateOwnTenantCommercial } from '@/src/services/tenantManagementService';
import { useTenant } from '@/src/contexts/TenantContext';

import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Separator } from '@/src/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Badge } from '@/src/components/ui/badge';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
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
});
type FormValues = z.infer<typeof schema>;

// ─── Constantes ───────────────────────────────────────────────────────────────

const SECTORS = [
  'Engenharia Civil',
  'Engenharia Elétrica',
  'Manutenção Industrial',
  'Construção Civil',
  'Instalações Prediais',
  'Telecomunicações',
  'TI e Tecnologia',
  'Outro',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function fetchCep(cep: string): Promise<{ logradouro: string; bairro: string; localidade: string; uf: string } | null> {
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
    const json = await res.json();
    if (json.erro) return null;
    return json;
  } catch {
    return null;
  }
}

// ─── Componente ───────────────────────────────────────────────────────────────

export default function CompanyProfile() {
  const { tenant } = useTenant();
  const [loading, setLoading]       = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isFetchingCep, setIsFetchingCep] = useState(false);
  const [tenantName, setTenantName] = useState('');

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      razao_social: '', cnpj: '', ie: '', email_contato: '',
      phone: '', website: '', sector: '',
      address_zip: '', address_street: '', address_number: '',
      address_complement: '', address_neighborhood: '',
      address_city: '', address_state: '', address_country: 'Brasil',
    },
  });

  // ── Fetch dados atuais ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!tenant?.id) return;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchOwnTenantCommercial(tenant.id);

        setTenantName(data.name ?? '');
        form.reset({
          razao_social:         data.razao_social         ?? '',
          cnpj:                 data.cnpj                 ?? '',
          ie:                   data.ie                   ?? '',
          email_contato:        data.email_contato         ?? '',
          phone:                data.phone                ?? '',
          website:              data.website              ?? '',
          sector:               data.sector               ?? '',
          address_zip:          data.address_zip          ?? '',
          address_street:       data.address_street       ?? '',
          address_number:       data.address_number       ?? '',
          address_complement:   data.address_complement   ?? '',
          address_neighborhood: data.address_neighborhood ?? '',
          address_city:         data.address_city         ?? '',
          address_state:        (data.address_state       ?? '').toUpperCase(),
          address_country:      data.address_country      ?? 'Brasil',
        });
      } catch (err: unknown) {
        toast.error('Erro ao carregar dados da empresa', { description: (err as Error).message });
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

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
    form.setValue('address_state', result.uf);
  };

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (data: FormValues) => {
    if (!tenant?.id) return;
    setSubmitting(true);
    try {
      // UPDATE direto em tenants não tem policy para usuário comum — usa RPC SECURITY DEFINER
      // que restringe internamente quais colunas podem ser alteradas (nunca name/slug/is_platform).
      const { error } = await updateOwnTenantCommercial({
        p_razao_social:         data.razao_social         || null,
        p_cnpj:                 data.cnpj                 || null,
        p_ie:                   data.ie                   || null,
        p_email_contato:        data.email_contato        || null,
        p_phone:                data.phone                || null,
        p_website:              data.website              || null,
        p_sector:               data.sector               || null,
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
      toast.success('Dados atualizados!', { description: 'Perfil da empresa salvo com sucesso.' });
    } catch (err: unknown) {
      toast.error('Erro ao salvar', { description: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin mr-2" />
        <span className="text-sm">Carregando dados da empresa...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-2xl pb-10">

      {/* Header */}
      <div data-onboarding="company-profile-header">
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Building2 className="h-6 w-6 text-primary" />
          Perfil da Empresa
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Dados comerciais e fiscais de{' '}
          <span className="font-semibold text-foreground">{tenantName}</span>
          {' '}— usados em documentos, contratos e PDFs gerados pelo sistema.
        </p>
      </div>

      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">

        {/* ── Seção 1: Identificação ──────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Identificação</p>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold">Nome fantasia</Label>
            <div className="h-11 flex items-center px-3 rounded-lg border border-border bg-muted/50 text-sm text-muted-foreground">
              {tenantName}
              <Badge variant="outline" className="ml-2 text-[10px]">Imutável aqui</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Alterado em Configurações → Identidade Visual.</p>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold">Razão Social</Label>
            <Input
              placeholder="Ex: ACME Engenharia e Construções Ltda"
              className="h-11 rounded-lg"
              {...form.register('razao_social')}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold">Segmento de Mercado</Label>
            <Controller
              control={form.control}
              name="sector"
              render={({ field }) => (
                <Select value={field.value || ''} onValueChange={(val) => field.onChange(val ?? '')}>
                  <SelectTrigger className="min-h-[44px] w-full rounded-lg text-sm">
                    <SelectValue placeholder="Selecione o segmento...">
                      {field.value || ''}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SECTORS.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <Separator />

        {/* ── Seção 2: Dados Fiscais ──────────────────────────────────────── */}
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
              <Input
                placeholder="00.000.000/0001-00"
                className="h-11 rounded-lg"
                {...form.register('cnpj')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Inscrição Estadual</Label>
              <Input
                placeholder="000.000.000.000"
                className="h-11 rounded-lg"
                {...form.register('ie')}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* ── Seção 3: Contato ────────────────────────────────────────────── */}
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
              <Input
                placeholder="(11) 99999-9999"
                className="h-11 rounded-lg"
                {...form.register('phone')}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold flex items-center gap-1.5">
              <Globe2 className="h-3.5 w-3.5" /> Website
            </Label>
            <Input
              placeholder="https://www.empresa.com.br"
              className="h-11 rounded-lg"
              {...form.register('website')}
            />
          </div>
        </div>

        <Separator />

        {/* ── Seção 4: Endereço ───────────────────────────────────────────── */}
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
                  onBlur: (e) => handleCepBlur(e.target.value),
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
              <Input
                placeholder="Rua, Avenida..."
                className="h-11 rounded-lg"
                {...form.register('address_street')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Número</Label>
              <Input
                placeholder="123"
                className="h-11 rounded-lg"
                {...form.register('address_number')}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Complemento</Label>
              <Input
                placeholder="Sala, Andar..."
                className="h-11 rounded-lg"
                {...form.register('address_complement')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Bairro</Label>
              <Input
                placeholder="Centro"
                className="h-11 rounded-lg"
                {...form.register('address_neighborhood')}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-sm font-semibold">Cidade</Label>
              <Input
                placeholder="São Paulo"
                className="h-11 rounded-lg"
                {...form.register('address_city')}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm font-semibold">UF</Label>
              <Input
                placeholder="SP"
                maxLength={2}
                className="h-11 rounded-lg"
                {...form.register('address_state', {
                  onChange: (e) => {
                    e.target.value = e.target.value.toUpperCase();
                  },
                })}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-sm font-semibold">País</Label>
            <Input
              placeholder="Brasil"
              className="h-11 rounded-lg"
              {...form.register('address_country')}
            />
          </div>
        </div>

        {/* ── Footer fixo ─────────────────────────────────────────────────── */}
        <div className="flex justify-end pt-2" data-onboarding="company-profile-salvar">
          <Button type="submit" className="h-11 px-8 rounded-xl font-semibold" disabled={submitting}>
            {submitting
              ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Salvando...</>
              : <><Save className="h-4 w-4 mr-2" />Salvar Alterações</>
            }
          </Button>
        </div>

      </form>
    </div>
  );
}
