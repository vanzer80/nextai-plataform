import { useState, useEffect, useCallback } from 'react';
import type { AuthUser, UserRole } from '@/src/contexts/AuthContext';
import type { WidgetId } from './widgetRegistry';
import { getEligibleWidgets } from './widgetRegistry';
import { getWidgetIds } from './dashboardConfig';
import { loadDashboardPrefs, saveDashboardPrefs, resetDashboardPrefs } from './dashboardPreferencesService';

export interface DashboardPrefsState {
  /** Lista ordenada de widgets visíveis para o usuário */
  activeWidgets: WidgetId[];
  /** Todos os widgets que o role permite (para o customizer) */
  eligibleWidgets: WidgetId[];
  isLoading: boolean;
  isSaving: boolean;
  /** Salva a configuração personalizada */
  savePrefs: (order: WidgetId[]) => Promise<void>;
  /** Restaura o padrão do role */
  resetPrefs: () => Promise<void>;
}

export function useDashboardPrefs(user: AuthUser | null | undefined): DashboardPrefsState {
  const role = user?.role as UserRole | undefined;

  const roleDefaults = role ? getWidgetIds(role) : [];
  const eligible = role ? getEligibleWidgets(role).map(w => w.id) : [];

  const [activeWidgets, setActiveWidgets] = useState<WidgetId[]>(roleDefaults);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!user?.id || !role) { setIsLoading(false); return; }

    setIsLoading(true);
    loadDashboardPrefs()
      .then(saved => {
        if (saved && saved.length > 0) {
          // Mantém apenas widgets que o role ainda permite (segurança contra downgrade)
          const safe = saved.filter(id => eligible.includes(id));
          setActiveWidgets(safe.length > 0 ? safe : roleDefaults);
        } else {
          setActiveWidgets(roleDefaults);
        }
      })
      .catch(() => setActiveWidgets(roleDefaults))
      .finally(() => setIsLoading(false));
  }, [user?.id, role]); // eslint-disable-line react-hooks/exhaustive-deps

  const savePrefs = useCallback(async (order: WidgetId[]) => {
    setIsSaving(true);
    try {
      // Garante que não salvamos widgets além do que o role permite
      const safe = order.filter(id => eligible.includes(id));
      await saveDashboardPrefs(safe);
      setActiveWidgets(safe);
    } finally {
      setIsSaving(false);
    }
  }, [eligible]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetPrefs = useCallback(async () => {
    setIsSaving(true);
    try {
      await resetDashboardPrefs();
      setActiveWidgets(roleDefaults);
    } finally {
      setIsSaving(false);
    }
  }, [roleDefaults.join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  return { activeWidgets, eligibleWidgets: eligible, isLoading, isSaving, savePrefs, resetPrefs };
}
