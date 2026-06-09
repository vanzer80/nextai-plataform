import { useEffect, useState } from 'react';
import { getLocationsByClient } from '@/src/services/clientService';
import type { ClientLocation } from '@/src/types/client';

export function useClientLocations(clientId: string | undefined): {
  locations: ClientLocation[];
  loading: boolean;
  error: string | null;
} {
  const [locations, setLocations] = useState<ClientLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!clientId) {
      setLocations([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    getLocationsByClient(clientId)
      .then(data => {
        if (!cancelled) {
          console.log('[useClientLocations] clientId:', clientId, '→', data.length, 'filiais');
          setLocations(data);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[useClientLocations] erro ao buscar filiais:', msg, '| clientId:', clientId);
        if (!cancelled) {
          setLocations([]);
          setError(msg);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [clientId]);

  return { locations, loading, error };
}
