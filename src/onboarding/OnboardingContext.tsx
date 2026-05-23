import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { useTenant } from '@/src/contexts/TenantContext';
import { useOnboardingDriver } from './useOnboardingDriver';
import { WelcomeModal } from './WelcomeModal';
import type { Role } from './tours/index';

interface OnboardingContextValue {
  startTour: () => void;
  resetTour: () => void;
  hasCompleted: boolean;
}

const OnboardingContext = createContext<OnboardingContextValue>({
  startTour: () => {},
  resetTour: () => {},
  hasCompleted: false,
});

export function useOnboarding() {
  return useContext(OnboardingContext);
}

const STORAGE_KEY = (uid: string) => `onboarding_v1_done_${uid}`;

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [showWelcome, setShowWelcome] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const startedRef = useRef(false);

  const handleTourEnd = useCallback(() => {
    if (!user?.id) return;
    localStorage.setItem(STORAGE_KEY(user.id), 'true');
    setHasCompleted(true);
  }, [user?.id]);

  const { startDriver, destroyDriver } = useOnboardingDriver(handleTourEnd);

  const getEffectiveRole = useCallback((): Role | null => {
    if (!user?.role) return null;
    const isSuperMaster = user.role === 'Master' && user.isPlatform === true;
    return (isSuperMaster ? 'SuperMaster' : user.role) as Role;
  }, [user]);

  const getStartRoute = useCallback((role: Role): string => {
    if (role === 'SuperMaster') return '/platform/tenants';
    if (['Tecnico', 'Administrativo', 'Financeiro', 'Comprador'].includes(role)) return '/reports';
    return '/dashboard';
  }, []);

  const startTour = useCallback(() => {
    setShowWelcome(false);
    const role = getEffectiveRole();
    if (!role) return;
    const startRoute = getStartRoute(role);
    navigate(startRoute);
    setTimeout(() => startDriver(role), 500);
  }, [getEffectiveRole, getStartRoute, navigate, startDriver]);

  const resetTour = useCallback(() => {
    if (!user?.id) return;
    localStorage.removeItem(STORAGE_KEY(user.id));
    setHasCompleted(false);
    destroyDriver();
    startTour();
  }, [user?.id, destroyDriver, startTour]);

  // Auto-trigger welcome modal on first visit
  useEffect(() => {
    if (!user?.id || !user?.role || startedRef.current) return;
    const done = localStorage.getItem(STORAGE_KEY(user.id));
    if (done) { setHasCompleted(true); return; }
    startedRef.current = true;
    const uid = user.id;
    const timer = setTimeout(() => {
      // Re-check at fire time so external code (e.g. e2e tests) can suppress before 1200ms
      if (localStorage.getItem(STORAGE_KEY(uid))) return;
      setShowWelcome(true);
    }, 1200);
    return () => clearTimeout(timer);
  }, [user?.id, user?.role]);

  const tenantName = tenant?.name ?? 'Portal';

  return (
    <OnboardingContext.Provider value={{ startTour, resetTour, hasCompleted }}>
      {children}
      {showWelcome && (
        <WelcomeModal
          tenantName={tenantName}
          onStart={startTour}
          onSkip={() => {
            setShowWelcome(false);
            handleTourEnd();
          }}
        />
      )}
    </OnboardingContext.Provider>
  );
}
