import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NextAILogo } from '@/src/components/brand/NextAILogo';
import { supabaseUrl, supabaseAnonKey } from '@/src/lib/supabase';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    // If loading takes more than 3 seconds based on user request
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => setShowTimeout(true), 3000); 
    }
    return () => clearTimeout(timer);
  }, [loading]);

  // 1. Diagnóstico Visual em Variáveis
  const isMissingUrl = !supabaseUrl || supabaseUrl === '';
  const isMissingKey = !supabaseAnonKey || supabaseAnonKey === '';
  const hasEnvError = isMissingUrl || isMissingKey;

  if (loading || hasEnvError) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-background gap-4 p-6 text-foreground">
        
        {hasEnvError ? (
          <div className="bg-destructive/10 border border-destructive/30 p-6 rounded-xl max-w-md w-full text-center shadow-sm z-50">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto mb-3" />
            <h3 className="text-lg font-bold text-destructive mb-4">Erro Crítico de Configuração</h3>
            {isMissingUrl && (
              <div className="bg-destructive/15 border border-destructive/40 text-destructive p-2 rounded mb-2 font-mono text-xs font-bold text-left px-3">
                ERRO: VITE_SUPABASE_URL NÃO ENCONTRADA
              </div>
            )}
            {isMissingKey && (
              <div className="bg-destructive/15 border border-destructive/40 text-destructive p-2 rounded font-mono text-xs font-bold text-left px-3">
                ERRO: VITE_SUPABASE_ANON_KEY NÃO ENCONTRADA
              </div>
            )}
            <p className="text-sm text-destructive mt-5 leading-relaxed font-medium">O aplicativo não pode conectar ao banco de dados Supabase.</p>
          </div>
        ) : (
          <>
            <NextAILogo variant="symbol" height={48} animated />
            <p className="text-muted-foreground font-medium">Autenticando sessão...</p>
          </>
        )}

        {(showTimeout && !hasEnvError) && (
          <p className="text-xs text-amber-700 dark:text-amber-300 max-w-xs text-center mt-2 bg-amber-100/70 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 p-2 rounded transition-all animate-in zoom-in fade-in">
            A conexão com o servidor está demorando mais do que o normal.
          </p>
        )}

        {/* 3. Botão de Forçar Login */}
        {(showTimeout || hasEnvError) && (
          <Button 
            onClick={() => window.location.href = '/login'}
            variant="outline"
            className="mt-2 border-border text-foreground hover:bg-muted shadow-sm animate-in zoom-in fade-in"
          >
            Problemas no carregamento? Ir para o Login manual <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

export function PlatformGuard() {
  const { user, loading } = useAuth();
  if (loading) return null;
  const isSuperMaster = user?.role === 'Master' && user?.isPlatform === true;
  if (!isSuperMaster) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

export function RoleGuard({ allowedRoles }: { allowedRoles: string[] }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user?.role || !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
