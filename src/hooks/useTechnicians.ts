import { useEffect, useState } from 'react';
import { supabase } from '@/src/lib/supabase';

export interface Technician {
  id: string;
  full_name: string;
}

let cache: Technician[] | null = null;
let fetchPromise: Promise<Technician[]> | null = null;

export function invalidateTechniciansCache(): void {
  cache = null;
  fetchPromise = null;
}

export function useTechnicians(): Technician[] {
  const [technicians, setTechnicians] = useState<Technician[]>(cache ?? []);

  useEffect(() => {
    if (cache) { setTechnicians(cache); return; }

    if (!fetchPromise) {
      fetchPromise = supabase
        .from('users')
        .select('id, full_name')
        .not('full_name', 'is', null)
        .order('full_name')
        .then(({ data }) => {
          cache = (data ?? []) as Technician[];
          fetchPromise = null;
          return cache;
        });
    }

    fetchPromise.then(data => setTechnicians(data));
  }, []);

  return technicians;
}
