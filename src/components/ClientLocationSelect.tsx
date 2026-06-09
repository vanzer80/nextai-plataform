import { useState } from 'react';
import { PencilLine, MapPin, Phone, User } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useClientLocations } from '@/src/hooks/useClientLocations';
import type { ClientLocation } from '@/src/types/client';

const MANUAL_SENTINEL = '__manual__';

interface ClientLocationSelectProps {
  clientId: string | undefined;
  /** Valor atual do campo client_location_id no formulário. */
  selectedLocationId: string | undefined;
  /** Valor atual do campo site_location no formulário. */
  manualText: string;
  /** Chamado ao selecionar uma filial (loc != null) ou ao entrar em modo manual (null). */
  onLocationSelect: (location: ClientLocation | null) => void;
  /** Chamado ao digitar no campo de texto livre. */
  onManualTextChange: (text: string) => void;
  label?: string;
  className?: string;
}

export function formatLocationLabel(loc: ClientLocation): string {
  const parts: string[] = [loc.nome];
  const street = [loc.logradouro, loc.numero].filter(Boolean).join(', ');
  if (street) parts.push(street);
  const city = [loc.cidade, loc.estado].filter(Boolean).join('/');
  if (city) parts.push(city);
  return parts.join(' — ');
}

/**
 * Seletor de filial vinculada a um cliente.
 * - Se o cliente tem filiais: exibe Select + preview read-only ao selecionar.
 * - Se não tem: exibe diretamente o campo de texto livre.
 * - "Digitar manualmente" limpa o FK e exibe o input de texto.
 *
 * Use key={clientId} no pai para resetar o estado ao trocar de cliente.
 */
export default function ClientLocationSelect({
  clientId,
  selectedLocationId,
  manualText,
  onLocationSelect,
  onManualTextChange,
  label = 'Unidade / Filial',
  className,
}: ClientLocationSelectProps) {
  const { locations, loading, error } = useClientLocations(clientId);

  // Inicializa em modo manual se já há texto mas nenhum FK (ex: edição de registro legado).
  const [manualMode, setManualMode] = useState(
    () => selectedLocationId === undefined && !!manualText,
  );

  // Reseta o modo manual quando o clientId muda (padrão React: setState durante render
  // com guard de prop anterior — sem useEffect para evitar flickering).
  const [prevClientId, setPrevClientId] = useState(clientId);
  if (prevClientId !== clientId) {
    setPrevClientId(clientId);
    setManualMode(false);
  }

  const selectedLocation = selectedLocationId
    ? (locations.find(l => l.id === selectedLocationId) ?? null)
    : null;

  const enterManualMode = () => {
    setManualMode(true);
    onLocationSelect(null);
    onManualTextChange('');
  };

  const handleSelectChange = (value: string) => {
    if (value === MANUAL_SENTINEL) {
      enterManualMode();
      return;
    }
    setManualMode(false);
    const loc = locations.find(l => l.id === value) ?? null;
    onLocationSelect(loc);
    if (loc) onManualTextChange(formatLocationLabel(loc));
  };

  // ── Sem cliente ────────────────────────────────────────────────
  if (!clientId) {
    return (
      <div className={className}>
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <Input
          value=""
          placeholder="Selecione um cliente para ver as filiais"
          className="mt-1 h-12 text-base rounded-xl bg-muted border-border"
          disabled
          readOnly
        />
      </div>
    );
  }

  // ── Erro na query ──────────────────────────────────────────────
  if (error) {
    return (
      <div className={`space-y-2 ${className ?? ''}`}>
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <p className="text-xs text-rose-500">Erro ao carregar filiais: {error}</p>
      </div>
    );
  }

  // ── Carregando ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={`space-y-2 ${className ?? ''}`}>
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }

  // ── Sem filiais cadastradas → fallback direto ──────────────────
  if (locations.length === 0) {
    return (
      <div className={`space-y-2 ${className ?? ''}`}>
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <Input
          value={manualText}
          onChange={e => onManualTextChange(e.target.value)}
          placeholder="Ex: Planta 2 — Setor de Compressores"
          className="h-12 text-base rounded-xl bg-muted border-border focus-visible:ring-ring"
        />
        <p className="text-xs text-muted-foreground">
          Nenhuma filial cadastrada para este cliente.
        </p>
      </div>
    );
  }

  // ── Com filiais ────────────────────────────────────────────────
  const selectValue = selectedLocationId ?? (manualMode ? MANUAL_SENTINEL : '');

  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label className="text-sm font-semibold text-foreground">{label}</Label>

      <Select value={selectValue} onValueChange={handleSelectChange}>
        <SelectTrigger className="h-12 text-base rounded-xl bg-muted border-border focus:ring-ring">
          <SelectValue placeholder="Selecione a filial" />
        </SelectTrigger>
        <SelectContent>
          {locations.map(loc => (
            <SelectItem key={loc.id} value={loc.id} className="py-3 text-base">
              <span className="flex items-center gap-2">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span>
                  {loc.nome}
                  {loc.cidade ? (
                    <span className="text-muted-foreground text-sm ml-1">
                      — {loc.cidade}{loc.estado ? `/${loc.estado}` : ''}
                    </span>
                  ) : null}
                </span>
              </span>
            </SelectItem>
          ))}
          <SelectItem value={MANUAL_SENTINEL} className="py-3 text-base text-muted-foreground">
            <span className="flex items-center gap-2">
              <PencilLine className="h-4 w-4" />
              Digitar manualmente
            </span>
          </SelectItem>
        </SelectContent>
      </Select>

      {/* Preview read-only da filial selecionada via FK */}
      {selectedLocation && (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-1 text-sm">
          <p className="font-semibold text-foreground">{selectedLocation.nome}</p>
          {(selectedLocation.logradouro || selectedLocation.cidade) && (
            <p className="text-muted-foreground flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              {[
                [selectedLocation.logradouro, selectedLocation.numero].filter(Boolean).join(', '),
                selectedLocation.bairro,
                [selectedLocation.cidade, selectedLocation.estado].filter(Boolean).join('/'),
                selectedLocation.cep,
              ].filter(Boolean).join(' — ')}
            </p>
          )}
          {selectedLocation.contato_nome && (
            <p className="text-muted-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 shrink-0" />
              {selectedLocation.contato_nome}
              {selectedLocation.contato_telefone && (
                <span className="flex items-center gap-1 ml-1">
                  <Phone className="h-3 w-3" />
                  {selectedLocation.contato_telefone}
                </span>
              )}
            </p>
          )}
          <button
            type="button"
            onClick={enterManualMode}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 pt-1 block"
          >
            Digitar manualmente
          </button>
        </div>
      )}

      {/* Input manual: quando o usuário escolheu "Digitar manualmente" */}
      {manualMode && (
        <div className="space-y-1">
          <Input
            value={manualText}
            onChange={e => onManualTextChange(e.target.value)}
            placeholder="Ex: Planta 2 — Setor de Compressores"
            className="h-12 text-base rounded-xl bg-muted border-border focus-visible:ring-ring"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setManualMode(false)}
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
          >
            Selecionar da lista
          </button>
        </div>
      )}
    </div>
  );
}
