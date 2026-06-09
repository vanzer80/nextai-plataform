/**
 * UX/UI — Página de Login (nenhuma credencial necessária)
 *
 * Cobre 11 critérios de qualidade SAP-level para a tela de entrada:
 *  UX-LOGIN-01: Tab percorre email → senha → submit em ordem lógica
 *  UX-LOGIN-02: Enter no campo senha submete o formulário
 *  UX-LOGIN-03: Labels associadas aos inputs via htmlFor/id (a11y)
 *  UX-LOGIN-04: Credenciais erradas → erro inline no form, NÃO toast
 *  UX-LOGIN-05: Botão mostra "Autenticando..." e fica disabled durante loading
 *  UX-LOGIN-06: Inputs de email e senha ficam disabled durante loading
 *  UX-LOGIN-07: ThemeToggle acessível no canto superior direito
 *  UX-LOGIN-08: Link "Política de Privacidade" visível e aponta para /privacy
 *  UX-LOGIN-09: Rota protegida sem sessão redireciona para /login
 *  UX-LOGIN-10: Mobile 375px — sem scroll horizontal
 *  UX-LOGIN-11: Tablet 768px — sem scroll horizontal
 */

import { test, expect } from '@playwright/test';
import { assertNoHorizontalScroll, VIEWPORTS } from './ux-helpers';

const INVALID_EMAIL = 'ux.test.invalido@inexistente-nextai.com';
const INVALID_PASS  = 'senhaerrada_ux_9999';

