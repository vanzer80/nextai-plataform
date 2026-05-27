import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'sonner';
import { withTimeout } from '@/src/lib/withTimeout';

export type UserRole = 'Tecnico' | 'Administrativo' | 'Supervisor' | 'Gestor' | 'Financeiro' | 'Comprador' | 'Admin' | 'Master' | 'Cliente';

export interface AuthUser extends User {
  role?: UserRole;
  full_name?: string;
  team_id?: string;
  isPlatform?: boolean;
  setup_pending?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Persists the user's role/team_id across cold-start DB timeouts.
// Key is user-scoped so multi-account sessions don't bleed into each other.
const profileCacheKey = (uid: string) => `nextai-profile-v1-${uid}`;

interface CachedProfile {
  role: UserRole;
  full_name: string;
  team_id: string | null;
  isPlatform: boolean;
  cached_at: number;
}

const PROFILE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const absoluteSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards: prevent concurrent fetches and duplicate SIGNED_IN re-fetches.
  // Supabase fires SIGNED_IN on every tab-focus / storage-event after load.
  const isFetchingRef   = useRef(false);
  const fetchedUserIdRef = useRef<string | null>(null);

  const finalizeLoading = () => {
    if (absoluteSafetyTimeoutRef.current) {
      clearTimeout(absoluteSafetyTimeoutRef.current);
      absoluteSafetyTimeoutRef.current = null;
    }
    setLoading(false);
  };

