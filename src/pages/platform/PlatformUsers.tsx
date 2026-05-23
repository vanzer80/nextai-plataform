import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, MoreHorizontal, Trash2, Loader2, Users as UsersIcon, Search } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const userSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email:     z.string().email('E-mail inválido'),
  password:  z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
  role:      z.string().min(1, 'Selecione um perfil'),
  team_id:   z.string().min(1, 'Selecione uma empresa'),
});
type UserFormValues = z.infer<typeof userSchema>;

interface PlatformUser {
  id: string;
  full_name: string;
  email: string;
  role: string;
  team_id: string;
  created_at: string;
  tenants: { id: string; name: string; slug: string; primary_color: string; logo_url: string | null } | null;
}

interface TenantOption {
  id: string;
  name: string;
  slug: string;
}

function getRoleBadge(role: string) {
  switch (role) {
    case 'Master':
    case 'Admin':
      return <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">Master</Badge>;
    case 'Gestor':
      return <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-0">Gestor</Badge>;
    case 'Financeiro':
      return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300 border-0">Financeiro</Badge>;
    case 'Comprador':
      return <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 border-0">Comprador</Badge>;
    case 'Administrativo':
      return <Badge className="bg-secondary text-secondary-foreground border-0">Administrativo</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground border-0">{role}</Badge>;
  }
}

