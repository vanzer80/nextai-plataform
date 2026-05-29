import { type Page, expect } from '@playwright/test';

// Re-exporta helpers de auth existentes para evitar duplicação
export { loginAs } from '../helpers/auth';

export const VIEWPORTS = {
  mobile:  { width: 375, height: 812 },
  tablet:  { width: 768, height: 1024 },
  desktop: { width: 1440, height: 900 },
} as const;

export const CREDS = {
  tecnico: {
    email:    process.env.TEST_TECH_EMAIL    ?? '',
    password: process.env.TEST_TECH_PASSWORD ?? '',
  },
  gestor: {
    email:    process.env.TEST_MGR_EMAIL    ?? '',
    password: process.env.TEST_MGR_PASSWORD ?? '',
  },
  master: {
    email:    process.env.TEST_MASTER_MOPAR_EMAIL    ?? '',
    password: process.env.TEST_MASTER_MOPAR_PASSWORD ?? '',
  },
} as const;

/**
 * Garante que não existe scroll horizontal na viewport atual.
 * Tolerância de 1px para arredondamentos de subpixel do navegador.
 */
export async function assertNoHorizontalScroll(page: Page) {
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
  expect(scrollWidth, 'Página não deve ter scroll horizontal').toBeLessThanOrEqual(clientWidth + 1);
}

/** Espera h1 com conteúdo específico — confirma que a página carregou de verdade. */
export async function waitForHeading(page: Page, headingText: RegExp) {
  await expect(page.locator('h1').first()).toContainText(headingText, { timeout: 15_000 });
}

/**
 * Aguarda a sidebar desktop ficar visível.
 * Substitui waitForLoadState('networkidle') que é flaky com Supabase Realtime.
 */
export async function waitForSidebar(page: Page) {
  await expect(page.locator('aside')).toBeVisible({ timeout: 15_000 });
}
