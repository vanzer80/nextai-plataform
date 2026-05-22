import { useState, useEffect, useCallback } from 'react';
import type { Equipment } from '@/src/types/equipment';
import { getEquipments } from '@/src/services/equipmentService';

export function useEquipments() {
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEquipments(await getEquipments());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar equipamentos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { equipments, loading, error, reload: load };
}
