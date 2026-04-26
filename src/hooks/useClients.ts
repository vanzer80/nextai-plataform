import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';

export interface Client {
  id: string;
  name: string;
}

let cache: Client[] | null = null;
let fetchPromise: Promise<Client[]> | null = null;

export function useClients(): Client[] {
  const [clients, setClients] = useState<Client[]>(cache ?? []);

  useEffect(() => {
    if (cache) {
      setClients(cache);
      return;
    }

    if (!fetchPromise) {
      fetchPromise = supabase
        .from('clients')
        .select('id, name')
        .then(({ data }) => {
          cache = data ?? [];
          fetchPromise = null;
          return cache;
        });
    }

    fetchPromise.then(data => setClients(data));
  }, []);

  return clients;
}
