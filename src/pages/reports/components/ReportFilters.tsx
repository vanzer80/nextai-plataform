import { useState, useEffect, useRef } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Search, X } from 'lucide-react';
import { REPORT_STATUS_LABEL } from '@/src/types/reports';
import type { ReportStatus } from '@/src/types/reports';
import type { ReportsFilter } from '@/src/hooks/useReports';

interface ReportFiltersProps {
  filter: ReportsFilter;
  onChange: (filter: ReportsFilter) => void;
  onClear: () => void;
}

const STATUS_OPTIONS: { value: ReportStatus | ''; label: string }[] = [
  { value: '', label: 'Todos os status' },
  { value: 'draft', label: REPORT_STATUS_LABEL.draft },
  { value: 'pending_review', label: REPORT_STATUS_LABEL.pending_review },
  { value: 'returned', label: REPORT_STATUS_LABEL.returned },
  { value: 'approved', label: REPORT_STATUS_LABEL.approved },
  { value: 'rejected', label: REPORT_STATUS_LABEL.rejected },
];

export default function ReportFilters({ filter, onChange, onClear }: ReportFiltersProps) {
  const hasActiveFilter = filter.status || filter.dateFrom || filter.dateTo || filter.query;
  const [inputValue, setInputValue] = useState(filter.query ?? '');
  const isMounted = useRef(false);

  // Sincroniza inputValue quando o filtro é limpo externamente (onClear)
  useEffect(() => {
    setInputValue(filter.query ?? '');
  }, [filter.query]);

  // Debounce 350ms — pula o disparo do primeiro render para não emitir onChange em vão
  useEffect(() => {
    if (!isMounted.current) { isMounted.current = true; return; }
    const timer = setTimeout(() => {
      onChange({ ...filter, query: inputValue.trim() || undefined });
    }, 350);
    return () => clearTimeout(timer);
  }, [inputValue]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="bg-card rounded-xl border border-border p-4 shadow-sm space-y-3">
      {/* Busca full-text — largura total, acima dos outros filtros */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Buscar por nº OS, tipo, problema, local, equipamento..."
          className="h-11 rounded-xl bg-background border-input text-sm pl-9 pr-9"
        />
        {inputValue && (
          <button
            type="button"
            onClick={() => setInputValue('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Status */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</Label>
          <Select
            value={filter.status ?? ''}
            onValueChange={val => onChange({ ...filter, status: val as ReportStatus | '' })}
          >
            <SelectTrigger className="h-10 rounded-lg bg-background border-input text-sm">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value || '__all__'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Data início */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">De</Label>
          <Input
            type="date"
            value={filter.dateFrom ?? ''}
            onChange={e => onChange({ ...filter, dateFrom: e.target.value || undefined })}
            className="h-10 rounded-lg bg-background border-input text-sm"
          />
        </div>

        {/* Data fim */}
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Até</Label>
          <Input
            type="date"
            value={filter.dateTo ?? ''}
            onChange={e => onChange({ ...filter, dateTo: e.target.value || undefined })}
            className="h-10 rounded-lg bg-background border-input text-sm"
          />
        </div>
      </div>

      {hasActiveFilter && (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-xs text-muted-foreground hover:text-foreground h-8"
          >
            Limpar filtros
          </Button>
        </div>
      )}
    </div>
  );
}
