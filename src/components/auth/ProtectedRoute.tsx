import React, { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div className="flex h-screen flex-col items-center justify-center bg-slate-50 gap-4 p-6">
        
        {hasEnvError ? (
          <div className="bg-red-50 border border-red-200 p-6 rounded-xl max-w-md w-full text-center shadow-sm z-50">
            <AlertTriangle className="h-10 w-10 text-red-600 mx-auto mb-3" />
            <h3 className="text-lg font-bold text-red-900 mb-4">Erro Crítico de Configuração</h3>
            {isMissingUrl && (
              <div className="bg-red-100 border border-red-300 text-red-800 p-2 rounded mb-2 font-mono text-xs font-bold text-left px-3">
                ERRO: VITE_SUPABASE_URL NÃO ENCONTRADA
              </div>
            )}
            {isMissingKey && (
              <div className="bg-red-100 border border-red-300 text-red-800 p-2 rounded font-mono text-xs font-bold text-left px-3">
                ERRO: VITE_SUPABASE_ANON_KEY NÃO ENCONTRADA
              </div>
            )}
            <p className="text-sm text-red-700 mt-5 leading-relaxed font-medium">O aplicativo não pode conectar ao banco de dados Supabase.</p>
          </div>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-slate-500 font-medium">Autenticando sessão...</p>
          </>
        )}

        {(showTimeout && !hasEnvError) && (
          <p className="text-xs text-amber-600 max-w-xs text-center mt-2 bg-amber-50 border border-amber-200 p-2 rounded transition-all animate-in zoom-in fade-in">
            A conexão com o servidor está demorando mais do que o normal.
          </p>
        )}

        {/* 3. Botão de Forçar Login */}
        {(showTimeout || hasEnvError) && (
          <Button 
            onClick={() => window.location.href = '/login'}
            variant="outline"
            className="mt-2 border-slate-300 text-slate-700 hover:bg-slate-100 shadow-sm animate-in zoom-in fade-in"
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

export function RoleGuard({ allowedRoles }: { allowedRoles: string[] }) {
  const { user, loading } = useAuth();

  if (loading) return null;

  if (!user?.role || !allowedRoles.includes(user.role)) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-6 text-center bg-slate-50 rounded-xl">
        <h2 className="text-xl font-bold text-slate-900">Acesso Restrito</h2>
        <p className="mt-2 text-sm text-slate-600">
          Seu nível de acesso atual ({user?.role || 'Desconhecido'}) não permite visualizar esta página.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
