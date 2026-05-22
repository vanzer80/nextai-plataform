import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Building2, PencilLine } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useClients } from '@/src/hooks/useClients';
import GeolocationCapture from '../GeolocationCapture';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';
import type { GeolocationData } from '@/src/hooks/useGeolocation';

const MANUAL_SENTINEL = '__manual__';

interface Equipment {
  id: string;
  name: string;
}

interface Step2Props {
  form: UseFormReturn<ReportFormValues>;
}

export default function Step2AssetContext({ form }: Step2Props) {
  const { register, setValue, watch } = form;
  const clients = useClients();
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loadingEquipments, setLoadingEquipments] = useState(true);

  const selectedClientId   = watch('client_id');
  const selectedAssetId    = watch('asset_id');
  const assetNameManual    = watch('asset_name_manual');

  // Manual mode: active when user explicitly chose "digitar manualmente"
  // OR when client is selected but has no registered equipments
  const [manualMode, setManualMode] = useState(false);
  const showClientPrompt = !selectedClientId;
  const showManualInput = !showClientPrompt && (manualMode || (loadingEquipments === false && equipments.length === 0));

  useEffect(() => {
    if (!selectedClientId) {
      setEquipments([]);
      setLoadingEquipments(false);
      return;
    }
    setLoadingEquipments(true);
    setManualMode(false);
    supabase
      .from('equipments')
      .select('id, name')
      .eq('client_id', selectedClientId)
      .then(({ data }) => {
        setEquipments(data ?? []);
        setLoadingEquipments(false);
      });
  }, [selectedClientId]);

  // When switching to manual mode, clear the FK selection
  const enterManualMode = () => {
    setValue('asset_id', undefined);
    setManualMode(true);
  };

  // When picking from the dropdown (including going back from manual)
  const handleSelectChange = (val: string) => {
    if (val === MANUAL_SENTINEL) {
      enterManualMode();
      return;
    }
    setManualMode(false);
    setValue('asset_name_manual', '');
    setValue('asset_id', val || undefined);
  };

  const handleGeoChange = (geo: GeolocationData | null) => {
    setValue('geo_lat', geo?.lat ?? undefined);
    setValue('geo_lng', geo?.lng ?? undefined);
    setValue('geo_accuracy', geo?.accuracy ?? undefined);
    setValue('geo_captured_at', geo?.capturedAt ?? undefined);
  };

  const geoValue: GeolocationData | null = watch('geo_lat')
    ? {
        lat: watch('geo_lat') as number,
        lng: watch('geo_lng') as number,
        accuracy: watch('geo_accuracy') as number,
        capturedAt: watch('geo_captured_at') as string,
      }
    : null;

  // Determine the Select display value
  const selectValue = manualMode ? MANUAL_SENTINEL : (selectedAssetId ?? '');

  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-3 border-b border-border bg-muted/30 rounded-t-xl">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-primary" />
          Ativo e Contexto
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">

        {/* Cliente */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Cliente</Label>
          <Select
            value={selectedClientId ?? ''}
            onValueChange={val => {
              setValue('client_id', val || undefined);
              setValue('asset_id', undefined);
            }}
          >
            <SelectTrigger className="h-12 text-base rounded-xl bg-muted border-border focus:ring-ring">
              <SelectValue placeholder="Selecione o cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => (
                <SelectItem key={c.id} value={c.id} className="py-3 text-base">{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Unidade/Local */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Unidade / Local</Label>
          <Input
            {...register('site_location')}
            placeholder="Ex: Planta 2 — Setor de Compressores"
            className="h-12 text-base rounded-xl bg-muted border-border focus-visible:ring-ring"
          />
        </div>

        {/* Equipamento */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Equipamento / Ativo</Label>

          {/* Prompt para selecionar cliente primeiro */}
          {showClientPrompt && (
            <p className="text-sm text-muted-foreground">Selecione um cliente para ver os equipamentos cadastrados.</p>
          )}

          {/* Dropdown — só exibe quando há equipamentos cadastrados */}
          {!showClientPrompt && !loadingEquipments && equipments.length > 0 && (
            <Select value={selectValue} onValueChange={handleSelectChange}>
              <SelectTrigger className="h-12 text-base rounded-xl bg-muted border-border focus:ring-ring">
                <SelectValue placeholder="Selecione o equipamento" />
              </SelectTrigger>
              <SelectContent>
                {equipments.map(eq => (
                  <SelectItem key={eq.id} value={eq.id} className="py-3 text-base">
                    {eq.name}
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
          )}

          {/* Input manual — quando não há equipamentos cadastrados OU usuário escolheu digitar */}
          {showManualInput && (
            <div className="space-y-1">
              <Input
                {...register('asset_name_manual')}
                placeholder="Digite o nome do equipamento / ativo"
                className="h-12 text-base rounded-xl bg-muted border-border focus-visible:ring-ring"
                autoFocus={manualMode}
              />
              {/* Voltar para o dropdown se houver equipamentos cadastrados */}
              {equipments.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setManualMode(false);
                    setValue('asset_name_manual', '');
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
                >
                  Selecionar da lista
                </button>
              )}
            </div>
          )}
        </div>

        {/* Geolocalização */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-foreground">Localização GPS</Label>
          <GeolocationCapture value={geoValue} onChange={handleGeoChange} />
        </div>

      </CardContent>
    </Card>
  );
}
