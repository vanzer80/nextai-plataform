/**
 * UX/UI — Navegação e controle de acesso na interface
 *
 * Requer credenciais em tests/.env.test
 * (Tests skipam automaticamente se variáveis ausentes)
 *
 * Cobre:
 *  UX-NAV-01: Técnico vê apenas links autorizados na sidebar desktop
 *  UX-NAV-02: Técnico NÃO vê Clientes, Equipamentos, Orçamentos
 *  UX-NAV-03: Gestor vê Clientes, Equipamentos, Fornecedores, Orçamentos
 *  UX-NAV-04: Link ativo tem aria-current="page" (react-router NavLink)
 *  UX-NAV-05: Técnico acessa /clients via URL → redirecionado para /dashboard
 *  UX-NAV-06: Mobile 375px — aside desktop oculto; bottom nav visível
 *  UX-NAV-07: Perfil do usuário abre sheet; logout redireciona para /login
 */

import { test, expect } from '@playwright/test';
import { loginAs, CREDS, VIEWPORTS, waitForSidebar } from './ux-helpers';

const hasTecnico = !!CREDS.tecnico.email;
const hasGestor  = !!CREDS.gestor.email;

test.describe('UX — Navegação e RBAC', () => {

  // ── UX-NAV-01 ─────────────────────────────────────────────────────────────
  test('UX-NAV-01 — Técnico vê links autorizados: Dashboard, OS, Reembolsos, Compras, KB', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/dashboard');
    await waitForSidebar(page);

    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: /^dashboard$/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /ordens de servi/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /reembolsos/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /compras/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /base de conhecimento/i })).toBeVisible();
  });

  // ── UX-NAV-02 ─────────────────────────────────────────────────────────────
  test('UX-NAV-02 — Técnico NÃO vê Clientes, Equipamentos, Orçamentos na sidebar', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/dashboard');
    await waitForSidebar(page);

    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: /^clientes$/i })).not.toBeVisible();
    await expect(sidebar.getByRole('link', { name: /equipamentos/i })).not.toBeVisible();
    await expect(sidebar.getByRole('link', { name: /^orçamentos$/i })).not.toBeVisible();
    await expect(sidebar.getByRole('link', { name: /fornecedores/i })).not.toBeVisible();
  });

  // ── UX-NAV-03 ─────────────────────────────────────────────────────────────
  test('UX-NAV-03 — Gestor vê Clientes, Equipamentos, Fornecedores e Orçamentos', async ({ page }) => {
    test.skip(!hasGestor, 'TEST_MGR_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.gestor.email, CREDS.gestor.password);
    await page.goto('/dashboard');
    await waitForSidebar(page);

    const sidebar = page.locator('aside');
    await expect(sidebar.getByRole('link', { name: /clientes/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /equipamentos/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /fornecedores/i })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: /orçamentos/i })).toBeVisible();
  });

  // ── UX-NAV-04 ─────────────────────────────────────────────────────────────
  test('UX-NAV-04 — Link ativo tem aria-current="page" na sidebar', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reports');
    await waitForSidebar(page);

    // NavLink do react-router injeta aria-current="page" no link ativo
    const activeLink = page.locator('aside [aria-current="page"]');
    await expect(activeLink).toBeVisible({ timeout: 5_000 });
    await expect(activeLink).toContainText(/ordens de servi/i);
  });

  // ── UX-NAV-05 ─────────────────────────────────────────────────────────────
  test('UX-NAV-05 — Técnico acessa /clients via URL → redirecionado para /dashboard', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);

    await page.goto('/clients');
    // RoleGuard redireciona via <Navigate to="/dashboard" replace> (SPA navigation)
    await expect(page.locator('h1').first()).toContainText(/olá|dashboard/i, { timeout: 15_000 });
    expect(page.url()).toContain('/dashboard');
  });

  // ── UX-NAV-06 ─────────────────────────────────────────────────────────────
  test('UX-NAV-06 — Mobile 375px: sidebar desktop oculta; bottom nav e header visíveis', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await page.setViewportSize(VIEWPORTS.mobile);
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/dashboard');

    // Aguardar o h1 confirmar que o conteúdo carregou
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });

    // Sidebar desktop (aside.hidden.lg:flex) deve estar oculta em 375px
    const desktopSidebar = page.locator('aside');
    await expect(desktopSidebar).not.toBeVisible();

    // Mobile top header (header.lg:hidden) deve estar visível
    const mobileHeader = page.locator('header').filter({ hasText: /./ }).first();
    await expect(mobileHeader).toBeVisible();

    // Bottom nav deve estar visível
    const bottomNav = page.locator('nav').last();
    await expect(bottomNav).toBeVisible();
  });

  // ── UX-NAV-07 ─────────────────────────────────────────────────────────────
  test('UX-NAV-07 — Sheet de perfil abre ao clicar no avatar; logout redireciona para /login', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/dashboard');
    await waitForSidebar(page);

    // Clicar no avatar (data-onboarding="nav-perfil") abre a sheet de perfil
    const profileBtn = page.locator('[data-onboarding="nav-perfil"]').first();
    await expect(profileBtn).toBeVisible({ timeout: 10_000 });
    await profileBtn.click();

    // Sheet deve abrir com "Minha Conta"
    await expect(page.getByText('Minha Conta')).toBeVisible({ timeout: 5_000 });

    // Clicar em "Sair da Conta"
    await page.getByRole('button', { name: /sair da conta/i }).click();

    // Logout via supabase.auth.signOut() + React Router navigate('/login')
    // Aguarda o campo #email da tela de login (mais robusto que waitForURL para SPA)
    await page.waitForSelector('#email', { timeout: 15_000 });
    expect(page.url()).toContain('/login');
  });

});
