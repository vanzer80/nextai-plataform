import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/src/contexts/AuthContext', () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock('@/src/lib/supabase', () => ({
  supabase: {
    auth: { signInWithPassword: vi.fn() },
  },
}));

vi.mock('@/src/components/theme/ThemeToggle', () => ({
  default: () => null,
}));

vi.mock('@/src/components/brand/NextAILogo', () => ({
  NextAILogo: () => null,
}));

import { supabase } from '@/src/lib/supabase';
import Login from '../Login';

const renderLogin = () =>
  render(
    <MemoryRouter>
      <Login />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.clearAllMocks();
});

// ── Renderização básica ───────────────────────────────────────────────────────

describe('Login — renderização', () => {
  it('exibe campo de e-mail', () => {
    renderLogin();
    expect(screen.getByLabelText('E-mail')).toBeTruthy();
  });

  it('exibe campo de senha', () => {
    renderLogin();
    expect(screen.getByLabelText('Senha')).toBeTruthy();
  });

  it('exibe botão de submit com texto Entrar', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeTruthy();
  });

  it('exibe link da Política de Privacidade apontando para /privacy', () => {
    renderLogin();
    const link = screen.getByRole('link', { name: /Política de Privacidade/i });
    expect(link).toBeTruthy();
    expect(link.getAttribute('href')).toBe('/privacy');
  });

  it('política de privacidade está fora do formulário (abaixo do card)', () => {
    const { container } = renderLogin();
    const form = container.querySelector('form')!;
    const policyEl = screen.getByText(/Política de Privacidade/i).closest('p')!;
    // policy <p> must NOT be a descendant of the <form>
    expect(form.contains(policyEl)).toBe(false);
    // policy <p> must be a sibling of the card wrapper, not outside the flex-col container
    expect(policyEl).toBeTruthy();
  });
});

// ── Autenticação ──────────────────────────────────────────────────────────────

describe('Login — autenticação', () => {
  it('chama signInWithPassword com e-mail e senha digitados', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: { user: null, session: null },
      error: null,
    } as never);

    renderLogin();
    await userEvent.type(screen.getByLabelText('E-mail'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'secret123');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(vi.mocked(supabase.auth.signInWithPassword)).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'secret123',
    });
  });

  it('exibe mensagem de erro ao receber credenciais inválidas', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: null,
      error: { message: 'Invalid login credentials' },
    } as never);

    renderLogin();
    await userEvent.type(screen.getByLabelText('E-mail'), 'wrong@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      screen.getByText(/E-mail ou senha incorretos/i),
    );
  });

  it('exibe mensagem genérica para outros erros de autenticação', async () => {
    vi.mocked(supabase.auth.signInWithPassword).mockResolvedValueOnce({
      data: null,
      error: { message: 'Email not confirmed' },
    } as never);

    renderLogin();
    await userEvent.type(screen.getByLabelText('E-mail'), 'user@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'pass');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() =>
      screen.getByText(/Erro na autenticação/i),
    );
  });
});
