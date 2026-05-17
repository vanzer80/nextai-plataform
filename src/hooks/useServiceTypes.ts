import { useState, useEffect } from 'react';
import { supabase } from '@/src/lib/supabase';

export interface ServiceTypeRow {
  id: string;
  value: string;
  label: string;
  sort_order: number;
  is_active: boolean;
}

// Module-level cache so all component instances share one fetch per session
let _cache: ServiceTypeRow[] | null = null;
let _promise: Promise<ServiceTypeRow[]> | null = null;

async function fetchServiceTypes(): Promise<ServiceTypeRow[]> {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = supabase
      .from('service_types')
      .select('id, value, label, sort_order, is_active')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data, error }) => {
        if (error) throw error;
        _cache = (data ?? []) as ServiceTypeRow[];
        return _cache;
      });
  }
  return _promise;
}

export function invalidateServiceTypesCache() {
  _cache = null;
  _promise = null;
}

export function useServiceTypes() {
  const [types, setTypes] = useState<ServiceTypeRow[]>(_cache ?? []);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) { setTypes(_cache); setLoading(false); return; }
    fetchServiceTypes()
      .then(setTypes)
      .catch(() => setTypes([]))
      .finally(() => setLoading(false));
  }, []);

  return { types, loading };
}
