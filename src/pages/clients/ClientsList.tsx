import { useState, useEffect, useCallback } from 'react';
import { Plus, MoreHorizontal, Building2, Loader2, AlertTriangle, Eye, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/src/components/ui/dropdown-menu';
import { Button } from '@/src/components/ui/button';
import { getClients } from '@/src/services/clientService';
import type { ClientWithLocations } from '@/src/types/client';
import ClientFormSheet from './components/ClientFormSheet';
import ClientDetailSheet from './components/ClientDetailSheet';

export default function ClientsList() {
  const [clients, setClients] = useState<ClientWithLocations[]>([]);
  const [loading, setLoading] = useState(true);

  const [formOpen, setFormOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<ClientWithLocations | null>(null);
  const [editMode, setEditMode] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setClients(await getClients());
    } catch {
      toast.error('Erro ao carregar clientes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setSelected(null); setEditMode(false); setFormOpen(true); };
  const openEdit = (c: ClientWithLocations) => { setSelected(c); setEditMode(true); setDetailOpen(false); setFormOpen(true); };
  const openDetail = (c: ClientWithLocations) => { setSelected(c); setDetailOpen(true); };

  return (
    <div className="flex flex-col gap-6 min-h-full w-full pb-6 animate-in fade-in duration-300">

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Clientes
          </h1>
          <p className="text-sm text-muted-foreground">Gerencie a base de clientes e suas unidades.</p>
        </div>
        <Button onClick={openCreate} data-onboarding="cli-novo" className="h-11 px-6 rounded-xl font-semibold gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" /> Novo Cliente
        </Button>
      </div>

      {/* Tabela */}
      <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : clients.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
            <AlertTriangle className="h-8 w-8" />
            <p className="text-sm">Nenhum cliente cadastrado.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/40">
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="font-semibold text-foreground">Nome / Razão Social</TableHead>
                  <TableHead className="font-semibold text-foreground">CNPJ / CPF</TableHead>
                  <TableHead className="font-semibold text-foreground">Cidade</TableHead>
                  <TableHead className="text-center font-semibold text-foreground">Unidades</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map(c => (
                  <TableRow
                    key={c.id}
                    className="hover:bg-muted/50 transition-colors border-border cursor-pointer"
                    onClick={() => openDetail(c)}
                  >
                    <TableCell className="font-semibold text-foreground text-sm">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm font-mono">{c.cnpj || '—'}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {[c.cidade, c.estado].filter(Boolean).join(' / ') || '—'}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full text-[11px] font-bold bg-muted text-muted-foreground">
                        {c.client_locations?.length ?? 0}
                      </span>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex items-center justify-center h-11 w-11 text-muted-foreground hover:bg-muted hover:text-foreground rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
                          <MoreHorizontal className="h-4 w-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44 rounded-xl">
                          <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => openDetail(c)}>
                            <Eye className="h-4 w-4" /> Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer gap-2" onClick={() => openEdit(c)}>
                            <Pencil className="h-4 w-4" /> Editar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Formulário (criar / editar) */}
      <ClientFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editMode ? selected : null}
        onSuccess={load}
      />

      {/* Detalhes */}
      <ClientDetailSheet
        open={detailOpen}
        onOpenChange={setDetailOpen}
        client={selected}
        onEdit={() => openEdit(selected!)}
        onRefresh={load}
        onDeleted={load}
      />
    </div>
  );
}
