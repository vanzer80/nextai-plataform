import React, { useState, useEffect, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { useTenant } from '@/src/contexts/TenantContext';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Plus, Globe, Loader2, Palette, HardDrive,
  CheckCircle2, AlertTriangle, Pencil, Image as ImageIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import {
  Table, TableBody, TableCell, TableHead,
  TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription,
  DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';

// ── Schemas ───────────────────────────────────────────────────────────────────

const tenantSchema = z.object({
  tenant_name:    z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  tenant_slug:    z.string().regex(/^[a-z][a-z0-9-]{2,49}$/, 'Apenas lowercase, letras/números/hífens, 3–50 chars, deve iniciar com letra'),
  primary_color:  z.string().regex(/^#[0-9a-fA-F]{6}$/),
  admin_name:     z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  admin_email:    z.string().email('E-mail inválido'),
  admin_password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres'),
});
type TenantFormValues = z.infer<typeof tenantSchema>;

const editTenantSchema = z.object({
  tenant_name:   z.string().min(3, 'Nome deve ter no mínimo 3 caracteres').max(100),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
type EditTenantFormValues = z.infer<typeof editTenantSchema>;

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  primary_color: string;
  logo_url: string | null;
  created_at: string;
  users: { count: number }[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

async function uploadLogo(file: File, slug: string): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
  const path = `${slug}/logo.${ext}`;
  const { error } = await supabase.storage
    .from('tenant-assets')
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw new Error(`Erro ao fazer upload do logo: ${error.message}`);
  const { data } = supabase.storage.from('tenant-assets').getPublicUrl(path);
  // O path é reutilizado a cada upload (upsert no mesmo slug/ext), então a URL pública
  // é idêntica entre trocas — sem o parâmetro de versão o browser/CDN serve a imagem
  // antiga em cache. O timestamp força o refresh da nova logo.
  return `${data.publicUrl}?v=${Date.now()}`;
}

function validateLogoFile(file: File): string | null {
  if (!LOGO_MIME_TYPES.includes(file.type)) return 'Use PNG, JPEG ou WebP.';
  if (file.size > MAX_LOGO_SIZE) return 'Arquivo muito grande. Máximo 2 MB.';
  return null;
}

// ── LogoPreview ───────────────────────────────────────────────────────────────

function LogoPreview({ previewUrl }: { previewUrl: string | null }) {
  return previewUrl ? (
    <img
      src={previewUrl}
      alt="Logo preview"
      className="h-10 w-10 rounded-lg object-cover border border-border shrink-0"
    />
  ) : (
    <div className="h-10 w-10 rounded-lg border border-dashed border-border flex items-center justify-center bg-muted shrink-0">
      <ImageIcon className="h-4 w-4 text-muted-foreground" />
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function TenantManagement() {
  const { tenant, loading: tenantLoading } = useTenant();

  // List
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Create dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createLogoFile, setCreateLogoFile] = useState<File | null>(null);
  const [createLogoPreview, setCreateLogoPreview] = useState<string | null>(null);
  const createLogoInputRef = useRef<HTMLInputElement>(null);

  // Edit dialog
  const [editingTenant, setEditingTenant] = useState<TenantRow | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editLogoFile, setEditLogoFile] = useState<File | null>(null);
  const [editLogoPreview, setEditLogoPreview] = useState<string | null>(null);
  const editLogoInputRef = useRef<HTMLInputElement>(null);

  // Backfill
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [backfillResult, setBackfillResult] = useState<{
    success: boolean;
    summary: { totalMoved: number; totalFailed: number };
    db: Record<string, number>;
  } | null>(null);
  const [showBackfillConfirm, setShowBackfillConfirm] = useState(false);

  // Create form
  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm<TenantFormValues>({
    resolver: zodResolver(tenantSchema),
    defaultValues: {
      tenant_name: '', tenant_slug: '', primary_color: '#0066CC',
      admin_name: '', admin_email: '', admin_password: '',
    },
  });
  const colorValue = watch('primary_color');

  // Edit form
  const editForm = useForm<EditTenantFormValues>({
    resolver: zodResolver(editTenantSchema),
    defaultValues: { tenant_name: '', primary_color: '#0066CC' },
  });
  const editColorValue = editForm.watch('primary_color');

  // ── Data ──────────────────────────────────────────────────────────────────

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, primary_color, logo_url, created_at, users!users_team_id_fkey(count)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTenants((data ?? []) as TenantRow[]);
    } catch (err: any) {
      toast.error('Erro ao buscar tenants', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTenants(); }, []);

  // ── Logo handlers ─────────────────────────────────────────────────────────

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
  };

  // ── Dialog lifecycle ──────────────────────────────────────────────────────

  const closeCreateDialog = () => {
    setIsDialogOpen(false);
    reset();
    setCreateLogoFile(null);
    if (createLogoPreview) URL.revokeObjectURL(createLogoPreview);
    setCreateLogoPreview(null);
  };

  const openEditDialog = (t: TenantRow) => {
    setEditingTenant(t);
    editForm.reset({ tenant_name: t.name, primary_color: t.primary_color });
    setEditLogoFile(null);
    setEditLogoPreview(t.logo_url);
    setIsEditOpen(true);
  };

  const closeEditDialog = () => {
    setIsEditOpen(false);
    setEditingTenant(null);
    setEditLogoFile(null);
    if (editLogoPreview?.startsWith('blob:')) URL.revokeObjectURL(editLogoPreview);
    setEditLogoPreview(null);
  };

  // ── Submit handlers ───────────────────────────────────────────────────────

  const onSubmit = async (data: TenantFormValues) => {
    setIsSubmitting(true);
    try {
      let logoUrl: string | null = null;
      if (createLogoFile) {
        logoUrl = await uploadLogo(createLogoFile, data.tenant_slug);
      }

      const { data: result, error } = await supabase.functions.invoke('admin-provision-tenant', {
        body: {
          tenant: {
            name: data.tenant_name,
            slug: data.tenant_slug,
            primary_color: data.primary_color,
            logo_url: logoUrl,
          },
          admin: { full_name: data.admin_name, email: data.admin_email, password: data.admin_password },
        },
      });

      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);

      if (result?.warning) {
        toast.warning('Tenant criado com aviso', { description: result.warning });
      } else {
        toast.success('Tenant provisionado!', {
          description: `"${data.tenant_name}" (${data.tenant_slug}) está pronto.`,
        });
      }
      fetchTenants();
      closeCreateDialog();
    } catch (err: any) {
      toast.error('Erro ao provisionar tenant', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const onEditSubmit = async (data: EditTenantFormValues) => {
    if (!editingTenant) return;
    setIsEditSubmitting(true);
    try {
      const newLogoUrl = editLogoFile
        ? await uploadLogo(editLogoFile, editingTenant.slug)
        : null;

      // UPDATE direto em `tenants` é bloqueado por RLS para o platform admin editando
      // outro tenant (0 linhas, sem erro → falha silenciosa). A edição cross-tenant passa
      // pela RPC SECURITY DEFINER, mesmo padrão de get_platform_tenants().
      const { error } = await supabase.rpc('update_tenant_branding', {
        p_tenant_id: editingTenant.id,
        p_name: data.tenant_name,
        p_primary_color: data.primary_color,
        p_logo_url: newLogoUrl,
      });

      if (error) throw error;

      toast.success('Tenant atualizado!', { description: `"${data.tenant_name}" salvo com sucesso.` });
      closeEditDialog();
      fetchTenants();
    } catch (err: any) {
      toast.error('Erro ao atualizar tenant', { description: err.message });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // ── Backfill ──────────────────────────────────────────────────────────────

  const runBackfill = async () => {
    setShowBackfillConfirm(false);
    setIsBackfilling(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('storage-backfill-mopar');
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      setBackfillResult(result);
      if (result.success) {
        toast.success('Backfill concluído!', {
          description: `${result.summary.totalMoved} objetos movidos. DB atualizado.`,
        });
      } else {
        toast.warning('Backfill parcial', {
          description: `${result.summary.totalMoved} movidos, ${result.summary.totalFailed} falhas.`,
        });
      }
    } catch (err: any) {
      toast.error('Erro no backfill', { description: err.message });
    } finally {
      setIsBackfilling(false);
    }
  };

  // ── Guard ─────────────────────────────────────────────────────────────────

  if (!tenantLoading && !tenant?.isPlatform) {
    return <Navigate to="/dashboard" replace />;
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Globe className="h-6 w-6 text-primary" />
            Tenants
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie as empresas clientes do portal.</p>
        </div>

        {/* ── Create Dialog ── */}
        <Dialog
          open={isDialogOpen}
          onOpenChange={(open) => { if (!open) closeCreateDialog(); else setIsDialogOpen(true); }}
        >
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold h-11 px-6 rounded-xl w-full sm:w-auto transition-colors disabled:pointer-events-none disabled:opacity-50">
            <Plus className="h-5 w-5 mr-1 -ml-1" />
            Novo Tenant
          </DialogTrigger>

          <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden rounded-2xl">
            <DialogHeader className="p-6 pb-2 border-b border-border bg-muted/40">
              <DialogTitle className="text-xl font-bold text-foreground">Provisionar Novo Tenant</DialogTitle>
              <DialogDescription>
                Cria a empresa e o primeiro usuário Master. O acesso estará disponível imediatamente.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="p-6 space-y-5">
                <div className="space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Empresa</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-sm font-semibold text-foreground">Nome da empresa</Label>
                    <Input placeholder="Ex: ACME Engenharia" className="h-11 rounded-lg" {...register('tenant_name')} />
                    {errors.tenant_name && <p className="text-xs text-destructive font-medium">{errors.tenant_name.message}</p>}
                  </div>

                  {/* Logo — antes da cor primária */}
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <ImageIcon className="h-4 w-4" /> Logo (opcional)
                    </Label>
                    <div className="flex items-center gap-3">
                      <LogoPreview previewUrl={createLogoPreview} />
                      <div className="flex-1">
                        <input
                          ref={createLogoInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          className="hidden"
                          onChange={(e) => handleCreateLogoSelect(e.target.files?.[0])}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-9 rounded-lg text-xs font-semibold"
                          onClick={() => createLogoInputRef.current?.click()}
                        >
                          {createLogoPreview ? 'Trocar imagem' : 'Selecionar imagem'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">PNG, JPEG ou WebP · máx. 2 MB</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">Slug</Label>
                    <Input placeholder="acme-eng" className="h-11 rounded-lg font-mono" {...register('tenant_slug')} />
                    {errors.tenant_slug && <p className="text-xs text-destructive font-medium">{errors.tenant_slug.message}</p>}
                    <p className="text-xs text-muted-foreground">Identificador único: lowercase, hífens, sem espaços.</p>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Palette className="h-4 w-4" /> Cor primária
                    </Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        className="h-11 w-14 rounded-lg cursor-pointer border border-input bg-background p-1"
                        {...register('primary_color')}
                      />
                      <Input
                        placeholder="#0066CC"
                        className="h-11 rounded-lg font-mono flex-1"
                        value={colorValue}
                        {...register('primary_color')}
                      />
                    </div>
                  </div>
                </div>

                <div className="border-t border-border pt-4 space-y-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Administrador Master</p>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-foreground">Nome completo</Label>
                  <Input placeholder="Ex: Ana Souza" className="h-11 rounded-lg" {...register('admin_name')} />
                  {errors.admin_name && <p className="text-xs text-destructive font-medium">{errors.admin_name.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">E-mail</Label>
                    <Input placeholder="ana@acme.com" className="h-11 rounded-lg" {...register('admin_email')} />
                    {errors.admin_email && <p className="text-xs text-destructive font-medium">{errors.admin_email.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">Senha</Label>
                    <Input type="password" placeholder="Mín. 8 caracteres" className="h-11 rounded-lg" {...register('admin_password')} />
                    {errors.admin_password && <p className="text-xs text-destructive font-medium">{errors.admin_password.message}</p>}
                  </div>
                </div>
              </div>

              <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/40 sm:justify-end gap-2">
                <Button type="button" variant="outline" className="rounded-lg h-11 font-semibold" onClick={closeCreateDialog} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-lg h-11 font-semibold" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Provisionar Tenant
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Tenants table ── */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-64">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p className="text-sm">Carregando tenants...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-semibold text-foreground">Empresa</TableHead>
                  <TableHead className="font-semibold text-foreground">Slug</TableHead>
                  <TableHead className="font-semibold text-foreground">Cor</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Usuários</TableHead>
                  <TableHead className="font-semibold text-foreground">Criado em</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => (
                  <TableRow key={t.id} className="hover:bg-muted/50 transition-colors border-border">
                    <TableCell className="font-semibold text-foreground text-sm">
                      <div className="flex items-center gap-2">
                        {t.logo_url && (
                          <img src={t.logo_url} alt={t.name} className="h-6 w-6 rounded object-cover shrink-0" />
                        )}
                        {t.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-xs">{t.slug}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-5 w-5 rounded-full border border-border shadow-sm"
                          style={{ backgroundColor: t.primary_color }}
                        />
                        <span className="font-mono text-xs text-muted-foreground">{t.primary_color}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">{t.users?.[0]?.count ?? 0}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(t.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-lg"
                        onClick={() => openEditDialog(t)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {tenants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground font-medium">
                      Nenhum tenant encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Edit Dialog ── */}
      <Dialog open={isEditOpen} onOpenChange={(open) => { if (!open) closeEditDialog(); }}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 pb-2 border-b border-border bg-muted/40">
            <DialogTitle className="text-xl font-bold text-foreground">Editar Tenant</DialogTitle>
            <DialogDescription>
              Altere os metadados visuais da empresa. O slug não pode ser modificado.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
            <div className="p-6 space-y-5">

              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground">Nome da empresa</Label>
                <Input
                  placeholder="Ex: ACME Engenharia"
                  className="h-11 rounded-lg"
                  {...editForm.register('tenant_name')}
                />
                {editForm.formState.errors.tenant_name && (
                  <p className="text-xs text-destructive font-medium">
                    {editForm.formState.errors.tenant_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground">Slug</Label>
                <Input
                  value={editingTenant?.slug ?? ''}
                  disabled
                  className="h-11 rounded-lg font-mono"
                  title="O slug não pode ser alterado após a criação"
                  onChange={() => {}}
                />
                <p className="text-xs text-muted-foreground">O slug não pode ser alterado após a criação.</p>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <ImageIcon className="h-4 w-4" /> Logo (opcional)
                </Label>
                <div className="flex items-center gap-3">
                  <LogoPreview previewUrl={editLogoPreview} />
                  <div className="flex-1">
                    <input
                      ref={editLogoInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => handleEditLogoSelect(e.target.files?.[0])}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-9 rounded-lg text-xs font-semibold"
                      onClick={() => editLogoInputRef.current?.click()}
                    >
                      {editLogoPreview ? 'Trocar imagem' : 'Selecionar imagem'}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPEG ou WebP · máx. 2 MB</p>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Palette className="h-4 w-4" /> Cor primária
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-11 w-14 rounded-lg cursor-pointer border border-input bg-background p-1"
                    {...editForm.register('primary_color')}
                  />
                  <Input
                    placeholder="#0066CC"
                    className="h-11 rounded-lg font-mono flex-1"
                    value={editColorValue}
                    {...editForm.register('primary_color')}
                  />
                </div>
              </div>

            </div>

            <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/40 sm:justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-lg h-11 font-semibold" onClick={closeEditDialog} disabled={isEditSubmitting}>
                Cancelar
              </Button>
              <Button type="submit" className="rounded-lg h-11 font-semibold" disabled={isEditSubmitting}>
                {isEditSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar Alterações
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Backfill de Storage ── */}
      <div className="bg-card border border-border rounded-xl shadow-sm p-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <HardDrive className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="font-semibold text-sm text-foreground">Backfill de Storage Legado</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Move objetos legados para paths namespaceados por tenant e atualiza as colunas de URL no banco. Operação idempotente.
              </p>
              {backfillResult && (
                <div className="mt-2 flex items-center gap-2">
                  {backfillResult.success
                    ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                    : <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                  <span className="text-xs font-medium text-foreground">
                    {backfillResult.summary.totalMoved} movidos · {backfillResult.summary.totalFailed} falhas ·
                    DB: {(Object.values(backfillResult.db) as number[]).reduce((a, b) => a + b, 0)} linhas atualizadas
                  </span>
                </div>
              )}
            </div>
          </div>

          {showBackfillConfirm ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">Confirmar?</span>
              <Button size="sm" variant="destructive" className="h-8 rounded-lg text-xs font-semibold" onClick={runBackfill} disabled={isBackfilling}>
                {isBackfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Sim, executar'}
              </Button>
              <Button size="sm" variant="outline" className="h-8 rounded-lg text-xs" onClick={() => setShowBackfillConfirm(false)} disabled={isBackfilling}>
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-9 rounded-lg text-xs font-semibold shrink-0"
              onClick={() => setShowBackfillConfirm(true)}
              disabled={isBackfilling}
            >
              {isBackfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <HardDrive className="h-3.5 w-3.5 mr-1.5" />}
              Executar Backfill
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