export default function PlatformUsers() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [tenantFilter, setTenantFilter] = useState(searchParams.get('tenant_id') || '');
  const [search, setSearch] = useState('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: { full_name: '', email: '', password: '', role: '', team_id: '' },
  });
  const selectedRole = watch('role');
  const selectedTeamId = watch('team_id');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('platform-list-users', {
        body: { tenant_id: tenantFilter || null },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      setUsers(data?.users ?? []);
    } catch (err: any) {
      toast.error('Erro ao buscar usuários', { description: err.message });
    } finally {
      setLoading(false);
    }
  }, [tenantFilter]);

  const fetchTenants = async () => {
    const { data } = await supabase
      .from('tenants')
      .select('id, name, slug')
      .order('name', { ascending: true });
    if (data) setTenants(data as TenantOption[]);
  };

  useEffect(() => { fetchTenants(); }, []);
  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleTenantFilter = (value: string) => {
    const v = value === 'all' ? '' : value;
    setTenantFilter(v);
    if (v) setSearchParams({ tenant_id: v });
    else setSearchParams({});
  };

  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q);
  });

  const onSubmit = async (data: UserFormValues) => {
    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          role: data.role,
          team_id: data.team_id,
        },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);

      toast.success('Usuário criado com sucesso!', {
        description: `${data.full_name} adicionado à empresa.`,
      });
      fetchUsers();
      setIsDialogOpen(false);
      reset();
    } catch (err: any) {
      toast.error('Erro ao criar usuário', { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { id, name } = confirmDelete;
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      const { data, error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: id },
      });
      if (error) {
        const msg = (data as any)?.error ?? error.message;
        throw new Error(msg);
      }
      toast.info(`Acesso de ${name} revogado.`);
      setUsers(prev => prev.filter(u => u.id !== id));
    } catch (err: any) {
      toast.error('Falha ao remover acesso', { description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <UsersIcon className="h-6 w-6 text-primary" />
            Usuários da Plataforma
          </h1>
          <p className="text-sm text-muted-foreground">Todos os colaboradores de todas as empresas.</p>
        </div>

        <Button onClick={() => setIsDialogOpen(true)} className="h-11 px-6 rounded-xl font-semibold w-full sm:w-auto">
          <Plus className="h-5 w-5 mr-1 -ml-1" />
          Adicionar Usuário
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou e-mail..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-lg"
          />
        </div>
        <Select value={tenantFilter || 'all'} onValueChange={handleTenantFilter}>
          <SelectTrigger className="h-10 rounded-lg w-full sm:w-[220px]">
            <SelectValue placeholder="Todas as empresas" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {tenants.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[300px]" data-onboarding="platform-users-lista">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-64">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p className="text-sm">Carregando usuários...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-semibold text-foreground w-[220px]">Colaborador</TableHead>
                  <TableHead className="font-semibold text-foreground">E-mail</TableHead>
                  <TableHead className="font-semibold text-foreground">Empresa</TableHead>
                  <TableHead className="font-semibold text-foreground">Perfil</TableHead>
                  <TableHead className="w-[80px] text-right font-semibold text-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/50 transition-colors border-border">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9 border border-border">
                          <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs uppercase">
                            {u.full_name?.slice(0, 2) || 'UT'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-foreground text-sm whitespace-nowrap">{u.full_name}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>
                    <TableCell>
                      {u.tenants ? (
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: u.tenants.primary_color }}
                          />
                          <span className="text-sm font-medium text-foreground">{u.tenants.name}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>{getRoleBadge(u.role)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          disabled={deletingId === u.id}
                          className="inline-flex items-center justify-center h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                        >
                          {deletingId === u.id
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <MoreHorizontal className="h-4 w-4" />
                          }
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40 rounded-xl">
                          <DropdownMenuItem
                            variant="destructive"
                            className="cursor-pointer font-medium flex items-center"
                            onClick={() => setConfirmDelete({ id: u.id, name: u.full_name })}
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center text-muted-foreground font-medium">
                      {search ? 'Nenhum resultado para a busca.' : 'Nenhum usuário encontrado.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Create User Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!open) { setIsDialogOpen(false); reset(); } }}>
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 pb-2 border-b border-border bg-muted/40">
            <DialogTitle className="text-xl font-bold">Adicionar Usuário</DialogTitle>
            <DialogDescription>Cria um acesso em qualquer empresa da plataforma.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-sm font-semibold">Empresa</Label>
                <Select onValueChange={(val) => setValue('team_id', val)} value={selectedTeamId}>
                  <SelectTrigger className="h-11 rounded-lg focus:ring-ring">
                    <SelectValue placeholder="Selecione a empresa..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.team_id && <p className="text-xs text-destructive font-medium">{errors.team_id.message}</p>}
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-semibold">Nome Completo</Label>
                <Input placeholder="Ex: João da Silva" className="h-11 rounded-lg" {...register('full_name')} />
                {errors.full_name && <p className="text-xs text-destructive font-medium">{errors.full_name.message}</p>}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">E-mail</Label>
                  <Input placeholder="colaborador@empresa.com" className="h-11 rounded-lg" {...register('email')} />
                  {errors.email && <p className="text-xs text-destructive font-medium">{errors.email.message}</p>}
                </div>
                <div className="space-y-1">
                  <Label className="text-sm font-semibold">Senha Temporária</Label>
                  <Input type="password" placeholder="Mín. 6 caracteres" className="h-11 rounded-lg" {...register('password')} />
                  {errors.password && <p className="text-xs text-destructive font-medium">{errors.password.message}</p>}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-semibold">Perfil de Acesso</Label>
                <Select onValueChange={(val) => setValue('role', val)} value={selectedRole}>
                  <SelectTrigger className="h-11 rounded-lg focus:ring-ring">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Tecnico">Técnico de Campo</SelectItem>
                    <SelectItem value="Administrativo">Administrativo</SelectItem>
                    <SelectItem value="Financeiro">Financeiro</SelectItem>
                    <SelectItem value="Comprador">Comprador</SelectItem>
                    <SelectItem value="Supervisor">Supervisor</SelectItem>
                    <SelectItem value="Gestor">Gestor</SelectItem>
                    <SelectItem value="Master">Master (Admin)</SelectItem>
                  </SelectContent>
                </Select>
                {errors.role && <p className="text-xs text-destructive font-medium">{errors.role.message}</p>}
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/40 sm:justify-end gap-2">
              <Button type="button" variant="outline" className="rounded-lg h-11 font-semibold" onClick={() => { setIsDialogOpen(false); reset(); }} disabled={isSubmitting}>Cancelar</Button>
              <Button type="submit" className="rounded-lg h-11 font-semibold" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Criar Usuário
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/40">
            <DialogTitle className="text-lg font-bold">Excluir usuário?</DialogTitle>
            <DialogDescription>
              O acesso de <span className="font-semibold text-foreground">{confirmDelete?.name}</span> será revogado permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-4 sm:justify-end gap-2">
            <Button variant="outline" className="rounded-lg h-10 font-semibold" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
            <Button variant="destructive" className="rounded-lg h-10 font-semibold" onClick={handleDelete}>Confirmar exclusão</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
