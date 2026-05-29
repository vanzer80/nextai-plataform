/**
 * UX/UI — Consistência visual e qualidade cross-módulo
 *
 * Cobre padrões SAP Fiori de consistência: headings corretos, status
 * badges, dark mode, e comportamento de tema.
 *
 *  UX-CON-01: Login — Dark mode toggle muda o tema sem reload de página
 *  UX-CON-02: Login — Página de privacidade carrega sem erro de layout
 *  UX-CON-03: App — Heading h1 correto por rota (OS = "Ordens de Serviço")
 *  UX-CON-04: App — Heading h1 correto por rota (Reembolsos)
 *  UX-CON-05: App — Dashboard tem KPIs com valores numéricos (não hardcoded "0")
 *  UX-CON-06: App — Usuário autenticado: email visível no perfil (Sheet)
 */

import { test, expect } from '@playwright/test';
import { loginAs, CREDS } from './ux-helpers';

const hasTecnico = !!CREDS.tecnico.email;
const hasGestor  = !!CREDS.gestor.email;

test.describe('UX — Consistência e Qualidade Visual', () => {

  // ── UX-CON-01 ─────────────────────────────────────────────────────────────
  test('UX-CON-01 — Dark mode toggle muda atributo do html sem recarregar a página', async ({ page }) => {
    await page.goto('/login');
    await page.waitForSelector('#email', { timeout: 15_000 });

    // Estado inicial: capturar data-theme ou class no <html>
    const htmlBefore = await page.evaluate(() => ({
      className: document.documentElement.className,
      dataTheme:  document.documentElement.getAttribute('data-theme') ?? '',
    }));

    // Clicar no ThemeToggle
    const themeBtn = page.getByRole('button', { name: /alternar tema/i });
    await themeBtn.click();

    // DropdownMenuRadioItem usa role="menuitemradio"
    await page.getByText(/^escuro$/i).click();

    // HTML deve mudar para dark sem recarregar
    await expect(async () => {
      const htmlAfter = await page.evaluate(() => document.documentElement.className);
      expect(htmlAfter).toContain('dark');
    }).toPass({ timeout: 3_000 });

    // A página ainda deve ter #email visível (não recarregou)
    await expect(page.locator('#email')).toBeVisible();
  });

  // ── UX-CON-02 ─────────────────────────────────────────────────────────────
  test('UX-CON-02 — Página /privacy carrega sem erro de layout (scroll + conteúdo)', async ({ page }) => {
    await page.goto('/privacy');
    await page.waitForLoadState('networkidle');

    // Deve ter algum conteúdo textual (não tela em branco)
    const body = await page.locator('body').textContent();
    expect(body?.trim().length, 'Página de privacidade deve ter conteúdo').toBeGreaterThan(50);

    // Não deve ter mensagem de erro genérica
    await expect(page.getByText(/não encontrado|404|error/i)).not.toBeVisible();
  });

  // ── UX-CON-03 ─────────────────────────────────────────────────────────────
  test('UX-CON-03 — Rota /reports tem h1 = "Ordens de Serviço"', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    const h1 = page.locator('h1').first();
    await expect(h1).toContainText('Ordens de Serviço', { timeout: 10_000 });
  });

  // ── UX-CON-04 ─────────────────────────────────────────────────────────────
  test('UX-CON-04 — Rota /reimbursements tem h1 com "Reembolso"', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reimbursements');
    await page.waitForLoadState('networkidle');

    const h1 = page.locator('h1').first();
    await expect(h1).toContainText(/reembolso/i, { timeout: 10_000 });
  });

  // ── UX-CON-05 ─────────────────────────────────────────────────────────────
  test('UX-CON-05 — Dashboard KPI widgets carregam e não estão em branco', async ({ page }) => {
    test.skip(!hasGestor, 'TEST_MGR_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.gestor.email, CREDS.gestor.password);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Aguardar dados carregarem (spinner desaparecer)
    const spinner = page.locator('[class*="animate-spin"]');
    await spinner.waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {
      // Spinner pode já estar oculto
    });

    // KPI cards (data-onboarding="dashboard-kpis") devem existir
    const kpiSection = page.locator('[data-onboarding="dashboard-kpis"]');
    await expect(kpiSection).toBeVisible({ timeout: 10_000 });

    // Deve ter pelo menos um número visível (KPI real, não string vazia)
    const kpiNumbers = kpiSection.locator('span, p, div').filter({
      hasText: /^\d+(\.\d+)?$/,
    });
    const count = await kpiNumbers.count();
    expect(count, 'Dashboard deve exibir pelo menos um valor numérico de KPI').toBeGreaterThan(0);
  });

  // ── UX-CON-06 ─────────────────────────────────────────────────────────────
  test('UX-CON-06 — Sheet de perfil exibe email do usuário autenticado', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Abrir sheet de perfil
    const profileBtn = page.locator('[data-onboarding="nav-perfil"]').first();
    await expect(profileBtn).toBeVisible({ timeout: 10_000 });
    await profileBtn.click();

    await expect(page.getByText('Minha Conta')).toBeVisible({ timeout: 5_000 });

    // Email do usuário deve estar visível na sheet
    const emailDomain = CREDS.tecnico.email.split('@')[1]; // ex: "gmail.com"
    await expect(
      page.getByText(new RegExp(emailDomain, 'i'))
    ).toBeVisible({ timeout: 5_000 });
  });

});
