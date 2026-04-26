// src/pages/clients/ClientsList.tsx
import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Plus, MoreHorizontal, Edit, Trash2, Building2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/src/lib/supabase';

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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Validation Schema
const clientSchema = z.object({
  name: z.string().min(3, 'Nome/Razão Social deve ter no mínimo 3 caracteres'),
});

type ClientFormValues = z.infer<typeof clientSchema>;

export default function ClientsList() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('clients').select('id, name').order('name', { ascending: true });
      if (error) throw error;
      setClients(data || []);
    } catch (err: any) {
      toast.error('Erro ao listar clientes', { description: err.message });
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: '',
    }
  });

  const onSubmit = async (data: ClientFormValues) => {
    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('clients').insert({
        name: data.name,
      });
      if (error) throw error;

      toast.success('Cliente cadastrado com sucesso!');
      fetchClients();
      setIsDialogOpen(false);
      reset();
    } catch (err: any) {
        toast.error('Erro ao cadastrar', { description: err.message });
        console.error(err);
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) throw error;
      toast.info('Cliente removido!');
      setClients(clients.filter(c => c.id !== id));
    } catch (err: any) {
      toast.error('Erro ao deletar', { description: err.message });
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full w-full max-w-7xl mx-auto pb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Building2 className="h-6 w-6 text-blue-600" /> 
            Clientes
          </h1>
          <p className="text-sm text-slate-600">Gerencie a base de clientes e locais de atuação.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger className="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm font-semibold h-11 px-6 rounded-xl w-full sm:w-auto transition-colors disabled:pointer-events-none disabled:opacity-50">
            <Plus className="h-5 w-5 mr-1 -ml-1" />
            Novo Cliente
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden border-0 rounded-2xl">
            <DialogHeader className="p-6 pb-2 border-b border-slate-100 bg-slate-50">
              <DialogTitle className="text-xl font-bold text-slate-900">Cadastrar Cliente</DialogTitle>
              <DialogDescription>
                Insira as informações do novo cliente para cadastro no sistema.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <Label className="text-sm font-semibold text-slate-700">Razão Social / Nome</Label>
                  <Input 
                    placeholder="Ex: Construtora X" 
                    className="h-11 rounded-lg border-slate-300 bg-slate-50 focus-visible:ring-blue-600"
                    {...register('name')} 
                  />
                  {errors.name && <p className="text-xs text-rose-500 font-medium">{errors.name.message}</p>}
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
                   {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : null}
                  Cadastrar Cliente
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden min-h-[300px]">
        {loading ? (
             <div className="flex justify-center p-12">
               <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
             </div>
        ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow className="hover:bg-transparent border-slate-200">
                <TableHead className="font-semibold text-slate-900">Nome / Razão Social</TableHead>
                <TableHead className="font-semibold text-slate-900">CNPJ (Referência)</TableHead>
                <TableHead className="w-[80px] text-right font-semibold text-slate-900">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clients.map((c) => (
                <TableRow key={c.id} className="hover:bg-slate-50 transition-colors border-slate-100">
                  <TableCell className="font-semibold text-slate-900 text-sm whitespace-nowrap">{c.name}</TableCell>
                  <TableCell className="text-slate-600 text-sm font-mono">-</TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex items-center justify-center h-8 w-8 p-0 text-slate-500 hover:bg-slate-100 hover:text-slate-900 rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50">
                        <MoreHorizontal className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40 rounded-xl border-slate-200">
                        <DropdownMenuItem className="cursor-pointer font-medium text-slate-700 flex items-center" onClick={() => toast.info('Em desenvolvimento: Edição de Cliente')}>
                          <Edit className="mr-2 h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          className="cursor-pointer font-medium text-rose-600 focus:bg-rose-50 focus:text-rose-700 flex items-center"
                          onClick={() => handleDelete(c.id)}
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {clients.length === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="h-24 text-center text-slate-500 font-medium">
                    Nenhum cliente cadastrado.
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
