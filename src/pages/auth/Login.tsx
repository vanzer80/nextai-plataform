import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Se já estiver logado, redireciona
  React.useEffect(() => {
    if (user) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location.state]);

  if (user) return null;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('E-mail ou senha incorretos. Verifique suas informações e tente novamente.');
        }
        throw new Error('Erro na autenticação: ' + error.message);
      }
      
      // O redirecionamento ocorrerá automaticamente pelo AuthProvider / ProtectedRoute
    } catch (err: any) {
      setErrorMsg(err.message || 'Ocorreu um erro inesperado ao fazer login.');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-slate-50 p-4 font-sans text-slate-900">
      <Card className="w-full max-w-sm border-slate-200 shadow-md">
        <CardHeader className="space-y-2 pb-6 text-center">
          <div className="mb-4 flex justify-center text-2xl font-extrabold tracking-tight">
            PORTAL<span className="text-blue-600">MOPAR</span>
          </div>
          <CardTitle className="text-xl font-semibold">Acesso ao Sistema</CardTitle>
          <CardDescription className="text-slate-600">
            Insira suas credenciais corporativas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="email">E-mail</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="tecnico@mopar.com.br" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="focus-visible:ring-blue-600"
                disabled={loading}
              />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Senha</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="focus-visible:ring-blue-600"
                disabled={loading}
              />
            </div>

            {errorMsg && (
              <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm font-medium text-rose-600 shadow-sm">
                {errorMsg}
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full bg-blue-600 text-white transition-colors hover:bg-blue-700" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Autenticando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
