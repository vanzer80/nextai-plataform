import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Plus, Globe, Loader2, Palette, MoreHorizontal,
  Pencil, Image as ImageIcon, Users, PowerOff, Power, Search,
  Phone, Globe2, Building2, Mail, Hash,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

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
  tenant_name:   z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Cor inválida'),
  cnpj:          z.string().max(18, 'Máximo 18 caracteres').optional(),
  phone:         z.string().max(20, 'Máximo 20 caracteres').optional(),
  website:       z.string().max(200, 'Máximo 200 caracteres').optional(),
  sector:        z.string().optional(),
});
type EditFormValues = z.infer<typeof editSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

// Flat record retornado pela RPC get_platform_tenants()
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
  user_count: number;
  master_name: string | null;
  master_email: string | null;
}

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

  // Edit sheet
  const [editingTenant, setEditingTenant]         = useState<TenantRow | null>(null);
  const [isEditOpen, setIsEditOpen]               = useState(false);
  const [isEditSubmitting, setIsEditSubmitting]   = useState(false);
  const [editLogoFile, setEditLogoFile]           = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview]     = useState<string | null>(null);
  const [editLogoRemoved, setEditLogoRemoved]     = useState(false);
  const editLogoRef = useRef<HTMLInputElement>(null);

  // Toggle active
  const [toggleTarget, setToggleTarget] = useState<TenantRow | null>(null);
  const [togglingId, setTogglingId]     = useState<string | null>(null);

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
      cnpj: '', phone: '', website: '', sector: '',
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

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_platform_tenants');
      if (error) throw error;
      setTenants((data ?? []) as TenantRow[]);
    } catch (err: any) {
      toast.error('Erro ao buscar empresas', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

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
      tenant_name:   t.name,
      primary_color: t.primary_color,
      cnpj:          t.cnpj    ?? '',
      phone:         t.phone   ?? '',
      website:       t.website ?? '',
      sector:        t.sector  ?? '',
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
    } catch (err: any) {
      toast.error('Erro ao provisionar empresa', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (data: EditFormValues) => {
    if (!editingTenant) return;
    setIsEditSubmitting(true);
    try {
      const updates: Record<string, unknown> = {
        name:          data.tenant_name,
        primary_color: data.primary_color,
        cnpj:          data.cnpj    || null,
        phone:         data.phone   || null,
        website:       data.website || null,
        sector:        data.sector  || null,
      };
      if (editLogoFile) updates.logo_url = await uploadLogo(editLogoFile, editingTenant.slug);
      else if (editLogoRemoved) updates.logo_url = null;

      const { error } = await supabase.from('tenants').update(updates).eq('id', editingTenant.id);
      if (error) throw error;

      toast.success('Empresa atualizada!', { description: `"${data.tenant_name}" salvo com sucesso.` });
      closeEdit();
      // Re-fetch confirma estado real do banco (inclui master_name/master_email via RPC)
      await fetchTenants();
    } catch (err: any) {
      toast.error('Erro ao atualizar empresa', { description: err.message });
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
    } catch (err: any) {
      toast.error('Erro ao alterar status', { description: err.message });
    } finally {
      setTogglingId(null);
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
        <Button
          onClick={() => setIsCreateOpen(true)}
          data-onboarding="platform-tenants-novo"
          className="h-11 px-6 rounded-xl font-semibold w-full sm:w-auto"
        >
          <Plus className="h-5 w-5 mr-1 -ml-1" />
          Nova Empresa
        </Button>
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
                      {t.is_active
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
                        <DropdownMenuContent align="end" className="w-44 rounded-xl">
                          <DropdownMenuItem className="cursor-pointer font-medium" onClick={() => openEdit(t)}>
                            <Pencil className="mr-2 h-4 w-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="cursor-pointer font-medium"
                            onClick={() => navigate(`/platform/users?tenant_id=${t.id}`)}
                          >
                            <Users className="mr-2 h-4 w-4" /> Ver Usuários
                          </DropdownMenuItem>
                          {!t.is_platform && (
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
        <SheetContent side="right" className="data-[side=right]:sm:max-w-[540px] p-0 gap-0">
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

              {/* ── Seção 1: Dados da Empresa ─────────────────────────────── */}
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-3.5 w-3.5" /> Dados da Empresa
                </p>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Nome da empresa *</Label>
                  <Input placeholder="Ex: ACME Engenharia" className="h-11 rounded-lg" {...editForm.register('tenant_name')} />
                  {editForm.formState.errors.tenant_name && <p className="text-xs text-destructive font-medium">{editForm.formState.errors.tenant_name.message}</p>}
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Slug</Label>
                  <Input value={editingTenant?.slug ?? ''} disabled className="h-11 rounded-lg font-mono bg-muted/50 opacity-70" onChange={() => {}} />
                  <p className="text-xs text-muted-foreground">Imutável após criação — usado como identificador de storage.</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Hash className="h-3.5 w-3.5" /> CNPJ
                    </Label>
                    <Input placeholder="00.000.000/0001-00" className="h-11 rounded-lg" {...editForm.register('cnpj')} />
                    {editForm.formState.errors.cnpj && <p className="text-xs text-destructive font-medium">{editForm.formState.errors.cnpj.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" /> Telefone
                    </Label>
                    <Input placeholder="(11) 99999-9999" className="h-11 rounded-lg" {...editForm.register('phone')} />
                    {editForm.formState.errors.phone && <p className="text-xs text-destructive font-medium">{editForm.formState.errors.phone.message}</p>}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Globe2 className="h-3.5 w-3.5" /> Website
                  </Label>
                  <Input placeholder="https://www.empresa.com.br" className="h-11 rounded-lg" {...editForm.register('website')} />
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Segmento</Label>
                  <Controller
                    control={editForm.control}
                    name="sector"
                    render={({ field }) => (
                      <Select value={field.value || ''} onValueChange={(val) => field.onChange(val ?? '')}>
                        <SelectTrigger className="min-h-[44px] w-full rounded-lg text-sm">
                          <SelectValue placeholder="Selecione o segmento..." />
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

              {/* ── Seção 2: Identidade Visual ────────────────────────────── */}
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

              {/* ── Seção 3: Administrador Master ─────────────────────────── */}
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

    </div>
  );
}