test.describe('UX — Login', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('#email', { timeout: 15_000 });
  });

  // ── UX-LOGIN-01 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-01 — Tab percorre email → senha → submit em ordem lógica', async ({ page }) => {
    // Há elementos focusáveis antes do form (ex: ThemeToggle). Percorrer com Tab
    // até atingir o campo email, depois verificar a sequência.
    let emailReached = false;
    for (let i = 0; i < 6; i++) {
      await page.keyboard.press('Tab');
      const id = await page.evaluate(() => document.activeElement?.id ?? '');
      if (id === 'email') { emailReached = true; break; }
    }
    expect(emailReached, '#email deve ser alcançável via Tab').toBe(true);

    // Email → Senha
    await page.keyboard.press('Tab');
    const idAfterEmail = await page.evaluate(() => document.activeElement?.id ?? '');
    expect(idAfterEmail, 'Tab após email deve focar #password').toBe('password');

    // Senha → Submit
    await page.keyboard.press('Tab');
    const nextFocus = await page.evaluate(() => ({
      tag:  document.activeElement?.tagName.toLowerCase(),
      type: (document.activeElement as HTMLInputElement)?.type ?? '',
    }));
    expect(
      nextFocus.tag === 'button' && nextFocus.type === 'submit',
      'Tab após senha deve focar o botão submit'
    ).toBe(true);
  });

  // ── UX-LOGIN-02 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-02 — Enter no campo senha submete o formulário', async ({ page }) => {
    // Interceptar auth e retornar erro imediatamente (evita cold-start do Supabase)
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      })
    );

    await page.fill('#email', INVALID_EMAIL);
    await page.fill('#password', INVALID_PASS);

    // Enter a partir do campo senha deve submeter o formulário
    await page.locator('#password').press('Enter');

    // Deve exibir o erro inline em < 3s
    await expect(
      page.getByText(/e-mail ou senha incorretos/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── UX-LOGIN-03 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-03 — Inputs têm labels associadas via htmlFor/id (a11y)', async ({ page }) => {
    // Verifica a existência e conteúdo dos labels
    const emailLabel = page.locator('label[for="email"]');
    const passLabel  = page.locator('label[for="password"]');

    await expect(emailLabel).toBeVisible();
    await expect(emailLabel).toContainText(/e-mail/i);

    await expect(passLabel).toBeVisible();
    await expect(passLabel).toContainText(/senha/i);

    // Clicar no label deve focar o input correspondente
    await emailLabel.click();
    const focusedByLabel = await page.evaluate(() => document.activeElement?.id);
    expect(focusedByLabel, 'Clicar no label deve focar #email').toBe('email');
  });

  // ── UX-LOGIN-04 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-04 — Credenciais erradas → erro inline no form, NÃO em toast', async ({ page }) => {
    // Interceptar auth e retornar erro imediatamente (evita cold-start do Supabase)
    await page.route('**/auth/v1/token**', (route) =>
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      })
    );

    await page.fill('#email', INVALID_EMAIL);
    await page.fill('#password', INVALID_PASS);
    await page.click('button[type="submit"]');

    // Erro deve aparecer inline dentro do form (não em toast)
    const inlineError = page.locator('[class*="destructive"]').filter({
      hasText: /e-mail ou senha incorretos/i,
    });
    await expect(inlineError).toBeVisible({ timeout: 5_000 });

    // NÃO deve aparecer como toast (sonner usa data-sonner-toast)
    const toast = page.locator('[data-sonner-toast]');
    await expect(toast).not.toBeVisible();
  });

  // ── UX-LOGIN-05 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-05 — Botão mostra "Autenticando..." e fica disabled durante loading', async ({ page }) => {
    // Atrasa a resposta do Supabase Auth para capturar o estado de loading
    await page.route('**/auth/v1/token**', async (route) => {
      await new Promise<void>((r) => setTimeout(r, 2_500));
      await route.continue();
    });

    await page.fill('#email', INVALID_EMAIL);
    await page.fill('#password', INVALID_PASS);

    const submitBtn = page.locator('button[type="submit"]');
    await submitBtn.click();

    // Durante o loading, botão deve estar desabilitado
    await expect(submitBtn).toBeDisabled({ timeout: 2_000 });

    // E exibir o texto de loading
    await expect(submitBtn).toContainText(/autenticando/i, { timeout: 2_000 });
  });

  // ── UX-LOGIN-06 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-06 — Inputs de email e senha ficam disabled durante loading', async ({ page }) => {
    await page.route('**/auth/v1/token**', async (route) => {
      await new Promise<void>((r) => setTimeout(r, 2_500));
      await route.continue();
    });

    await page.fill('#email', INVALID_EMAIL);
    await page.fill('#password', INVALID_PASS);
    await page.click('button[type="submit"]');

    await expect(page.locator('#email')).toBeDisabled({ timeout: 2_000 });
    await expect(page.locator('#password')).toBeDisabled({ timeout: 2_000 });
  });

  // ── UX-LOGIN-07 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-07 — ThemeToggle está acessível (aria-label presente)', async ({ page }) => {
    const themeBtn = page.getByRole('button', { name: /alternar tema/i });
    await expect(themeBtn).toBeVisible();

    // Clicar deve abrir o dropdown de tema sem erros
    await themeBtn.click();
    // DropdownMenuRadioItem usa role="menuitemradio", não "menuitem"
    const anyOption = page.getByText(/^(claro|escuro|sistema)$/i).first();
    await expect(anyOption).toBeVisible({ timeout: 3_000 });

    // Fechar com Escape
    await page.keyboard.press('Escape');
  });

  // ── UX-LOGIN-08 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-08 — Link "Política de Privacidade" visível e aponta para /privacy', async ({ page }) => {
    const link = page.getByRole('link', { name: /política de privacidade/i });
    await expect(link).toBeVisible();

    const href = await link.getAttribute('href');
    expect(href, 'Href deve apontar para /privacy').toBe('/privacy');
  });

  // ── UX-LOGIN-09 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-09 — Rota protegida sem sessão: caminho para /login garantido', async ({ page }) => {
    await page.goto('/dashboard');

    // Cenário A (Supabase configurado): redirect automático para /login após
    //   o AuthContext resolver a sessão nula.
    // Cenário B (sem .env): ProtectedRoute exibe tela de erro de configuração
    //   com botão "Ir para o Login manual" — o UX de escape correto.
    // Em ambos os casos o usuário deve conseguir chegar ao /login.

    let onLoginPage = false;

    // Tentar redirect automático primeiro (12s para safety net + React render)
    try {
      await page.waitForSelector('#email', { timeout: 12_000 });
      onLoginPage = true;
    } catch {
      // Safety net não disparou ou não há redirect automático
    }

    if (!onLoginPage) {
      // Deve haver o botão de escape para o login manual (UX de fallback)
      const escapeBtn = page.getByRole('button', { name: /ir para o login/i });
      await expect(escapeBtn).toBeVisible({ timeout: 5_000 });
      await escapeBtn.click();
      // window.location.href = '/login' → full navigation
      await page.waitForSelector('#email', { timeout: 10_000 });
    }

    expect(page.url()).toContain('/login');
  });

  // ── UX-LOGIN-10 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-10 — Mobile 375px: sem scroll horizontal na tela de login', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.reload();
    await page.waitForSelector('#email', { timeout: 10_000 });
    await assertNoHorizontalScroll(page);
  });

  // ── UX-LOGIN-11 ─────────────────────────────────────────────────────────────
  test('UX-LOGIN-11 — Tablet 768px: sem scroll horizontal na tela de login', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.reload();
    await page.waitForSelector('#email', { timeout: 10_000 });
    await assertNoHorizontalScroll(page);
  });

});
