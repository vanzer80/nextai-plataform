/**
 * UX/UI — Design responsivo
 *
 * Login page: todos os testes rodam sem credenciais
 * App (dashboard/reports): requerem credenciais em tests/.env.test
 *
 * Cobre:
 *  UX-RSP-01: Login — Mobile 375px sem overflow horizontal
 *  UX-RSP-02: Login — Tablet 768px sem overflow horizontal
 *  UX-RSP-03: Login — Desktop 1440px sem overflow horizontal
 *  UX-RSP-04: App/Dashboard — Mobile: conteúdo sem overflow horizontal
 *  UX-RSP-05: App/Dashboard — Desktop: aside sidebar visível (lg:flex)
 *  UX-RSP-06: App/OS — Tablet 768px sem overflow horizontal
 */

import { test, expect } from '@playwright/test';
import { loginAs, CREDS, VIEWPORTS, assertNoHorizontalScroll } from './ux-helpers';

const hasTecnico = !!CREDS.tecnico.email;

test.describe('UX — Responsividade', () => {

  // ── UX-RSP-01 ─────────────────────────────────────────────────────────────
  test('UX-RSP-01 — Login Mobile 375px: sem overflow horizontal', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.goto('/login');
    await page.waitForSelector('#email', { timeout: 15_000 });
    await assertNoHorizontalScroll(page);
  });

  // ── UX-RSP-02 ─────────────────────────────────────────────────────────────
  test('UX-RSP-02 — Login Tablet 768px: sem overflow horizontal', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.goto('/login');
    await page.waitForSelector('#email', { timeout: 15_000 });
    await assertNoHorizontalScroll(page);
  });

  // ── UX-RSP-03 ─────────────────────────────────────────────────────────────
  test('UX-RSP-03 — Login Desktop 1440px: sem overflow horizontal', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto('/login');
    await page.waitForSelector('#email', { timeout: 15_000 });
    await assertNoHorizontalScroll(page);
  });

  // ── UX-RSP-04 ─────────────────────────────────────────────────────────────
  test('UX-RSP-04 — Dashboard Mobile 375px: sem overflow horizontal', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await page.setViewportSize(VIEWPORTS.mobile);
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/dashboard');
    // Aguardar conteúdo real antes de medir overflow
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 15_000 });
    await assertNoHorizontalScroll(page);
  });

  // ── UX-RSP-05 ─────────────────────────────────────────────────────────────
  test('UX-RSP-05 — Dashboard Desktop 1440px: sidebar aside visível', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await page.setViewportSize(VIEWPORTS.desktop);
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/dashboard');
    // Sidebar desktop (aside.hidden.lg:flex) deve ser visível em 1440px
    await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
  });

  // ── UX-RSP-06 ─────────────────────────────────────────────────────────────
  test('UX-RSP-06 — Lista de OS Tablet 768px: sem overflow horizontal', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await page.setViewportSize(VIEWPORTS.tablet);
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reports');
    // Aguardar h1 da lista de OS antes de medir overflow
    await expect(page.locator('h1').first()).toContainText(/ordens de servi/i, { timeout: 15_000 });
    await assertNoHorizontalScroll(page);
  });

});
