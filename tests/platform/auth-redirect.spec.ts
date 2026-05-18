import { test, expect } from '@playwright/test';
import { loginAs, SUPERMASTER, MASTER_MOPAR } from '../helpers/auth';

test.describe('Login — redirecionamento inteligente', () => {
  test('SuperMaster é redirecionado para /platform/tenants', async ({ page }) => {
    await loginAs(page, SUPERMASTER.email, SUPERMASTER.password);
    await expect(page).toHaveURL(/\/platform\/tenants/, { timeout: 15000 });
  });

  test('Master Mopar é redirecionado para /dashboard', async ({ page }) => {
    await loginAs(page, MASTER_MOPAR.email, MASTER_MOPAR.password);
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15000 });
  });
});
