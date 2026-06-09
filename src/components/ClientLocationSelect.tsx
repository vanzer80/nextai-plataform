import { useState } from 'react';
import { PencilLine, MapPin, Phone, User, ChevronDown } from 'lucide-react';
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
  selectedLocationId: string | undefined;
  manualText: string;
  onLocationSelect: (location: ClientLocation | null) => void;
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

  const [manualMode, setManualMode] = useState(
    () => selectedLocationId === undefined && !!manualText,
  );

  // Reset ao trocar de cliente (setState durante render — sem useEffect)
  const [prevClientId, setPrevClientId] = useState(clientId);
  if (prevClientId !== clientId) {
    setPrevClientId(clientId);
    setManualMode(false);
  }

  const selectedLocation = selectedLocationId
    ? (locations.find(l => l.id === selectedLocationId) ?? null)
    : null;

  // Volta ao Select sem entrar em modo manual
  const backToSelect = () => {
    setManualMode(false);
    onLocationSelect(null);
  };

  // Entra em modo de texto livre
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
    const loc = locations.find(l => l.id === value) ?? null;
    setManualMode(false);
    onLocationSelect(loc);
    // Não chama onManualTextChange aqui — o pai define site_location via onLocationSelect
  };

  // ── Sem cliente ────────────────────────────────────────────────
  if (!clientId) {
    return (
      <div className={`space-y-2 ${className ?? ''}`}>
        <Label className="text-sm font-semibold text-foreground">{label}</Label>
        <Input
          value=""
          placeholder="Selecione um cliente para ver as filiais"
          className="h-12 text-base rounded-xl bg-muted border-border"
          disabled
          readOnly
        />
      </div>
    );
  }

  // ── Erro ───────────────────────────────────────────────────────
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

  // ── Sem filiais cadastradas → texto livre direto ───────────────
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
  return (
    <div className={`space-y-2 ${className ?? ''}`}>
      <Label className="text-sm font-semibold text-foreground">{label}</Label>

      {/* Estado A — Filial selecionada via FK: mostra só o card, sem Select */}
      {selectedLocation ? (
        <div className="rounded-xl border border-border bg-muted/40 px-4 py-3 space-y-1.5 text-sm">
          <div className="flex items-start justify-between gap-2">
            <p className="font-semibold text-foreground leading-snug">{selectedLocation.nome}</p>
            <button
              type="button"
              onClick={backToSelect}
              className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors mt-0.5"
              title="Trocar filial"
            >
              <ChevronDown className="h-3.5 w-3.5" />
              Trocar
            </button>
          </div>

          {(selectedLocation.logradouro || selectedLocation.cidade) && (
            <p className="text-muted-foreground flex items-start gap-1.5">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>
                {[
                  [selectedLocation.logradouro, selectedLocation.numero].filter(Boolean).join(', '),
                  selectedLocation.bairro,
                  [selectedLocation.cidade, selectedLocation.estado].filter(Boolean).join('/'),
                  selectedLocation.cep,
                ].filter(Boolean).join(' — ')}
              </span>
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
            className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 pt-0.5 block"
          >
            Digitar manualmente
          </button>
        </div>
      ) : manualMode ? (
        /* Estado B — Texto livre */
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
      ) : (
        /* Estado C — Select aberto para escolha */
        <Select onValueChange={handleSelectChange}>
          <SelectTrigger className="h-12 text-base rounded-xl bg-muted border-border focus:ring-ring">
            <SelectValue placeholder="Selecione a filial" />
          </SelectTrigger>
          <SelectContent className="min-w-[280px]">
            {locations.map(loc => (
              <SelectItem
                key={loc.id}
                value={loc.id}
                textValue={loc.nome}
                className="py-3 text-base"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">
                    <span className="font-medium">{loc.nome}</span>
                    {loc.cidade && (
                      <span className="text-muted-foreground text-sm ml-1.5">
                        — {loc.cidade}{loc.estado ? `/${loc.estado}` : ''}
                      </span>
                    )}
                  </span>
                </span>
              </SelectItem>
            ))}
            <SelectItem
              value={MANUAL_SENTINEL}
              textValue="Digitar manualmente"
              className="py-3 text-base text-muted-foreground"
            >
              <span className="flex items-center gap-2">
                <PencilLine className="h-4 w-4" />
                Digitar manualmente
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
