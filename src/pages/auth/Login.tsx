import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuth } from '@/src/contexts/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import ThemeToggle from '@/src/components/theme/ThemeToggle';
import { NextAILogo } from '@/src/components/brand/NextAILogo';
import { useState } from 'react';

const loginSchema = z.object({
  email: z.string().min(1, 'E-mail é obrigatório.').email('Insira um e-mail válido.'),
  password: z.string().min(1, 'Senha é obrigatória.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  React.useEffect(() => {
    if (user) {
      const from = location.state?.from?.pathname || '/';
      navigate(from, { replace: true });
    }
  }, [user, navigate, location.state]);

  if (user) return null;

  const onSubmit = async (data: LoginFormValues) => {
    setErrorMsg('');
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          throw new Error('E-mail ou senha incorretos. Verifique suas informações e tente novamente.');
        }
        throw new Error('Erro na autenticação: ' + error.message);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Ocorreu um erro inesperado ao fazer login.');
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-background p-4 font-sans text-foreground">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-4 w-full max-w-sm">
        <Card className="w-full border-border shadow-md">
          <CardHeader className="space-y-2 pb-6 text-center">
            <div className="mb-4 flex justify-center">
              <NextAILogo height={44} />
            </div>
            <CardTitle className="text-xl font-semibold">Acesso ao Sistema</CardTitle>
            <CardDescription className="text-muted-foreground">
              Insira suas credenciais corporativas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com.br"
                  {...register('email')}
                  aria-invalid={!!errors.email}
                  aria-describedby={errors.email ? 'email-error' : undefined}
                  className="focus-visible:ring-ring"
                  disabled={loading}
                />
                {errors.email && (
                  <p id="email-error" role="alert" className="text-sm font-medium text-destructive">
                    {errors.email.message}
                  </p>
                )}
              </div>
              <div className="space-y-2 text-left">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  {...register('password')}
                  aria-invalid={!!errors.password}
                  aria-describedby={errors.password ? 'password-error' : undefined}
                  className="focus-visible:ring-ring"
                  disabled={loading}
                />
                {errors.password && (
                  <p id="password-error" role="alert" className="text-sm font-medium text-destructive">
                    {errors.password.message}
                  </p>
                )}
              </div>

              {errorMsg && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm font-medium text-destructive shadow-sm">
                  {errorMsg}
                </div>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                    Autenticando...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Ao acessar a plataforma, você concorda com a nossa{' '}
          <a href="/privacy" className="underline hover:text-foreground transition-colors">
            Política de Privacidade
          </a>
          .
        </p>
      </div>
    </div>
  );
}
