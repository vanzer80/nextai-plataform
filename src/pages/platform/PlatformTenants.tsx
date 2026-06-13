import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Plus, Globe, Loader2, Palette, MoreHorizontal,
  Pencil, Image as ImageIcon, Users, PowerOff, Power, Search,
  Phone, Globe2, Building2, Mail, Hash, MapPin, FileText,
  Trash2, RotateCcw, Eye, EyeOff,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/src/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/src/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Separator } from '@/src/components/ui/separator';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createSchema = z.object({
  tenant_name:    z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  tenant_slug:    z.string().regex(/^[a-z][a-z0-9-]{2,49}$/, 'Apenas lowercase, letras/números/hífens, 3–50 chars, deve iniciar com letra'),
  primary_color:  z.string().regex(/^#[0-9a-fA-F]{6}$/),
  admin_name:     z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  admin_email:    z.string().email('E-mail inválido'),
  admin_password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});
type CreateFormValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  tenant_name:         z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  primary_color:       z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
  razao_social:        z.string().max(200).optional(),
  cnpj:                z.string().max(18).optional(),
  ie:                  z.string().max(30).optional(),
  email_contato:       z.string().email('E-mail inválido').optional().or(z.literal('')),
  phone:               z.string().max(20).optional(),
  website:             z.string().max(200).optional(),
  sector:              z.string().optional(),
  address_zip:         z.string().max(10).optional(),
  address_street:      z.string().max(200).optional(),
  address_number:      z.string().max(20).optional(),
  address_complement:  z.string().max(100).optional(),
  address_neighborhood:z.string().max(100).optional(),
  address_city:        z.string().max(100).optional(),
  address_state:       z.string().max(2).optional(),
  address_country:     z.string().max(100).optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  logo_url: string | null;
  is_active: boolean;
  is_platform: boolean;
  created_at: string;
  cnpj: string | null;
  phone: string | null;
  website: string | null;
  sector: string | null;
  razao_social: string | null;
  ie: string | null;
  email_contato: string | null;
  address_zip: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string | null;
  user_count: number;
  master_name: string | null;
  master_email: string | null;
  deleted_at: string | null;
}

type DeleteMode = 'soft' | 'hard';

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

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const LOGO_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function uploadLogo(file: File, slug: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${slug}/logo.${ext}`;
  const { error } = await supabase.storage
    .from('tenant-assets')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Erro ao fazer upload do logo: ${error.message}`);
  const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
  return `${data.publicUrl}?t=${Date.now()}`;
}

function validateLogoFile(file: File): string | null {
  if (!LOGO_MIME.includes(file.type)) return 'Use PNG, JPEG ou WebP.';
  if (file.size > MAX_LOGO_SIZE) return 'Arquivo muito grande. Máximo 2 MB.';
  return null;
}

