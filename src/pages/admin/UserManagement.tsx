import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, MoreHorizontal, Edit, Trash2, Shield, Loader2, KeyRound, Search } from 'lucide-react';
import { toast } from 'sonner';
import {
  fetchTeamUsers,
  fetchClientsForLinking,
  adminCreateUser,
  findUserIdByEmail,
  linkUserToClient,
  updateUser,
  adminResetPassword,
  adminDeleteUser,
} from '@/src/services/userManagementService';
import { useAuth } from '@/src/contexts/AuthContext';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/src/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/src/components/ui/select';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Avatar, AvatarFallback } from '@/src/components/ui/avatar';

// ─── Schemas ──────────────────────────────────────────────────────────────────

const createSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  email: z.string().email('E-mail inválido'),
  role: z.string().min(1, 'Selecione um perfil de acesso'),
  password: z.string().min(6, 'Senha temporária deve ter no mínimo 6 caracteres'),
});

const editSchema = z.object({
  full_name: z.string().min(3, 'Nome deve ter no mínimo 3 caracteres'),
  role: z.string().min(1, 'Selecione um perfil de acesso'),
});

const resetSchema = z.object({
  new_password: z.string().min(6, 'Senha deve ter no mínimo 6 caracteres'),
});

type CreateFormValues = z.infer<typeof createSchema>;
type EditFormValues   = z.infer<typeof editSchema>;
type ResetFormValues  = z.infer<typeof resetSchema>;