  useEffect(() => {
    // 3. Garantia de Ciclo (Rede de Segurança Absoluta)
    absoluteSafetyTimeoutRef.current = setTimeout(() => {
      console.warn('⚠️ Absolute Safety Net Timeout: Destravando loading compulsoriamente após 10s');
      setLoading(false);
    }, 10000);

    // 4. Verificação de Chaves (Safety Check)
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.error('CRITICAL: Supabase keys are missing. App vai carregar tela de erro.');
      toast.error('Variáveis de ambiente do Supabase ausentes.');
      // OMITINDO o setLoading(false) propositalmente, para o ProtectedRoute reter a tela e exibir as caixas vermelhas de diagnóstico
      return;
    }

    let isMounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        if (!isMounted) return;

        setSession(currentSession);

        // TOKEN_REFRESHED: apenas atualizar dados do auth.User, preservar role em memória.
        // INITIAL_SESSION: já tratado por initializeAuth() via getSession() — evitar chamada dupla
        // que pode causar race condition (timeout de 30s da segunda chamada sobrescrevendo role correto).
        if (_event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
          if (_event === 'TOKEN_REFRESHED') {
            setUser(prev => prev && currentSession?.user
              ? { ...currentSession.user, role: prev.role, full_name: prev.full_name, team_id: prev.team_id, isPlatform: prev.isPlatform, setup_pending: prev.setup_pending }
              : prev);
          }
          return;
        }

        if (currentSession?.user) {
          // Skip if this exact user was already fetched successfully.
          // Supabase re-fires SIGNED_IN on tab-focus / storage-events — without
          // this guard every focus causes a fetchUserData + potential timeout cascade.
          if (fetchedUserIdRef.current === currentSession.user.id) return;
          // Skip if a fetch is already in flight (prevents concurrent calls).
          if (isFetchingRef.current) return;
          // Don't finalize loading here — initializeAuth() owns that responsibility.
          await fetchUserData(currentSession.user, false);
        } else {
          fetchedUserIdRef.current = null; // allow re-fetch on next login
          setUser(null);
          finalizeLoading();
        }
      }
    );

    // Initial fetch - 1. Garantia de Resiliência
    const initializeAuth = async () => {
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
           console.error('[AuthContext] Erro fatal no getSession:', error);
           throw error;
        }

        if (!isMounted) return;
        
        setSession(currentSession);
        
        if (currentSession?.user) {
          await fetchUserData(currentSession.user);
        } else {
          finalizeLoading(); // Liberar Loading
        }
      } catch (err) {
        console.error('[AuthContext] Erro Crítico Init:', err);
      } finally {
        // Garantia suprema (1): Independente da tragédia, a tela deve destravar
        if (isMounted) finalizeLoading();
      }
    };

    initializeAuth();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (absoluteSafetyTimeoutRef.current) {
        clearTimeout(absoluteSafetyTimeoutRef.current);
        absoluteSafetyTimeoutRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, []);

  // shouldFinalizeLoading=false when called from the onAuthStateChange listener:
  // initializeAuth() (getSession path) is the authoritative source and always
  // calls finalizeLoading() in its own finally block. Calling it here too would
  // unlock the UI ~8s early with a fallback role on cold DB starts.
  const fetchUserData = async (authUser: User, shouldFinalizeLoading = true) => {
    if (isFetchingRef.current) return;
    isFetchingRef.current = true;
    
    // Safety fallback - 2. Fallback de Cadastro
    let defaultProfile: AuthUser = { 
      ...authUser, 
      role: 'Tecnico', 
      full_name: authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Usuário',
      setup_pending: false 
    };

    try {
      // Usar com Timeout Disjuntor longo (30s) para bases que hibernam
      const response = await withTimeout<any>(
        supabase
          .from('users')
          .select('role, full_name, team_id, tenant:tenants(is_platform)')
          .eq('id', authUser.id)
          .maybeSingle(),
        8000
      );
      
      const { data, error } = response;
        
      if (error) {
         console.error('[AuthContext] Supabase query error (RBAC):', error.message);
         throw error;
      };

      if (!data) {
        console.warn(`[AuthContext] Usuário ${authUser.id} autenticado no DB Auth mas NOT FOUND na tabela public.users. (Trigger pending?)`);
        defaultProfile.setup_pending = true;
        setUser(defaultProfile);
      } else {
        fetchedUserIdRef.current = authUser.id; // mark as successfully loaded

        const profile: CachedProfile = {
          role: data.role as UserRole,
          full_name: data.full_name || defaultProfile.full_name,
          team_id: data.team_id ?? null,
          isPlatform: data.tenant?.is_platform ?? false,
          cached_at: Date.now(),
        };

        // Persist profile so cold-start timeouts fall back to real role, not Tecnico
        try { localStorage.setItem(profileCacheKey(authUser.id), JSON.stringify(profile)); } catch { /* storage unavailable */ }

        setUser({ ...authUser, ...profile, setup_pending: false });
      }
    } catch (error: any) {
      if (error.message === 'TIMEOUT_EXCEEDED') {
        console.warn("⚠️ Database Timeout: Preservando role atual ou usando cache de perfil");
        setUser(prev => {
          // Priority 1: already have the correct profile in React state
          if (prev?.id === authUser.id && prev?.role) return prev;
          // Priority 2: last known profile from localStorage, respecting TTL
          try {
            const raw = localStorage.getItem(profileCacheKey(authUser.id));
            if (raw) {
              const cached: CachedProfile = JSON.parse(raw);
              if (Date.now() - (cached.cached_at ?? 0) < PROFILE_CACHE_TTL_MS) {
                return { ...authUser, ...cached, setup_pending: false };
              }
              localStorage.removeItem(profileCacheKey(authUser.id));
            }
          } catch { /* parse error / storage unavailable */ }
          // Priority 3: safe fallback — user can still reach the login screen
          return defaultProfile;
        });
        // Retry in background after DB has had time to wake from hibernate
        if (!retryTimerRef.current) {
          retryTimerRef.current = setTimeout(() => {
            retryTimerRef.current = null;
            isFetchingRef.current = false;
            fetchUserData(authUser);
          }, 20_000);
        }
      } else {
        console.error('[AuthContext] Erro Severo validando perfil RBAC:', error);
        setUser(null); // Conforme sua ordem, forçamos um reset do profile (volta para o login) no caso de falhas letais diferentes de timeout
      }
    } finally {
      isFetchingRef.current = false;
      if (shouldFinalizeLoading) finalizeLoading();
    }
  };

  const signOut = async () => {
    try {
        // Limpeza de cache local agressiva antes de invocar o SDK
        for (const key of Object.keys(localStorage)) {
            if (key.includes('supabase.auth.token') || key.startsWith('sb-') || key.startsWith('nextai-profile-v1-')) {
                localStorage.removeItem(key);
            }
        }
        sessionStorage.clear();
        await supabase.auth.signOut({ scope: 'local' });
    } catch (e) {
        console.warn("Error gracefully signing out:", e);
    } finally {
        setSession(null);
        setUser(null);
        // Opcional: window.location.href = '/login' forçaria uma recarga completa limpando estados do React,
        // mas setar os states acima faz o ProtectedRoute nos ejetar automaticamente e com suavidade.
    }
  };

  return (
    <AuthContext.Provider value={{ session, user, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
