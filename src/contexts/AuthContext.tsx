import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/src/lib/supabase';
import { toast } from 'sonner';
import { withTimeout } from '@/src/lib/withTimeout';

export type UserRole = 'Tecnico' | 'Administrativo' | 'Supervisor' | 'Gestor' | 'Financeiro' | 'Comprador' | 'Admin' | 'Master';

export interface AuthUser extends User {
  role?: UserRole;
  full_name?: string;
  team_id?: string;
  setup_pending?: boolean;
}

interface AuthContextType {
  session: Session | null;
  user: AuthUser | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const absoluteSafetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    console.log('[AuthContext] Inicializando Listeners...');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, currentSession) => {
        console.log(`[AuthContext] onAuthStateChange Event: ${_event}`);
        if (!isMounted) return;

        setSession(currentSession);

        // TOKEN_REFRESHED: apenas atualizar dados do auth.User, preservar role em memória.
        // INITIAL_SESSION: já tratado por initializeAuth() via getSession() — evitar chamada dupla
        // que pode causar race condition (timeout de 30s da segunda chamada sobrescrevendo role correto).
        if (_event === 'TOKEN_REFRESHED' || _event === 'INITIAL_SESSION') {
          if (_event === 'TOKEN_REFRESHED') {
            setUser(prev => prev && currentSession?.user
              ? { ...currentSession.user, role: prev.role, full_name: prev.full_name, team_id: prev.team_id, setup_pending: prev.setup_pending }
              : prev);
          }
          return;
        }

        if (currentSession?.user) {
          await fetchUserData(currentSession.user);
        } else {
          console.log('[AuthContext] Sem sessão ativa no listener. Resetando user.');
          setUser(null);
          finalizeLoading();
        }
      }
    );

    // Initial fetch - 1. Garantia de Resiliência
    const initializeAuth = async () => {
      console.log('[AuthContext] Obtendo sessão via getSession()...');
      try {
        const { data: { session: currentSession }, error } = await supabase.auth.getSession();
        
        if (error) {
           console.error('[AuthContext] Erro fatal no getSession:', error);
           throw error;
        }

        if (!isMounted) return;
        
        setSession(currentSession);
        
        if (currentSession?.user) {
          console.log('[AuthContext] Usuário logado via Auth. Buscando Perfil...');
          await fetchUserData(currentSession.user);
        } else {
          console.log('[AuthContext] Nenhum usuário logado. Pronto para Login.');
          finalizeLoading(); // Liberar Loading
        }
      } catch (err) {
        console.error('[AuthContext] Erro Crítico Init:', err);
      } finally {
        // Garantia suprema (1): Independente da tragédia, a tela deve destravar
        if (isMounted) finalizeLoading();
        console.log('[AuthContext] Initial Fetch Encerrado.');
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
    };
  }, []);

  const fetchUserData = async (authUser: User) => {
    console.log('[AuthContext] [fetchUserData] Iniciando...', authUser.id);
    
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
          .select('role, full_name, team_id')
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
        console.log(`[AuthContext] Perfil localizado: Role: ${data.role}`);
        
        let actualRole = data.role;

        setUser({
          ...authUser,
          role: actualRole as UserRole,
          full_name: data.full_name || defaultProfile.full_name,
          team_id: data.team_id,
          setup_pending: false
        });
      }
    } catch (error: any) {
      if (error.message === 'TIMEOUT_EXCEEDED') {
        console.warn("⚠️ Database Timeout: Preservando role atual ou usando fallback de primeiro acesso");
        // Se já temos o perfil correto deste usuário em memória (outra chamada paralela resolveu antes),
        // não sobrescrever com fallback 'Tecnico'.
        setUser(prev => (prev?.id === authUser.id && prev?.role) ? prev : defaultProfile);
      } else {
        console.error('[AuthContext] Erro Severo validando perfil RBAC:', error);
        setUser(null); // Conforme sua ordem, forçamos um reset do profile (volta para o login) no caso de falhas letais diferentes de timeout
      }
    } finally {
      // 1. Garantia de Resiliência: O Spinner DEVE sumir
      console.log('[AuthContext] Finalizando loading do perfil.');
      finalizeLoading();
    }
  };

  const signOut = async () => {
    console.log('[AuthContext] Signing Out...');
    try {
        // Limpeza de cache local agressiva antes de invocar o SDK
        for (const key of Object.keys(localStorage)) {
            if (key.includes('supabase.auth.token') || key.startsWith('sb-')) {
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