// Hierarquia de roles — usada para impedir promoções indevidas no client
const ROLE_RANK: Record<string, number> = {
  Master: 5, Admin: 4, Gestor: 3,
  Supervisor: 2, Financeiro: 2, Comprador: 2, Administrativo: 2, Tecnico: 1,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRoleBadge(role: string) {
  switch (role) {
    case 'Master':
      return <Badge className="bg-primary text-primary-foreground hover:bg-primary/90 border-0">Master</Badge>;
    case 'Admin':
      return <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-200 dark:bg-orange-500/15 dark:text-orange-300 border-0">Admin</Badge>;
    case 'Gestor':
      return <Badge className="bg-primary/15 text-primary hover:bg-primary/20 border-0">Gestor</Badge>;
    case 'Supervisor':
      return <Badge className="bg-violet-100 text-violet-800 hover:bg-violet-200 dark:bg-violet-500/15 dark:text-violet-300 border-0">Supervisor</Badge>;
    case 'Financeiro':
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 border-0">Financeiro</Badge>;
    case 'Comprador':
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-200 dark:bg-amber-500/15 dark:text-amber-300 border-0">Comprador</Badge>;
    case 'Administrativo':
      return <Badge className="bg-secondary text-secondary-foreground hover:bg-secondary/80 border-0">Administrativo</Badge>;
    case 'Cliente':
      return <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-200 dark:bg-sky-500/15 dark:text-sky-300 border-0">Portal Cliente</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground hover:bg-muted/80 border-0">Técnico de Campo</Badge>;
  }
}

const ROLE_SELECT_OPTIONS = [
  { value: 'Tecnico',       label: 'Técnico de Campo' },
  { value: 'Administrativo',label: 'Administrativo'   },
  { value: 'Financeiro',    label: 'Financeiro'       },
  { value: 'Comprador',     label: 'Comprador'        },
  { value: 'Supervisor',    label: 'Supervisor'       },
  { value: 'Gestor',        label: 'Gestor'           },
  { value: 'Admin',         label: 'Admin'            },
  { value: 'Master',        label: 'Master'           },
  { value: 'Cliente',       label: 'Portal do Cliente'},
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');

  // Create
  const [isCreateOpen,    setIsCreateOpen]    = useState(false);
  const [isCreateSubmitting, setIsCreateSubmitting] = useState(false);

  // Edit
  const [editingUser,     setEditingUser]     = useState<any | null>(null);
  const [isEditOpen,      setIsEditOpen]      = useState(false);
  const [isEditSubmitting,setIsEditSubmitting]= useState(false);

  // Reset password
  const [resetPwdUser,    setResetPwdUser]    = useState<{ id: string; name: string } | null>(null);
  const [isResetSubmitting,setIsResetSubmitting]=useState(false);

  // Delete
  const [confirmDelete,   setConfirmDelete]   = useState<{ id: string; name: string } | null>(null);
  const [deletingId,      setDeletingId]      = useState<string | null>(null);

  // ── Forms ──────────────────────────────────────────────────────────────────

  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { full_name: '', email: '', role: '', password: '' },
  });
  const createRole = createForm.watch('role');
  const [createLinkedClientId, setCreateLinkedClientId] = useState('');

  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
    defaultValues: { full_name: '', role: '' },
  });
  const editRole = editForm.watch('role');
  const [editLinkedClientId, setEditLinkedClientId] = useState('');
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { new_password: '' },
  });

  // ── Data ───────────────────────────────────────────────────────────────────

  const fetchUsers = async () => {
    if (!currentUser?.team_id) return;
    setLoading(true);
    try {
      setUsers(await fetchTeamUsers(currentUser.team_id));
    } catch (err: any) {
      toast.error('Erro ao buscar colaboradores', { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser?.team_id) fetchUsers();
  }, [currentUser?.team_id]);

  useEffect(() => {
    if (!currentUser?.team_id) return;
    fetchClientsForLinking().then(setClients);
  }, [currentUser?.team_id]);

  const filteredUsers = users.filter(u =>
    !search.trim() ||
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  );

  // ── Handlers ───────────────────────────────────────────────────────────────

  const onCreateSubmit = async (data: CreateFormValues) => {
    setIsCreateSubmitting(true);
    try {
      const { data: result, error } = await adminCreateUser({
        email: data.email, password: data.password, full_name: data.full_name, role: data.role,
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      // Link client if role is Cliente
      if (data.role === 'Cliente' && createLinkedClientId) {
        const newUser = await findUserIdByEmail(data.email);
        if (newUser) {
          await linkUserToClient(newUser.id, createLinkedClientId);
        }
      }
      toast.success('Colaborador adicionado!', {
        description: `Acesso de ${data.full_name} (${data.role}) habilitado.`,
      });
      await fetchUsers();
      setIsCreateOpen(false);
      createForm.reset();
      setCreateLinkedClientId('');
    } catch (err: any) {
      toast.error('Erro ao criar colaborador', { description: err.message });
    } finally {
      setIsCreateSubmitting(false);
    }
  };

  const onEditSubmit = async (data: EditFormValues) => {
    if (!editingUser) return;
    const isSelf = editingUser.id === currentUser?.id;

    // Impede promoção para role igual ou superior ao do caller
    if (!isSelf) {
      const callerRank = ROLE_RANK[currentUser?.role ?? ''] ?? 0;
      const targetRank = ROLE_RANK[data.role] ?? 0;
      if (targetRank >= callerRank) {
        toast.error('Não é possível atribuir um perfil igual ou superior ao seu.');
        return;
      }
    }

    setIsEditSubmitting(true);
    try {
      const updates: Record<string, string | null> = { full_name: data.full_name };
      if (!isSelf) {
        updates.role = data.role;
        updates.linked_client_id = data.role === 'Cliente' ? (editLinkedClientId || null) : null;
      }

      await updateUser(editingUser.id, updates);
      toast.success('Colaborador atualizado!');
      await fetchUsers();
      setIsEditOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      toast.error('Erro ao atualizar colaborador', { description: err.message });
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const onResetPassword = async (data: ResetFormValues) => {
    if (!resetPwdUser) return;
    setIsResetSubmitting(true);
    try {
      const { data: result, error } = await adminResetPassword(resetPwdUser.id, data.new_password);
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      toast.success(`Senha de ${resetPwdUser.name} redefinida.`);
      setResetPwdUser(null);
      resetForm.reset();
    } catch (err: any) {
      toast.error('Erro ao redefinir senha', { description: err.message });
    } finally {
      setIsResetSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const { id, name } = confirmDelete;
    setDeletingId(id);
    setConfirmDelete(null);
    try {
      const { data, error } = await adminDeleteUser(id);
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

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6 h-full w-full pb-6">

      {/* ── Cabeçalho ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Shield className="h-6 w-6 text-primary" />
            Controle de Acessos
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie colaboradores ativos e seus níveis de permissão no Portal.</p>
        </div>

        {/* ── Dialog: Novo colaborador ── */}
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger
            data-onboarding="admin-usr-convidar"
            className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm font-semibold h-11 px-6 rounded-xl w-full sm:w-auto transition-colors disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus className="h-5 w-5 mr-1 -ml-1" />
            Adicionar Colaborador
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
            <DialogHeader className="p-6 pb-2 border-b border-border bg-muted/40">
              <DialogTitle className="text-xl font-bold text-foreground">Novo Acesso</DialogTitle>
              <DialogDescription>
                Crie um perfil para o colaborador. Ele usará estas credenciais para logar no app.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-foreground">Nome Completo</Label>
                  <Input
                    placeholder="Ex: João da Silva"
                    className="h-11 rounded-lg focus-visible:ring-ring"
                    {...createForm.register('full_name')}
                  />
                  {createForm.formState.errors.full_name && (
                    <p className="text-xs text-destructive font-medium">{createForm.formState.errors.full_name.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">E-mail</Label>
                    <Input
                      placeholder="colaborador@empresa.com"
                      className="h-11 rounded-lg focus-visible:ring-ring"
                      {...createForm.register('email')}
                    />
                    {createForm.formState.errors.email && (
                      <p className="text-xs text-destructive font-medium">{createForm.formState.errors.email.message}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">Senha Temporária</Label>
                    <Input
                      type="password"
                      placeholder="Mínimo 6 caracteres"
                      className="h-11 rounded-lg focus-visible:ring-ring"
                      {...createForm.register('password')}
                    />
                    {createForm.formState.errors.password && (
                      <p className="text-xs text-destructive font-medium">{createForm.formState.errors.password.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-foreground">Perfil de Acesso</Label>
                  <Select onValueChange={(val) => { createForm.setValue('role', val); if (val !== 'Cliente') setCreateLinkedClientId(''); }} value={createRole}>
                    <SelectTrigger className="h-11 rounded-lg focus:ring-ring">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_SELECT_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {createForm.formState.errors.role && (
                    <p className="text-xs text-destructive font-medium">{createForm.formState.errors.role.message}</p>
                  )}
                </div>

                {createRole === 'Cliente' && (
                  <div className="space-y-1">
                    <Label className="text-sm font-semibold text-foreground">Cliente vinculado <span className="text-rose-500">*</span></Label>
                    <Select value={createLinkedClientId} onValueChange={setCreateLinkedClientId}>
                      <SelectTrigger wrapText className="h-11 rounded-lg focus:ring-ring">
                        <SelectValue placeholder="Selecione o cliente...">
                          {clients.find(c => c.id === createLinkedClientId)?.name}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map(c => <SelectItem wrapText key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">Este usuário só verá OS deste cliente.</p>
                  </div>
                )}
              </div>

              <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/40 sm:justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setIsCreateOpen(false); createForm.reset(); setCreateLinkedClientId(''); }}
                  className="rounded-lg h-11 font-semibold"
                  disabled={isCreateSubmitting}
                >
                  Cancelar
                </Button>
                <Button type="submit" className="rounded-lg h-11 font-semibold" disabled={isCreateSubmitting}>
                  {isCreateSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Adicionar Colaborador
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Busca inline ── */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Buscar por nome, e-mail ou perfil..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-10 rounded-xl"
        />
      </div>

      {/* ── Tabela ── */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden min-h-[300px]" data-onboarding="admin-usr-tabela">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground h-64">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-primary" />
            <p className="text-sm">Carregando colaboradores...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-semibold text-foreground w-[260px]">Colaborador</TableHead>
                  <TableHead className="font-semibold text-foreground">E-mail</TableHead>
                  <TableHead className="font-semibold text-foreground">Perfil / Acesso</TableHead>
                  <TableHead className="w-[80px] text-right font-semibold text-foreground">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((u) => (
                  <TableRow key={u.id} className="hover:bg-muted/50 transition-colors border-border">

                    {/* Nome + avatar com indicador de status */}
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <Avatar className="h-9 w-9 border border-border">
                            <AvatarFallback className="bg-primary/15 text-primary font-bold text-xs uppercase">
                              {u.full_name?.slice(0, 2) || 'UT'}
                            </AvatarFallback>
                          </Avatar>
                          <span
                            title={u.status === 'Inativo' ? 'Inativo' : 'Ativo'}
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${u.status === 'Inativo' ? 'bg-muted-foreground' : 'bg-emerald-500'}`}
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">{u.full_name}</p>
                          {u.id === currentUser?.id && (
                            <p className="text-[10px] text-muted-foreground font-medium">Você</p>
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="text-muted-foreground text-sm">{u.email}</TableCell>

                    <TableCell>{getRoleBadge(u.role)}</TableCell>

                    {/* Menu de ações */}
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
                        <DropdownMenuContent align="end" className="w-44 rounded-xl">

                          {/* Editar */}
                          <DropdownMenuItem
                            className="cursor-pointer font-medium flex items-center"
                            onClick={() => {
                              editForm.reset({ full_name: u.full_name, role: u.role });
                              setEditLinkedClientId(u.linked_client_id ?? '');
                              setEditingUser(u);
                              setIsEditOpen(true);
                            }}
                          >
                            <Edit className="mr-2 h-4 w-4" />
                            Editar
                          </DropdownMenuItem>

                          {/* Redefinir Senha (não disponível para si próprio) */}
                          {u.id !== currentUser?.id && (
                            <DropdownMenuItem
                              className="cursor-pointer font-medium flex items-center"
                              onClick={() => {
                                resetForm.reset({ new_password: '' });
                                setResetPwdUser({ id: u.id, name: u.full_name });
                              }}
                            >
                              <KeyRound className="mr-2 h-4 w-4" />
                              Redefinir Senha
                            </DropdownMenuItem>
                          )}

                          {/* Excluir — oculto para o próprio usuário */}
                          {u.id !== currentUser?.id && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                className="cursor-pointer font-medium flex items-center"
                                onClick={() => setConfirmDelete({ id: u.id, name: u.full_name })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </>
                          )}

                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}

                {filteredUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground font-medium">
                      {search.trim()
                        ? `Nenhum colaborador encontrado para "${search}".`
                        : 'Nenhum colaborador cadastrado.'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* ── Dialog: Editar colaborador ── */}
      <Dialog
        open={isEditOpen}
        onOpenChange={(open) => { if (!open) { setIsEditOpen(false); setEditingUser(null); } }}
      >
        <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 pb-2 border-b border-border bg-muted/40">
            <DialogTitle className="text-xl font-bold text-foreground">Editar Colaborador</DialogTitle>
            <DialogDescription>{editingUser?.email}</DialogDescription>
          </DialogHeader>
          <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
            <div className="p-6 space-y-4">

              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground">Nome Completo</Label>
                <Input
                  placeholder="Ex: João da Silva"
                  className="h-11 rounded-lg focus-visible:ring-ring"
                  {...editForm.register('full_name')}
                />
                {editForm.formState.errors.full_name && (
                  <p className="text-xs text-destructive font-medium">{editForm.formState.errors.full_name.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground">Perfil de Acesso</Label>
                <Select
                  onValueChange={(val) => { editForm.setValue('role', val); if (val !== 'Cliente') setEditLinkedClientId(''); }}
                  value={editRole}
                  disabled={editingUser?.id === currentUser?.id}
                >
                  <SelectTrigger className="h-11 rounded-lg focus:ring-ring">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_SELECT_OPTIONS.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingUser?.id === currentUser?.id && (
                  <p className="text-xs text-muted-foreground">Você não pode alterar seu próprio perfil de acesso.</p>
                )}
                {editForm.formState.errors.role && (
                  <p className="text-xs text-destructive font-medium">{editForm.formState.errors.role.message}</p>
                )}
              </div>

              {editRole === 'Cliente' && (
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-foreground">Cliente vinculado</Label>
                  <Select value={editLinkedClientId} onValueChange={setEditLinkedClientId} disabled={editingUser?.id === currentUser?.id}>
                    <SelectTrigger wrapText className="h-11 rounded-lg focus:ring-ring">
                      <SelectValue placeholder="Selecione o cliente...">
                        {clients.find(c => c.id === editLinkedClientId)?.name}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map(c => <SelectItem wrapText key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Este usuário só verá OS deste cliente.</p>
                </div>
              )}

            </div>
            <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/40 sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setIsEditOpen(false); setEditingUser(null); }}
                className="rounded-lg h-11 font-semibold"
                disabled={isEditSubmitting}
              >
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

      {/* ── Dialog: Redefinir senha ── */}
      <Dialog
        open={!!resetPwdUser}
        onOpenChange={(open) => { if (!open) { setResetPwdUser(null); resetForm.reset(); } }}
      >
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/40">
            <DialogTitle className="text-lg font-bold text-foreground">Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para{' '}
              <span className="font-semibold text-foreground">{resetPwdUser?.name}</span>.
              Informe o colaborador após a alteração.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={resetForm.handleSubmit(onResetPassword)}>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <Label className="text-sm font-semibold text-foreground">Nova Senha</Label>
                <Input
                  type="password"
                  placeholder="Mínimo 6 caracteres"
                  className="h-11 rounded-lg focus-visible:ring-ring"
                  {...resetForm.register('new_password')}
                />
                {resetForm.formState.errors.new_password && (
                  <p className="text-xs text-destructive font-medium">{resetForm.formState.errors.new_password.message}</p>
                )}
              </div>
            </div>
            <DialogFooter className="p-6 pt-4 border-t border-border bg-muted/40 sm:justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => { setResetPwdUser(null); resetForm.reset(); }}
                className="rounded-lg h-10 font-semibold"
                disabled={isResetSubmitting}
              >
                Cancelar
              </Button>
              <Button type="submit" className="rounded-lg h-10 font-semibold" disabled={isResetSubmitting}>
                {isResetSubmitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Redefinir Senha
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Confirmar exclusão ── */}
      <Dialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
      >
        <DialogContent className="sm:max-w-[420px] rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-6 pb-4 border-b border-border bg-muted/40">
            <DialogTitle className="text-lg font-bold text-foreground">Excluir colaborador?</DialogTitle>
            <DialogDescription>
              O acesso de{' '}
              <span className="font-semibold text-foreground">{confirmDelete?.name}</span>{' '}
              será revogado permanentemente. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="p-6 pt-4 sm:justify-end gap-2">
            <Button variant="outline" className="rounded-lg h-10 font-semibold" onClick={() => setConfirmDelete(null)}>
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
