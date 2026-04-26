import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, MoreHorizontal, Edit, Trash2, Shield, User as UserIcon, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';
import { createClient } from '@supabase/supabase-js';

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
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
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
    fetchUsers();
  }, []);

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
      // 1. Instanciar um Client Secundário ("Isolado") para registrar o novo usuário
      // Usa 'storageKey' customizada para DEV impedir que o Login do Supabase no browser sobreescreva a sessão atual do Gestor
      const authClient = createClient(
        import.meta.env.VITE_SUPABASE_URL,
        import.meta.env.VITE_SUPABASE_ANON_KEY,
        { 
          auth: { 
            persistSession: true, 
            autoRefreshToken: false,
            storageKey: 'supabase-isolated-registration-key'
          } 
        }
      );

      // 2. Criar a conta diretamente no auth.users do Supabase
      const { data: authData, error: authError } = await authClient.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            full_name: data.full_name,
          }
        }
      });

      if (authError) {
        throw new Error(`Erro no motor Auth: ${authError.message}`);
      }

      if (!authData.user) {
        throw new Error('Falha misteriosa: Usuário não retornado pelo Auth.');
      }

      // 3. Atualizar o perfil na tabela 'public.users'
      // O trigger nativo do seu banco já deve ter criado a linha em public.users vinculada ao UUID real.
      // Então fazemos apenas um UPDATE para gravar a Role gerencial escolhida.
      const { error: dbError } = await supabase
        .from('users')
        .update({
          full_name: data.full_name,
          role: data.role,
        })
        .eq('id', authData.user.id);

      if (dbError) {
        throw new Error(`Auth criado, mas erro no RLS/Update público: ${dbError.message}`);
      }

      toast.success('Usuário convidado com sucesso!', {
        description: `O acesso para ${data.full_name} (${data.role}) foi habilitado.`
      });
      fetchUsers();
      setIsDialogOpen(false);
      reset();
    } catch (err: any) {
      toast.error('Erro ao injetar usuário', { description: err.message });
      console.warn("User Setup Flow Error:", err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      const { error } = await supabase.functions.invoke('admin-delete-user', {
        body: { userId: id },
      });
      if (error) throw error;
      toast.info(`Acesso de ${name} revogado.`);
      setUsers(users.filter(u => u.id !== id));
    } catch (err: any) {
      toast.error("Falha ao remover acesso", { description: err.message });
    }
  };

  const getRoleBadge = (role: string) => {
    switch(role) {
      case 'Master':
      case 'Admin':
        return <Badge className="bg-slate-800 text-white hover:bg-slate-900 border-0">Master</Badge>;
      case 'Gestor':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-200 border-0">Gestor</Badge>;
      case 'Financeiro':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-0">Financeiro</Badge>;
      case 'Comprador':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 border-0">Comprador</Badge>;
      case 'Administrativo':
        return <Badge className="bg-purple-100 text-purple-800 hover:bg-purple-200 border-0">Administrativo</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 hover:bg-slate-200 border-0">Técnico de Campo</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full max-w-7xl mx-auto pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-blue-600" /> 
            Controle de Acessos
          </h1>
          <p className="text-sm text-slate-600">Gerencie colaboradores ativos e seus níveis de permissão no Portal.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold h-11 px-6 rounded-xl w-full sm:w-auto transition-colors disabled:pointer-events-none disabled:opacity-50">
            <Plus className="h-5 w-5 mr-1 -ml-1" />
            Adicionar Colaborador
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden border-0 rounded-2xl">
            <DialogHeader className="p-6 pb-2 border-b border-slate-100 bg-slate-50 relative">
              <DialogTitle className="text-xl font-bold text-slate-900">Novo Acesso</DialogTitle>
              <DialogDescription>
                Crie um perfil para o colaborador. Ele usará estas credenciais para logar no app.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="p-6 space-y-4">
                
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-slate-700">Nome Completo</Label>
                  <Input 
                    placeholder="Ex: João da Silva" 
                    className="h-11 rounded-lg border-slate-300 bg-slate-50 focus-visible:ring-blue-600"
                    {...register('full_name')} 
                  />
                  {errors.full_name && <p className="text-xs text-rose-500 font-medium">{errors.full_name.message}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-slate-700">E-mail</Label>
                    <Input 
                      placeholder="joao@mopar.com" 
                      className="h-11 rounded-lg border-slate-300 bg-slate-50 focus-visible:ring-blue-600"
                      {...register('email')} 
                    />
                    {errors.email && <p className="text-xs text-rose-500 font-medium">{errors.email.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-slate-700">Senha Temporária</Label>
                    <Input 
                      type="password"
                      placeholder="******" 
                      className="h-11 rounded-lg border-slate-300 bg-slate-50 focus-visible:ring-blue-600"
                      {...register('password')} 
                    />
                    {errors.password && <p className="text-xs text-rose-500 font-medium">{errors.password.message}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-slate-700">Perfil de Acesso</Label>
                    <Select onValueChange={(val) => setValue('role', val)} value={selectedRole}>
                      <SelectTrigger className="h-11 rounded-lg border-slate-300 bg-slate-50 focus:ring-blue-600">
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
                    {errors.role && <p className="text-xs text-rose-500 font-medium">{errors.role.message}</p>}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-slate-700">Equipe / Depto</Label>
                    <Input 
                      placeholder="Ex: Pós Vendas" 
                      className="h-11 rounded-lg border-slate-300 bg-slate-50 focus-visible:ring-blue-600"
                      {...register('team')} 
                    />
                  </div>
                </div>

              </div>
              <DialogFooter className="p-6 pt-4 border-t border-slate-100 bg-slate-50 sm:justify-end gap-2">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsDialogOpen(false)}
                  className="rounded-lg h-11 font-semibold text-slate-700 border-slate-300"
                  disabled={isSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-lg h-11 font-semibold bg-blue-600 hover:bg-blue-700 text-white" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Convidar Colaborador
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
           <div className="flex flex-col items-center justify-center p-12 text-slate-500 h-64">
           <Loader2 className="h-8 w-8 animate-spin mb-4 text-blue-600" />
           <p className="text-sm">Carregando usuários...</p>
         </div>
        ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-slate-200">
                <TableHead className="font-semibold text-slate-900 w-[250px]">Colaborador</TableHead>
                <TableHead className="font-semibold text-slate-900">E-mail</TableHead>
                <TableHead className="font-semibold text-slate-900">Perfil / Acesso</TableHead>
                <TableHead className="font-semibold text-slate-900">Departamento</TableHead>
                <TableHead className="w-[80px] text-right font-semibold text-slate-900">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} className="hover:bg-slate-50 transition-colors border-slate-100">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 border border-slate-200">
                        <AvatarFallback className="bg-blue-50 text-blue-700 font-bold text-xs uppercase">
                          {u.full_name?.slice(0, 2) || 'UT'}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">{u.full_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm">{u.email}</TableCell>
                  <TableCell>
                    {getRoleBadge(u.role)}
                  </TableCell>
                  <TableCell className="text-slate-600 text-sm">{u.team_id || '-'}</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl border-slate-200">
                        <DropdownMenuItem className="cursor-pointer font-medium text-slate-700 flex items-center">
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer font-medium text-rose-600 focus:bg-rose-50 focus:text-rose-700 flex items-center"
                          onClick={() => handleDelete(u.id, u.full_name)}
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
                  <TableCell colSpan={5} className="h-24 text-center text-slate-500 font-medium">
                    Nenhum colaborador encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        )}
      </div>
    </div>
  );
}