function LogoPreview({ url }: { url: string | null }) {
  return url ? (
    <img src={url} alt="Logo" className="h-10 w-10 rounded-lg object-cover border border-border shrink-0" />
  ) : (
    <div className="h-10 w-10 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted shrink-0">
      <ImageIcon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

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

export default function PlatformTenants() {
  const navigate = useNavigate();

  const [tenants, setTenants]   = useState<TenantRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');

  // Create dialog
  const [isCreateOpen, setIsCreateOpen]   = useState(false);
  const [isSubmitting, setIsSubmitting]   = useState(false);
  const [createLogoFile, setCreateLogoFile]       = useState<File | null>(null);
  const [createLogoPreview, setCreateLogoPreview] = useState<string | null>(null);
  const createLogoRef = useRef<HTMLInputElement>(null);
  const [slugTouched, setSlugTouched]     = useState(false);

  const isRestoringRef = useRef(false);

  // Edit sheet
  const [editingTenant, setEditingTenant]         = useState<TenantRow | null>(null);
  const [isEditOpen, setIsEditOpen]               = useState(false);
  const [isEditSubmitting, setIsEditSubmitting]   = useState(false);
  const [editLogoFile, setEditLogoFile]           = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview]     = useState<string | null>(null);
  const [editLogoRemoved, setEditLogoRemoved]     = useState(false);
  const [isFetchingCep, setIsFetchingCep]         = useState(false);
  const editLogoRef = useRef<HTMLInputElement>(null);

  // Toggle active
  const [toggleTarget, setToggleTarget] = useState<TenantRow | null>(null);
  const [togglingId, setTogglingId]     = useState<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget]       = useState<TenantRow | null>(null);
  const [deleteMode, setDeleteMode]           = useState<DeleteMode>('soft');
  const [confirmSlugInput, setConfirmSlugInput] = useState('');
  const [isDeleting, setIsDeleting]           = useState(false);
  const [showDeleted, setShowDeleted]         = useState(false);

  // Forms
  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      tenant_name: '', tenant_slug: '', primary_color: '#0066CC',
      admin_name: '', admin_email: '', admin_password: '',
    },
  });

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      tenant_name: '', primary_color: '#0066CC',
      razao_social: '', cnpj: '', ie: '', email_contato: '',
      phone: '', website: '', sector: '',
      address_zip: '', address_street: '', address_number: '',
      address_complement: '', address_neighborhood: '',
      address_city: '', address_state: '', address_country: 'Brasil',
    },
  });

  // Slug auto-gerado ao digitar nome (enquanto não foi editado manualmente)
  const watchedName = createForm.watch('tenant_name');
  useEffect(() => {
    if (slugTouched || !watchedName) return;
    const generated = watchedName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    createForm.setValue('tenant_slug', generated, { shouldValidate: false });
  }, [watchedName, slugTouched, createForm]);

  const filtered = search
    ? tenants.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
      )
    : tenants;

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchTenants = async (includeDeleted = showDeleted) => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_platform_tenants', {
        p_include_deleted: includeDeleted,
      });
      if (error) throw error;
      setTenants((data ?? []) as TenantRow[]);
    } catch (err: unknown) {
      toast.error('Erro ao buscar empresas', { description: (err as Error).message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(showDeleted); }, [showDeleted]);

  // ── CEP auto-fill ──────────────────────────────────────────────────────────

  const handleCepBlur = async (value: string) => {
    setIsFetchingCep(true);
    const result = await fetchCep(value);
    setIsFetchingCep(false);
    if (!result) {
      if (value.replace(/\D/g, '').length === 8) toast.info('CEP não encontrado.');
      return;
    }
    editForm.setValue('address_street', result.logradouro);
    editForm.setValue('address_neighborhood', result.bairro);
    editForm.setValue('address_city', result.localidade);
    editForm.setValue('address_state', result.uf);
  };

  // ── Logo handlers ──────────────────────────────────────────────────────────

  const handleCreateLogoSelect = (file: File | undefined) => {
    if (!file) return;
    const err = validateLogoFile(file);
    if (err) { toast.error('Arquivo inválido', { description: err }); return; }
    if (createLogoPreview) URL.revokeObjectURL(createLogoPreview);
    setCreateLogoFile(file);
    setCreateLogoPreview(URL.createObjectURL(file));
  };

  const handleEditLogoSelect = (file: File | undefined) => {
    if (!file) return;
    const err = validateLogoFile(file);
    if (err) { toast.error('Arquivo inválido', { description: err }); return; }
    if (editLogoPreview?.startsWith('blob:')) URL.revokeObjectURL(editLogoPreview);
    setEditLogoFile(file);
    setEditLogoPreview(URL.createObjectURL(file));
    setEditLogoRemoved(false);
  };

  const handleEditLogoRemove = () => {
    if (editLogoPreview?.startsWith('blob:')) URL.revokeObjectURL(editLogoPreview);
    setEditLogoFile(null);
    setEditLogoPreview(null);
    setEditLogoRemoved(true);
  };

  // ── Dialog/Sheet open/close ────────────────────────────────────────────────

  const closeCreate = () => {
    setIsCreateOpen(false);
    createForm.reset();
    setCreateLogoFile(null);
    if (createLogoPreview) URL.revokeObjectURL(createLogoPreview);
    setCreateLogoPreview(null);
    setSlugTouched(false);
  };

  const openEdit = (t: TenantRow) => {
    setEditingTenant(t);
    editForm.reset({
      tenant_name:         t.name,
      primary_color:       t.primary_color,
      razao_social:        t.razao_social        ?? '',
      cnpj:                t.cnpj                ?? '',
      ie:                  t.ie                  ?? '',
      email_contato:       t.email_contato        ?? '',
      phone:               t.phone               ?? '',
      website:             t.website             ?? '',
      sector:              t.sector              ?? '',
      address_zip:         t.address_zip         ?? '',
      address_street:      t.address_street      ?? '',
      address_number:      t.address_number      ?? '',
      address_complement:  t.address_complement  ?? '',
      address_neighborhood:t.address_neighborhood ?? '',
      address_city:        t.address_city        ?? '',
      address_state:       (t.address_state       ?? '').toUpperCase(),
      address_country:     t.address_country     ?? 'Brasil',
    });
    setEditLogoFile(null);
    setEditLogoPreview(t.logo_url);
    setEditLogoRemoved(false);
    setIsEditOpen(true);
  };

  const closeEdit = () => {
    setIsEditOpen(false);
    setEditingTenant(null);
    setEditLogoFile(null);
    if (editLogoPreview?.startsWith('blob:')) URL.revokeObjectURL(editLogoPreview);
    setEditLogoPreview(null);
    setEditLogoRemoved(false);
  };

  // ── Submit handlers ────────────────────────────────────────────────────────

  const onCreateSubmit = async (data: CreateFormValues) => {
    setIsSubmitting(true);
    try {
      let logoUrl: string | null = null;
      if (createLogoFile) logoUrl = await uploadLogo(createLogoFile, data.tenant_slug);

      const { data: result, error } = await supabase.functions.invoke('admin-provision-tenant', {
        body: {
          tenant: { name: data.tenant_name, slug: data.tenant_slug, primary_color: data.primary_color, logo_url: logoUrl },
          admin:  { full_name: data.admin_name, email: data.admin_email, password: data.admin_password },
        },
      });

      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);

      if (result?.warning) {
        toast.warning('Empresa criada com aviso', { description: result.warning });
      } else {
        toast.success('Empresa provisionada!', { description: `"${data.tenant_name}" (${data.tenant_slug}) está pronta.` });
      }
      closeCreate();
      await fetchTenants();
    } catch (err: unknown) {
      toast.error('Erro ao provisionar empresa', { description: (err as Error).message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (data: EditFormValues) => {
    if (!editingTenant) return;
    setIsEditSubmitting(true);
    try {
      let newLogoUrl: string | null = null;
      if (editLogoFile) newLogoUrl = await uploadLogo(editLogoFile, editingTenant.slug);

      // UPDATE direto cross-tenant é bloqueado silenciosamente pelo RLS.
      // Usar RPC SECURITY DEFINER update_tenant_commercial.
      const { error } = await supabase.rpc('update_tenant_commercial', {
        p_tenant_id:            editingTenant.id,
        p_name:                 data.tenant_name,
        p_primary_color:        data.primary_color,
        p_logo_url:             newLogoUrl,
        p_logo_removed:         editLogoRemoved,
        p_cnpj:                 data.cnpj                || null,
        p_phone:                data.phone               || null,
        p_website:              data.website             || null,
        p_sector:               data.sector              || null,
        p_razao_social:         data.razao_social        || null,
        p_ie:                   data.ie                  || null,
        p_email_contato:        data.email_contato       || null,
        p_address_zip:          data.address_zip         || null,
        p_address_street:       data.address_street      || null,
        p_address_number:       data.address_number      || null,
        p_address_complement:   data.address_complement  || null,
        p_address_neighborhood: data.address_neighborhood || null,
        p_address_city:         data.address_city        || null,
        p_address_state:        data.address_state       || null,
        p_address_country:      data.address_country     || null,
      });
      if (error) throw error;

      toast.success('Empresa atualizada!', { description: `"${data.tenant_name}" salvo com sucesso.` });
      closeEdit();
      await fetchTenants();
    } catch (err: unknown) {
      toast.error('Erro ao atualizar empresa', { description: (err as Error).message });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!toggleTarget) return;
    const target = toggleTarget;
    const newValue = !target.is_active;
    setTogglingId(target.id);
    setToggleTarget(null);
    try {
      const { error } = await supabase.from('tenants').update({ is_active: newValue }).eq('id', target.id);
      if (error) throw error;
      setTenants(prev => prev.map(t => t.id === target.id ? { ...t, is_active: newValue } : t));
      toast.success(newValue ? `"${target.name}" ativada.` : `"${target.name}" suspensa.`);
    } catch (err: unknown) {
      toast.error('Erro ao alterar status', { description: (err as Error).message });
    } finally {
      setTogglingId(null);
    }
  };

  const openDelete = (t: TenantRow) => {
    setDeleteTarget(t);
    setDeleteMode('soft');
    setConfirmSlugInput('');
  };

  const closeDelete = () => {
    setDeleteTarget(null);
    setConfirmSlugInput('');
    setDeleteMode('soft');
  };

  const handleSoftDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const { error } = await supabase.rpc('soft_delete_tenant', { p_tenant_id: deleteTarget.id });
      if (error) throw error;
      toast.success(`"${deleteTarget.name}" removida do sistema.`, {
        description: 'Os dados foram preservados. Use "Mostrar removidas" para restaurar.',
      });
      closeDelete();
      await fetchTenants();
    } catch (err: unknown) {
      toast.error('Erro ao remover empresa', { description: (err as Error).message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleHardDelete = async () => {
    if (!deleteTarget || confirmSlugInput !== deleteTarget.slug) return;
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-tenant', {
        body: { tenantId: deleteTarget.id, confirmSlug: deleteTarget.slug },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      toast.success(`"${deleteTarget.name}" deletada permanentemente.`, {
        description: `${data?.deletedUsers ?? 0} usuário(s) removido(s).`,
      });
      closeDelete();
      await fetchTenants();
    } catch (err: unknown) {
      toast.error('Erro ao deletar empresa', { description: (err as Error).message });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleRestore = async (t: TenantRow) => {
    if (isRestoringRef.current) return;
    isRestoringRef.current = true;
    try {
      const { error } = await supabase.rpc('restore_tenant', { p_tenant_id: t.id });
      if (error) throw error;
      toast.success(`"${t.name}" restaurada com sucesso.`);
      await fetchTenants();
    } catch (err: unknown) {
      toast.error('Erro ao restaurar empresa', { description: (err as Error).message });
    } finally {
      isRestoringRef.current = false;
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Empresas
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie as empresas clientes da plataforma NextAI.</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            variant="outline"
            onClick={() => setShowDeleted(v => !v)}
            className="h-11 px-4 rounded-xl font-semibold flex-1 sm:flex-none"
          >
            {showDeleted ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
            {showDeleted ? 'Ocultar removidas' : 'Mostrar removidas'}
          </Button>
          <Button
            onClick={() => setIsCreateOpen(true)}
            data-onboarding="platform-tenants-novo"
            className="h-11 px-6 rounded-xl font-semibold flex-1 sm:flex-none"
          >
            <Plus className="h-5 w-5 mr-1 -ml-1" />
            Nova Empresa
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nome ou slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 pl-9 rounded-lg"
        />
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[300px]" data-onboarding="platform-tenants-lista">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-64">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p className="text-sm">Carregando empresas...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-semibold text-foreground">Empresa</TableHead>
                  <TableHead className="font-semibold text-foreground">Admin Master</TableHead>
                  <TableHead className="font-semibold text-foreground">Slug</TableHead>
                  <TableHead className="font-semibold text-foreground">Cor</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Usuários</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground">Criado em</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/50 transition-colors border-border">

                    {/* Empresa */}
                    <TableCell className="font-semibold text-foreground text-sm">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        {t.logo_url
                          ? <img src={t.logo_url} alt={t.name} className="h-6 w-6 rounded object-cover shrink-0" />
                          : <div className="h-6 w-6 rounded shrink-0 flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: t.primary_color }}>{t.name[0]}</div>
                        }
                        <div className="flex flex-col min-w-0">
                          <span className="truncate">{t.name}</span>
                          {t.sector && <span className="text-[10px] font-normal text-muted-foreground">{t.sector}</span>}
                        </div>
                        {t.is_platform && <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0 shrink-0">Platform</Badge>}
                      </div>
                    </TableCell>

                    {/* Admin Master */}
                    <TableCell className="min-w-[160px]">
                      <div className="flex flex-col">
                        <span className="text-sm text-foreground font-medium">{t.master_name ?? '—'}</span>
                        {t.master_email && (
                          <span className="text-xs text-muted-foreground">{t.master_email}</span>
                        )}
                      </div>
                    </TableCell>

                    {/* Slug */}
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{t.slug}</Badge>
                    </TableCell>

                    {/* Cor */}
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-5 w-5 rounded-full border border-border shadow-sm shrink-0" style={{ backgroundColor: t.primary_color }} />
                        <span className="font-mono text-xs text-muted-foreground">{t.primary_color}</span>
                      </div>
                    </TableCell>

                    {/* Usuários */}
                    <TableCell className="text-center">
                      <Badge variant="secondary">{t.user_count ?? 0}</Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      {t.deleted_at
                        ? <Badge className="bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400 border-0">Removida</Badge>
                        : t.is_active
                          ? <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-0">Ativa</Badge>
                          : <Badge className="bg-muted text-muted-foreground border-0">Inativa</Badge>
                      }
                    </TableCell>

                    {/* Criado em */}
                    <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                      {format(new Date(t.created_at), 'dd MMM yyyy', { locale: ptBR })}
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={togglingId === t.id}
                          className="inline-flex items-center justify-center h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                        >
                          {togglingId === t.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <MoreHorizontal className="h-4 w-4" />
                          }
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          {!t.deleted_at && (
                            <DropdownMenuItem className="cursor-pointer font-medium" onClick={() => openEdit(t)}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="cursor-pointer font-medium"
                            onClick={() => navigate(`/platform/users?tenant_id=${t.id}`)}
                          >
                            <Users className="mr-2 h-4 w-4" /> Ver Usuários
                          </DropdownMenuItem>
                          {!t.is_platform && !t.deleted_at && (
                            <DropdownMenuItem
                              variant="destructive"
                              className="cursor-pointer font-medium"
                              onClick={() => setToggleTarget(t)}
                            >
                              {t.is_active
                                ? <><PowerOff className="mr-2 h-4 w-4" /> Suspender</>
                                : <><Power className="mr-2 h-4 w-4" /> Ativar</>
                              }
                            </DropdownMenuItem>
                          )}
                          {!t.is_platform && t.deleted_at && (
                            <DropdownMenuItem
                              className="cursor-pointer font-medium text-emerald-600 focus:text-emerald-600"
                              onClick={() => handleRestore(t)}
                            >
                              <RotateCcw className="mr-2 h-4 w-4" /> Restaurar
                            </DropdownMenuItem>
                          )}
                          {!t.is_platform && (
                            <DropdownMenuItem
                              variant="destructive"
                              className="cursor-pointer font-medium"
                              onClick={() => openDelete(t)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Deletar empresa
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground font-medium">
                      {search ? `Nenhuma empresa encontrada para "${search}".` : 'Nenhuma empresa encontrada.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Create Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => { if (!open) closeCreate(); }}>
        <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 pb-2 border-b border-border bg-muted/40">
            <DialogTitle className="text-xl font-bold">Nova Empresa</DialogTitle>
            <DialogDescription>
              Cria a empresa e o primeiro usuário Master. O acesso estará disponível imediatamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Empresa</p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-sm font-semibold">Nome da empresa</Label>
                  <Input placeholder="Ex: ACME Engenharia" className="h-11 rounded-lg" {...createForm.register('tenant_name')} />
                  {createForm.formState.errors.tenant_name && <p className="text-xs text-destructive font-medium">{createForm.formState.errors.tenant_name.message}</p>}
                </div>

                <div className="space-y-1 sm:col-span-2">
                  <Label className="text-sm font-semibold flex items-center gap-2"><ImageIcon className="h-4 w-4" /> Logo (opcional)</Label>
                  <div className="flex items-center gap-3">
                    <LogoPreview url={createLogoPreview} />
                    <div className="flex-1">
                      <input ref={createLogoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleCreateLogoSelect(e.target.files?.[0])} />
                      <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg text-xs font-semibold" onClick={() => createLogoRef.current?.click()}>
                        {createLogoPreview ? 'Trocar imagem' : 'Selecionar imagem'}
                      </Button>
                      <p className="text-xs text-muted-foreground mt-1">PNG, JPEG ou WebP · máx. 2 MB</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Slug</Label>
                  <Input
                    placeholder="acme-eng"
                    className="h-11 rounded-lg font-mono"
                    {...createForm.register('tenant_slug', {
                      onBlur: (e) => { if (e.target.value) setSlugTouched(true); },
                    })}
                  />
                  {createForm.formState.errors.tenant_slug && <p className="text-xs text-destructive font-medium">{createForm.formState.errors.tenant_slug.message}</p>}
                  <p className="text-xs text-muted-foreground">Identificador único, imutável após criação.</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold flex items-center gap-2"><Palette className="h-4 w-4" /> Cor primária</Label>
                  <Controller
                    control={createForm.control}
                    name="primary_color"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <input type="color" value={field.value} onChange={(e) => field.onChange(e.target.value)} className="h-11 w-14 rounded-lg cursor-pointer border border-input bg-background p-1" />
                        <Input placeholder="#0066CC" className="h-11 rounded-lg font-mono flex-1" value={field.value} onChange={(e) => field.onChange(e.target.value)} />
                      </div>
                    )}
                  />
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Administrador Master</p>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Nome completo</Label>
                    <Input placeholder="Ex: Ana Souza" className="h-11 rounded-lg" {...createForm.register('admin_name')} />
                    {createForm.formState.errors.admin_name && <p className="text-xs text-destructive font-medium">{createForm.formState.errors.admin_name.message}</p>}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold">E-mail</Label>
                      <Input placeholder="ana@acme.com" className="h-11 rounded-lg" {...createForm.register('admin_email')} />
                      {createForm.formState.errors.admin_email && <p className="text-xs text-destructive font-medium">{createForm.formState.errors.admin_email.message}</p>}
                    </div>
                    <div className="space-y-1">
                      <Label className="text-sm font-semibold">Senha temporária</Label>
                      <Input type="password" placeholder="Mín. 8 caracteres" className="h-11 rounded-lg" {...createForm.register('admin_password')} />
                      {createForm.formState.errors.admin_password && <p className="text-xs text-destructive font-medium">{createForm.formState.errors.admin_password.message}</p>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/40 sm:justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-lg h-11 font-semibold" onClick={closeCreate} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" className="rounded-lg h-11 font-semibold" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Provisionar Empresa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Edit Sheet ─────────────────────────────────────────────────────── */}
      <Sheet open={isEditOpen} onOpenChange={(open) => { if (!open) closeEdit(); }}>
        <SheetContent side="right" className="data-[side=right]:sm:max-w-[580px] p-0 gap-0">
          <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="h-full flex flex-col">

            {/* Sheet header */}
            <div className="px-6 py-5 border-b border-border bg-muted/40 shrink-0 pr-14">
              <SheetTitle className="text-lg font-bold leading-tight">Editar Empresa</SheetTitle>
              <SheetDescription className="mt-0.5">
                <span className="font-medium text-foreground">{editingTenant?.name}</span>
                {' · slug: '}
                <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{editingTenant?.slug}</code>
              </SheetDescription>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6">

              {/* ── Seção 1: Identificação ───────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" /> Identificação
                </p>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Nome fantasia *</Label>
                  <Input placeholder="Ex: ACME Engenharia" className="h-11 rounded-lg" {...editForm.register('tenant_name')} />
                  {editForm.formState.errors.tenant_name && <p className="text-xs text-destructive font-medium">{editForm.formState.errors.tenant_name.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Razão Social</Label>
                  <Input placeholder="Ex: ACME Engenharia Ltda" className="h-11 rounded-lg" {...editForm.register('razao_social')} />
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Slug</Label>
                  <Input value={editingTenant?.slug ?? ''} disabled className="h-11 rounded-lg font-mono bg-muted/50 opacity-70" onChange={() => {}} />
                  <p className="text-xs text-muted-foreground">Imutável após criação — identificador de storage.</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Segmento</Label>
                  <Controller
                    control={editForm.control}
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

              {/* ── Seção 2: Dados Fiscais e Contato ─────────────────────── */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5" /> Dados Fiscais e Contato
                </p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" /> CNPJ
                    </Label>
                    <Input placeholder="00.000.000/0001-00" className="h-11 rounded-lg" {...editForm.register('cnpj')} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Inscrição Estadual</Label>
                    <Input placeholder="000.000.000.000" className="h-11 rounded-lg" {...editForm.register('ie')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5" /> E-mail de contato
                    </Label>
                    <Input placeholder="contato@empresa.com.br" className="h-11 rounded-lg" {...editForm.register('email_contato')} />
                    {editForm.formState.errors.email_contato && <p className="text-xs text-destructive font-medium">{editForm.formState.errors.email_contato.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Telefone
                    </Label>
                    <Input placeholder="(11) 99999-9999" className="h-11 rounded-lg" {...editForm.register('phone')} />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5" /> Website
                  </Label>
                  <Input placeholder="https://www.empresa.com.br" className="h-11 rounded-lg" {...editForm.register('website')} />
                </div>
              </div>

              <Separator />

              {/* ── Seção 3: Endereço ─────────────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" /> Endereço
                </p>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">CEP</Label>
                  <div className="relative">
                    <Input
                      placeholder="00000-000"
                      className="h-11 rounded-lg pr-10"
                      {...editForm.register('address_zip', {
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
                    <Input placeholder="Rua, Avenida..." className="h-11 rounded-lg" {...editForm.register('address_street')} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Número</Label>
                    <Input placeholder="123" className="h-11 rounded-lg" {...editForm.register('address_number')} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Complemento</Label>
                    <Input placeholder="Sala, Andar..." className="h-11 rounded-lg" {...editForm.register('address_complement')} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">Bairro</Label>
                    <Input placeholder="Centro" className="h-11 rounded-lg" {...editForm.register('address_neighborhood')} />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1 col-span-2">
                    <Label className="text-sm font-semibold">Cidade</Label>
                    <Input placeholder="São Paulo" className="h-11 rounded-lg" {...editForm.register('address_city')} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold">UF</Label>
                    <Input
                      placeholder="SP"
                      maxLength={2}
                      className="h-11 rounded-lg"
                      {...editForm.register('address_state', {
                        onChange: (e) => { e.target.value = e.target.value.toUpperCase(); },
                      })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">País</Label>
                  <Input placeholder="Brasil" className="h-11 rounded-lg" {...editForm.register('address_country')} />
                </div>
              </div>

              <Separator />

              {/* ── Seção 4: Identidade Visual ────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Palette className="h-3.5 w-3.5" /> Identidade Visual
                </p>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <ImageIcon className="h-4 w-4" /> Logo (opcional)
                  </Label>
                  <div className="flex items-center gap-3">
                    <LogoPreview url={editLogoPreview} />
                    <div className="flex-1 flex items-center gap-2 flex-wrap">
                      <input ref={editLogoRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => handleEditLogoSelect(e.target.files?.[0])} />
                      <Button type="button" variant="outline" size="sm" className="h-9 rounded-lg text-xs font-semibold" onClick={() => editLogoRef.current?.click()}>
                        {editLogoPreview ? 'Trocar imagem' : 'Selecionar imagem'}
                      </Button>
                      {editLogoPreview && (
                        <Button type="button" variant="ghost" size="sm" className="h-9 rounded-lg text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleEditLogoRemove}>
                          Remover
                        </Button>
                      )}
                      <p className="text-xs text-muted-foreground w-full">PNG, JPEG ou WebP · máx. 2 MB</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Palette className="h-4 w-4" /> Cor primária
                  </Label>
                  <Controller
                    control={editForm.control}
                    name="primary_color"
                    render={({ field }) => (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                          className="h-11 w-14 rounded-lg cursor-pointer border border-input bg-background p-1 shrink-0"
                        />
                        <Input
                          placeholder="#0066CC"
                          className="h-11 rounded-lg font-mono flex-1"
                          value={field.value}
                          onChange={(e) => field.onChange(e.target.value)}
                        />
                        <div
                          className="h-11 w-11 rounded-lg border border-border shrink-0 shadow-sm"
                          style={{ backgroundColor: field.value }}
                          title="Preview da cor"
                        />
                      </div>
                    )}
                  />
                  {editForm.formState.errors.primary_color && (
                    <p className="text-xs text-destructive font-medium">{editForm.formState.errors.primary_color.message}</p>
                  )}
                </div>
              </div>

              <Separator />

              {/* ── Seção 5: Administrador Master ─────────────────────────── */}
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" /> Administrador Master
                </p>
                <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
                  {editingTenant?.master_name || editingTenant?.master_email ? (
                    <>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{editingTenant.master_name ?? '—'}</span>
                        <Badge className="text-[10px] px-1.5 py-0 bg-primary/10 text-primary border-0">Master</Badge>
                      </div>
                      {editingTenant.master_email && (
                        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" />
                          <span className="break-all">{editingTenant.master_email}</span>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground pt-1 border-t border-border mt-2">
                        Para alterar e-mail ou senha do administrador, acesse o Dashboard Supabase → Authentication → Users.
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">Nenhum administrador Master encontrado para esta empresa.</p>
                  )}
                </div>
              </div>

            </div>

            {/* Sheet footer */}
            <div className="px-6 py-4 border-t border-border bg-muted/40 flex justify-end gap-2 shrink-0">
              <Button type="button" variant="outline" className="rounded-lg h-11 font-semibold" onClick={closeEdit} disabled={isEditSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-lg h-11 font-semibold" disabled={isEditSubmitting}>
                {isEditSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Alterações
              </Button>
            </div>

          </form>
        </SheetContent>
      </Sheet>

      {/* ── Toggle Active Confirmation ─────────────────────────────────────── */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => { if (!open) setToggleTarget(null); }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/40">
            <DialogTitle className="text-lg font-bold">
              {toggleTarget?.is_active ? 'Suspender empresa?' : 'Ativar empresa?'}
            </DialogTitle>
            <DialogDescription>
              {toggleTarget?.is_active
                ? <><span className="font-semibold text-foreground">{toggleTarget?.name}</span> será marcada como inativa. Usuários ainda poderão fazer login.</>
                : <><span className="font-semibold text-foreground">{toggleTarget?.name}</span> será reativada.</>
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-4 sm:justify-end gap-2">
            <Button variant="outline" className="rounded-lg h-10 font-semibold" onClick={() => setToggleTarget(null)}>Cancelar</Button>
            <Button
              variant={toggleTarget?.is_active ? 'destructive' : 'default'}
              className="rounded-lg h-10 font-semibold"
              onClick={handleToggleActive}
            >
              {toggleTarget?.is_active ? 'Confirmar suspensão' : 'Confirmar ativação'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open && !isDeleting) closeDelete(); }}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/40">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-destructive" />
              Deletar empresa
            </DialogTitle>
            <DialogDescription>
              <span className="font-semibold text-foreground">{deleteTarget?.name}</span>
              {' · slug: '}
              <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">{deleteTarget?.slug}</code>
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-5">
            {/* Seletor de modo */}
            <div className="grid grid-cols-1 gap-3" role="radiogroup" aria-label="Modo de deleção">
              {/* Modo A — Soft delete */}
              <label
                htmlFor="mode-soft"
                className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                  deleteMode === 'soft'
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                <input
                  type="radio"
                  id="mode-soft"
                  name="delete-mode"
                  value="soft"
                  checked={deleteMode === 'soft'}
                  onChange={() => { setDeleteMode('soft'); setConfirmSlugInput(''); }}
                  className="mt-0.5 shrink-0 accent-primary"
                />
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm text-foreground">Remover do sistema</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    A empresa some da listagem, mas nenhum dado é apagado do banco. Reversível — você pode restaurar depois.
                  </p>
                </div>
              </label>

              {/* Modo B — Hard delete */}
              <label
                htmlFor="mode-hard"
                className={`flex items-start gap-3 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                  deleteMode === 'hard'
                    ? 'border-destructive bg-destructive/5'
                    : 'border-border hover:border-muted-foreground/40'
                }`}
              >
                <input
                  type="radio"
                  id="mode-hard"
                  name="delete-mode"
                  value="hard"
                  checked={deleteMode === 'hard'}
                  onChange={() => { setDeleteMode('hard'); setConfirmSlugInput(''); }}
                  className="mt-0.5 shrink-0 accent-destructive"
                />
                <div className="space-y-0.5">
                  <p className="font-semibold text-sm text-destructive">Deletar do banco de dados</p>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Apaga permanentemente todos os dados, usuários e arquivos da empresa.
                  </p>
                </div>
              </label>
            </div>

            {/* Aviso e confirmação hard delete */}
            {deleteMode === 'hard' && (
              <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
                <p className="text-sm font-semibold text-destructive leading-relaxed">
                  ⚠️ Esta ação é IRREVERSÍVEL. Todos os dados, usuários e arquivos da empresa serão
                  permanentemente apagados do banco de dados e NÃO poderão ser recuperados.
                </p>
                <p className="text-xs text-muted-foreground">
                  Serão apagados: <strong>{deleteTarget?.user_count ?? 0} usuário(s)</strong>, todos os
                  registros, OS, orçamentos, arquivos de storage e dados fiscais de{' '}
                  <strong className="text-foreground">{deleteTarget?.name}</strong>.
                </p>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">
                    Digite o slug{' '}
                    <code className="bg-muted px-1 py-0.5 rounded font-mono">{deleteTarget?.slug}</code>{' '}
                    para confirmar:
                  </Label>
                  <Input
                    value={confirmSlugInput}
                    onChange={(e) => setConfirmSlugInput(e.target.value)}
                    placeholder={deleteTarget?.slug ?? ''}
                    className="h-10 rounded-lg font-mono text-sm"
                    autoComplete="off"
                    disabled={isDeleting}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/40 sm:justify-end gap-2">
            <Button
              variant="outline"
              className="rounded-lg h-10 font-semibold"
              onClick={closeDelete}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            {deleteMode === 'soft' ? (
              <Button
                variant="destructive"
                className="rounded-lg h-10 font-semibold"
                onClick={handleSoftDelete}
                disabled={isDeleting}
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Remover do sistema
              </Button>
            ) : (
              <Button
                variant="destructive"
                className="rounded-lg h-10 font-semibold"
                onClick={handleHardDelete}
                disabled={isDeleting || confirmSlugInput !== deleteTarget?.slug}
              >
                {isDeleting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Deletar permanentemente
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
