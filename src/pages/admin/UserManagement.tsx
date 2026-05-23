import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, MoreHorizontal, Edit, Trash2, Shield, User as UserIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { useAuth } from '@/src/contexts/AuthContext';

import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

// Validation Schema
const userSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  role: z.string().min(1, 'Selecione um perfil de acesso'),
  password: z.string().min(6, 'Senha temporária deve ter no mínimo 6 caracteres'),
  team: z.string().optional(),
});

type UserFormValues = z.infer<typeof userSchema>;

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchUsers = async () => {
    if (!currentUser?.team_id) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('id, full_name, email, role, team_id, created_at')
        .eq('team_id', currentUser.team_id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err: any) {
      toast.error('Erro ao buscar colaboradores', { description: err.message });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.team_id) fetchUsers();
  }, [currentUser?.team_id]);

  const { register, handleSubmit, setValue, watch, reset, formState: { errors } } = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: '',
      email: '',
      role: '',
      password: '',
      team: '',
    }
  });

  const selectedRole = watch('role');

  const onSubmit = async (data: UserFormValues) => {
    setIsSubmitting(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          password: data.password,
          full_name: data.full_name,
          role: data.role,
        },
      });

      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);

      toast.success('Usuário convidado com sucesso!', {
        description: `O acesso para ${data.full_name} (${data.role}) foi habilitado.`
      });
      fetchUsers();
      setIsDialogOpen(false);
      reset();
    } catch (err: any) {
      toast.error('Erro ao criar usuário', { description: err.message });
      console.warn('[UserManagement] onSubmit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDeleteUser) return;
    const { id, name } = confirmDeleteUser;
    setDeletingId(id);
    setConfirmDeleteUser(null);
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
      toast.error("Falha ao remover acesso", { description: err.message });
    } finally {
      setDeletingId(null);
    }
  };

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'Master':
      case 'Admin':
        return <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">Master</Badge>;
      case 'Gestor':
        return <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-0">Gestor</Badge>;
      case 'Financeiro':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 border-0">Financeiro</Badge>;
      case 'Comprador':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 border-0">Comprador</Badge>;
      case 'Administrativo':
        return <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-0">Administrativo</Badge>;
      default:
        return <Badge className="bg-muted text-muted-foreground hover:bg-muted/80 border-0">Técnico de Campo</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" /> 
            Controle de Acessos
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie colaboradores ativos e seus níveis de permissão no Portal.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger data-onboarding="admin-usr-convidar" className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold h-11 px-6 rounded-xl w-full sm:w-auto transition-colors disabled:pointer-events-none disabled:opacity-50">
            <Plus className="h-5 w-5 mr-1 -ml-1" />
            Adicionar Colaborador
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
            <DialogHeader className="p-6 pb-2 border-b border-border bg-muted/40 relative">
              <DialogTitle className="text-xl font-bold text-foreground">Novo Acesso</DialogTitle>
              <DialogDescription>
                Crie um perfil para o colaborador. Ele usará estas credenciais para logar no app.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="p-6 space-y-4">
                
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-foreground">Nome Completo</Label>
                  <Input 
                    placeholder="Ex: João da Silva" 
                    className="h-11 rounded-lg focus-visible:ring-ring"
                    {...register('full_name')} 
                  />
                  {errors.full_name && <p className="text-xs text-destructive font-medium">{errors.full_name.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">E-mail</Label>
                    <Input 
                      placeholder="colaborador@empresa.com"
                      className="h-11 rounded-lg focus-visible:ring-ring"
                      {...register('email')} 
                    />
                    {errors.email && <p className="text-xs text-destructive font-medium">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">Senha Temporária</Label>
                    <Input 
                      type="password"
                      placeholder="******" 
                      className="h-11 rounded-lg focus-visible:ring-ring"
                      {...register('password')} 
                    />
                    {errors.password && <p className="text-xs text-destructive font-medium">{errors.password.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">Perfil de Acesso</Label>
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
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">Equipe / Depto</Label>
                    <Input 
                      placeholder="Ex: Pós Vendas" 
                      className="h-11 rounded-lg focus-visible:ring-ring"
                      {...register('team')} 
                    />
                  </div>
                </div>

              </div>
              <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/40 sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-lg h-11 font-semibold"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-lg h-11 font-semibold" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Convidar Colaborador
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[300px]" data-onboarding="admin-usr-tabela">
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
                <TableHead className="font-semibold text-foreground w-[250px]">Colaborador</TableHead>
                <TableHead className="font-semibold text-foreground">E-mail</TableHead>
                <TableHead className="font-semibold text-foreground">Perfil / Acesso</TableHead>
                <TableHead className="font-semibold text-foreground">Departamento</TableHead>
                <TableHead className="w-[80px] text-right font-semibold text-foreground">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
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
                    {getRoleBadge(u.role)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{u.team_id || '-'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger disabled={deletingId === u.id} className="inline-flex items-center justify-center h-8 w-8 p-0 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
                        {deletingId === u.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <MoreHorizontal className="h-4 w-4" />}
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl">
                        <DropdownMenuItem className="cursor-pointer font-medium flex items-center">
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          variant="destructive"
                          className="cursor-pointer font-medium flex items-center"
                          onClick={() => setConfirmDeleteUser({ id: u.id, name: u.full_name })}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center text-muted-foreground font-medium">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </div>

      {/* Confirmação de exclusão */}
      <Dialog open={!!confirmDeleteUser} onOpenChange={(open) => { if (!open) setConfirmDeleteUser(null); }}>
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/40">
            <DialogTitle className="text-lg font-bold text-foreground">Excluir colaborador?</DialogTitle>
            <DialogDescription>
              O acesso de <span className="font-semibold text-foreground">{confirmDeleteUser?.name}</span> será revogado permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-4 sm:justify-end gap-2">
            <Button variant="outline" className="rounded-lg h-10 font-semibold" onClick={() => setConfirmDeleteUser(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" className="rounded-lg h-10 font-semibold" onClick={handleDelete}>
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
