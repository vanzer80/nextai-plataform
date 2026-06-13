import React, { useState, useRef, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Settings, Palette, Image as ImageIcon, Loader2, User as UserIcon, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { applyTenantBrand } from '@/src/lib/color';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';
import { Badge } from '@/src/components/ui/badge';

const profileSchema = z.object({
  name:          z.string().min(2, 'Nome deve ter no mínimo 2 caracteres').max(100),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

const MAX_LOGO_SIZE = 2 * 1024 * 1024;
const LOGO_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

function getInitials(name?: string): string {
  if (!name) return 'U';
  const parts = name.split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function PlatformSettings() {
  const { user } = useAuth();
  const { tenant, refreshTenant } = useTenant();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoRemoved, setLogoRemoved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  const { control, register, handleSubmit, reset, formState: { errors, isDirty } } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { name: '', primary_color: '#0066CC' },
  });

  useEffect(() => {
    if (!tenant) return;
    reset({ name: tenant.name, primary_color: tenant.primaryColor });
    setLogoPreview(prev => {
      if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
      return tenant.logoUrl ?? null;
    });
    setLogoRemoved(false);
  }, [tenant, reset]);

  useEffect(() => {
    return () => {
      setLogoPreview(prev => {
        if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev);
        return null;
      });
    };
  }, []);

  const handleLogoSelect = (file: File | undefined) => {
    if (!file) return;
    if (!LOGO_MIME.includes(file.type)) { toast.error('Use PNG, JPEG ou WebP.'); return; }
    if (file.size > MAX_LOGO_SIZE) { toast.error('Arquivo muito grande. Máximo 2 MB.'); return; }
    if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
    setLogoRemoved(false);
  };

  const handleLogoRemove = () => {
    if (logoPreview?.startsWith('blob:')) URL.revokeObjectURL(logoPreview);
    setLogoFile(null);
    setLogoPreview(null);
    setLogoRemoved(true);
  };

  const onSubmit = async (data: ProfileFormValues) => {
    if (!tenant?.id) return;
    setIsSaving(true);
    try {
      const updates: { name: string; primary_color: string; logo_url?: string | null } = {
        name: data.name,
        primary_color: data.primary_color,
      };

      if (logoFile) {
        const ext = logoFile.name.split('.').pop()?.toLowerCase() ?? 'jpg';
        const path = `${tenant.slug}/logo.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('tenant-assets')
          .upload(path, logoFile, { upsert: true, contentType: logoFile.type });
        if (uploadErr) throw new Error(`Erro ao fazer upload do logo: ${uploadErr.message}`);
        const { data: urlData } = supabase.storage.from('tenant-assets').getPublicUrl(path);
        updates.logo_url = `${urlData.publicUrl}?t=${Date.now()}`;
      } else if (logoRemoved) {
        updates.logo_url = null;
      }

      const { error } = await supabase.from('tenants').update(updates).eq('id', tenant.id);
      if (error) throw error;

      applyTenantBrand(data.primary_color);
      refreshTenant();
      toast.success('Configurações salvas!', { description: 'As alterações foram aplicadas imediatamente.' });
    } catch (err: any) {
      toast.error('Erro ao salvar', { description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Settings className="h-6 w-6 text-primary" />
          Configurações da Plataforma
        </h1>
        <p className="text-sm text-muted-foreground">Personalize a identidade visual da plataforma NextAI.</p>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/40">
          <h2 className="font-semibold text-foreground">Identidade da Plataforma</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Nome e cores exibidos na tela de login e na sidebar.</p>
        </div>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="p-6 space-y-5">

            {/* Logo */}
            <div className="space-y-2" data-onboarding="platform-settings-logo">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Logo da Plataforma
              </Label>
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl border border-border overflow-hidden bg-muted flex items-center justify-center shrink-0">
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo" className="h-full w-full object-cover" />
                    : <span className="text-xl font-extrabold text-muted-foreground">N</span>
                  }
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    ref={logoRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => handleLogoSelect(e.target.files?.[0])}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-lg text-xs font-semibold"
                    onClick={() => logoRef.current?.click()}
                  >
                    {logoPreview ? 'Trocar logo' : 'Selecionar logo'}
                  </Button>
                  {logoPreview && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-9 rounded-lg text-xs font-semibold text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={handleLogoRemove}
                    >
                      Remover
                    </Button>
                  )}
                  <p className="text-xs text-muted-foreground w-full mt-0.5">PNG, JPEG ou WebP · máx. 2 MB</p>
                </div>
              </div>
            </div>

            {/* Name */}
            <div className="space-y-1">
              <Label className="text-sm font-semibold">Nome da Plataforma</Label>
              <Input placeholder="Ex: NextAI" className="h-11 rounded-lg" {...register('name')} />
              {errors.name && <p className="text-xs text-destructive font-medium">{errors.name.message}</p>}
            </div>

            {/* Color */}
            <div className="space-y-1">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Palette className="h-4 w-4" /> Cor Primária
              </Label>
              <Controller
                control={control}
                name="primary_color"
                render={({ field }) => (
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={field.value}
                      onChange={(e) => field.onChange(e.target.value)}
                      className="h-11 w-14 rounded-lg cursor-pointer border border-input bg-background p-1"
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
              <p className="text-xs text-muted-foreground">A cor é aplicada em OKLCH para manter o contraste em light e dark mode.</p>
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border bg-muted/40 flex justify-end">
            <Button
              type="submit"
              className="h-10 px-6 rounded-lg font-semibold"
              disabled={isSaving || (!isDirty && !logoFile && !logoRemoved)}
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Configurações
            </Button>
          </div>
        </form>
      </div>

      {/* Account Info */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-muted/40">
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <UserIcon className="h-4 w-4" /> Conta do Administrador
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Informações do SuperMaster atual.</p>
        </div>
        <div className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14 border-2 border-border">
              <AvatarFallback className="bg-primary text-primary-foreground text-lg font-bold">
                {getInitials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1">
              <p className="font-bold text-foreground text-lg leading-tight">{user?.full_name || 'SuperMaster'}</p>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm text-muted-foreground">{user?.email}</p>
                <Badge className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary border-0 font-bold">SuperMaster</Badge>
                <Badge className="text-[10px] px-2 py-0.5 bg-primary/15 text-primary border-0 font-bold">Platform</Badge>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 bg-muted/50 rounded-lg p-3 border border-border">
            Para alterar o e-mail ou senha do administrador, acesse o Dashboard do Supabase → Authentication → Users.
          </p>
        </div>
      </div>
    </div>
  );
}
