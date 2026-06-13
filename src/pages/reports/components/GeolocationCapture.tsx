import { useEffect } from 'react';
import { MapPin, Loader2, X, Navigation } from 'lucide-react';
import { Button } from '@/src/components/ui/button';
import { useGeolocation } from '@/src/hooks/useGeolocation';
import type { GeolocationData } from '@/src/hooks/useGeolocation';

interface GeolocationCaptureProps {
  value: GeolocationData | null;
  onChange: (data: GeolocationData | null) => void;
}

export default function GeolocationCapture({ value, onChange }: GeolocationCaptureProps) {
  const { location, loading, error, capture, clear } = useGeolocation();

  const handleCapture = () => {
    capture();
  };

  // Propaga para o formulário quando location muda (useEffect evita setState durante render)
  useEffect(() => {
    if (location && location !== value) {
      onChange(location);
    }
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  const displayed = value ?? location;

  return (
    <div className="space-y-2">
      {displayed ? (
        <div className="flex items-start gap-3 rounded-xl bg-emerald-50 border border-emerald-200 p-3">
          <Navigation className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-emerald-800">Localização capturada</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              {displayed.lat.toFixed(6)}, {displayed.lng.toFixed(6)}
            </p>
            <p className="text-xs text-emerald-600">
              Precisão: ±{Math.round(displayed.accuracy)}m
            </p>
          </div>
          <button
            type="button"
            onClick={() => { clear(); onChange(null); }}
            className="text-emerald-500 hover:text-emerald-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          onClick={handleCapture}
          disabled={loading}
          className="w-full h-11 rounded-xl border-slate-300 text-slate-700 gap-2"
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> Obtendo localização...</>
          ) : (
            <><MapPin className="h-4 w-4 text-blue-600" /> Capturar localização GPS</>
          )}
        </Button>
      )}

      {error && (
        <p className="text-xs text-rose-600">{error}</p>
      )}
    </div>
  );
}
