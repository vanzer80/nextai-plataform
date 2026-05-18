import { test, expect } from '@playwright/test';
import { loginAs, SUPERMASTER } from '../helpers/auth';

test.describe('PlatformTenants — lista de empresas', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SUPERMASTER.email, SUPERMASTER.password);
    await expect(page).toHaveURL(/\/platform\/tenants/, { timeout: 15000 });
  });

  test('exibe os 3 tenants na tabela', async ({ page }) => {
    await expect(page.getByRole('cell', { name: /Mopar Engenharia/i })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('cell', { name: /Zambrano/i })).toBeVisible();
    // NextAI aparece na linha que também tem o slug "nextai"
    await expect(page.locator('tr').filter({ hasText: /nextai/ })).toBeVisible();
  });

  test('tenant NextAI tem badge "Platform"', async ({ page }) => {
    await expect(page.getByRole('cell', { name: /Mopar Engenharia/i })).toBeVisible({ timeout: 15000 });
    const platformRow = page.locator('tr').filter({ has: page.getByText('Platform', { exact: true }) });
    await expect(platformRow).toBeVisible();
    await expect(platformRow.getByText('NextAI', { exact: true })).toBeVisible();
  });

  test('menu de NextAI não tem opção Suspender', async ({ page }) => {
    await expect(page.getByRole('cell', { name: /Mopar Engenharia/i })).toBeVisible({ timeout: 15000 });
    const platformRow = page.locator('tr').filter({ has: page.getByText('Platform', { exact: true }) });
    await platformRow.locator('button').click();
    await page.waitForSelector('[role="menu"]');
    await expect(page.getByRole('menuitem', { name: /Suspender/i })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: /Editar/i })).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
