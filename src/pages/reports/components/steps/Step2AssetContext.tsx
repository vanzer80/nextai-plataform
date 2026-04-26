import { useEffect, useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';
import { supabase } from '@/src/lib/supabase';
import { useClients } from '@/src/hooks/useClients';
import GeolocationCapture from '../GeolocationCapture';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';
import type { GeolocationData } from '@/src/hooks/useGeolocation';

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
  const selectedClientId = watch('client_id');
  const selectedAssetId = watch('asset_id');

  useEffect(() => {
    supabase
      .from('equipments')
      .select('id, name')
      .then(({ data }) => setEquipments(data ?? []));
  }, []);

  const filteredEquipments = equipments;

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

  return (
    <Card className="shadow-sm border-slate-200">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
        <CardTitle className="text-base flex items-center gap-2">
          <Building2 className="h-4 w-4 text-blue-600" />
          Ativo e Contexto
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-5 space-y-5">

        {/* Cliente */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Cliente</Label>
          <Select
            value={selectedClientId ?? ''}
            onValueChange={val => {
              setValue('client_id', val || undefined);
              setValue('asset_id', undefined);
            }}
          >
            <SelectTrigger className="h-12 text-base rounded-xl bg-slate-50 border-slate-300 focus:ring-blue-600">
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
          <Label className="text-sm font-semibold text-slate-700">Unidade / Local</Label>
          <Input
            {...register('site_location')}
            placeholder="Ex: Planta 2 — Setor de Compressores"
            className="h-12 text-base rounded-xl bg-slate-50 border-slate-300 focus-visible:ring-blue-600"
          />
        </div>

        {/* Equipamento */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Equipamento / Ativo</Label>
          <Select
            value={selectedAssetId ?? ''}
            onValueChange={val => setValue('asset_id', val || undefined)}
          >
            <SelectTrigger className="h-12 text-base rounded-xl bg-slate-50 border-slate-300 focus:ring-blue-600">
              <SelectValue placeholder={selectedClientId ? 'Selecione o equipamento' : 'Selecione o cliente primeiro'} />
            </SelectTrigger>
            <SelectContent>
              {filteredEquipments.map(eq => (
                <SelectItem key={eq.id} value={eq.id} className="py-3 text-base">{eq.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Geolocalização */}
        <div className="space-y-2">
          <Label className="text-sm font-semibold text-slate-700">Localização GPS</Label>
          <GeolocationCapture value={geoValue} onChange={handleGeoChange} />
        </div>

      </CardContent>
    </Card>
  );
}
