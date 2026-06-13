import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';
import { Button } from '@/src/components/ui/button';
import { X } from 'lucide-react';
import { useClients } from '@/src/hooks/useClients';
import type { OrcamentosFilter } from '@/src/hooks/useOrcamentos';
import { ORCAMENTO_STATUS_LABEL } from '@/src/types/orcamento';
import type { OrcamentoStatus } from '@/src/types/orcamento';

const ALL_SENTINEL = '__all__';
const STATUS_OPTIONS: OrcamentoStatus[] = ['rascunho', 'enviado', 'aprovado', 'rejeitado', 'expirado'];

interface Props {
  filter: OrcamentosFilter;
  onChange: (f: OrcamentosFilter) => void;
  onClear: () => void;
}

export function OrcamentoFilters({ filter, onChange, onClear }: Props) {
  const clients = useClients();
  const isActive = !!(filter.status || filter.client_id);

  return (
    <div className="flex flex-wrap gap-2 items-center">
      <Select
        value={filter.status || ALL_SENTINEL}
        onValueChange={v =>
          onChange({ ...filter, status: v === ALL_SENTINEL ? '' : (v as OrcamentoStatus) })
        }
      >
        <SelectTrigger className="h-9 w-[150px] text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>Todos os status</SelectItem>
          {STATUS_OPTIONS.map(s => (
            <SelectItem key={s} value={s}>{ORCAMENTO_STATUS_LABEL[s]}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filter.client_id || ALL_SENTINEL}
        onValueChange={v =>
          onChange({ ...filter, client_id: v === ALL_SENTINEL ? '' : v })
        }
      >
        <SelectTrigger className="h-9 w-[180px] text-sm">
          <SelectValue placeholder="Cliente" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_SENTINEL}>Todos os clientes</SelectItem>
          {clients.map(c => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isActive && (
        <Button variant="ghost" size="sm" onClick={onClear} className="h-9 gap-1 text-slate-500">
          <X className="h-3.5 w-3.5" /> Limpar
        </Button>
      )}
    </div>
  );
}
