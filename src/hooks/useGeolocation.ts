import { useState, useCallback } from 'react';

export interface GeolocationData {
  lat: number;
  lng: number;
  accuracy: number;
  capturedAt: string; // ISO string
}

export interface UseGeolocationReturn {
  location: GeolocationData | null;
  loading: boolean;
  error: string | null;
  capture: () => void;
  clear: () => void;
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<GeolocationData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const capture = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocalização não suportada neste dispositivo.');
      return;
    }

    setLoading(true);
    setError(null);

    navigator.geolocation.getCurrentPosition(
      pos => {
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          capturedAt: new Date().toISOString(),
        });
        setLoading(false);
      },
      err => {
        const messages: Record<number, string> = {
          1: 'Permissão de localização negada.',
          2: 'Localização indisponível no momento.',
          3: 'Tempo limite para obter localização.',
        };
        setError(messages[err.code] ?? 'Erro ao obter localização.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, []);

  const clear = useCallback(() => {
    setLocation(null);
    setError(null);
  }, []);

  return { location, loading, error, capture, clear };
}
