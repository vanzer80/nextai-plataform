import { test, expect } from '@playwright/test';
import { loginAs, MASTER_MOPAR } from '../helpers/auth';

test.describe('PlatformGuard — bloqueio de acesso', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, MASTER_MOPAR.email, MASTER_MOPAR.password);
  });

  test('/platform/tenants redireciona Master para /dashboard', async ({ page }) => {
    await page.goto('/platform/tenants');
    // waitForURL escuta evento de navegação SPA em vez de apenas polling de URL
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  });

  test('/platform/users redireciona Master para /dashboard', async ({ page }) => {
    await page.goto('/platform/users');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  });

  test('/platform/settings redireciona Master para /dashboard', async ({ page }) => {
    await page.goto('/platform/settings');
    await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  });
});
