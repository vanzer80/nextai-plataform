import { test, expect } from '@playwright/test';
import { loginAs, SUPERMASTER } from '../helpers/auth';

test.describe('PlatformTenants — edição', () => {
  test('edita nome de Zambrano Engenharia e reverte', async ({ page }) => {
    await loginAs(page, SUPERMASTER.email, SUPERMASTER.password);
    await expect(page).toHaveURL(/\/platform\/tenants/, { timeout: 15000 });
    await expect(page.getByRole('cell', { name: /Zambrano/i }).first()).toBeVisible({ timeout: 15000 });

    // Abre dropdown da linha Zambrano
    const zambranoRow = page.locator('tr').filter({ hasText: /Zambrano/i });
    await zambranoRow.locator('button').click();
    await page.waitForSelector('[role="menu"]');
    await page.getByRole('menuitem', { name: /Editar/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();

    const nameInput = page.getByRole('dialog').locator('input[placeholder="Ex: ACME Engenharia"]');
    await nameInput.clear();
    await nameInput.fill('Zambrano Engenharia EDITADO');

    await page.getByRole('button', { name: /Salvar Alterações/i }).click();
    await expect(page.getByText('Empresa atualizada!')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('cell', { name: /Zambrano Engenharia EDITADO/i })).toBeVisible({ timeout: 10000 });

    // --- Reverte o nome original ---
    const editedRow = page.locator('tr').filter({ hasText: /Zambrano Engenharia EDITADO/i });
    await editedRow.locator('button').click();
    await page.waitForSelector('[role="menu"]');
    await page.getByRole('menuitem', { name: /Editar/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const nameInput2 = page.getByRole('dialog').locator('input[placeholder="Ex: ACME Engenharia"]');
    await nameInput2.clear();
    await nameInput2.fill('Zambrano Engenharia');
    await page.getByRole('button', { name: /Salvar Alterações/i }).click();
    await expect(page.getByText('Empresa atualizada!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText('Zambrano Engenharia EDITADO', { exact: true })).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('table').getByText('Zambrano Engenharia', { exact: true })).toBeVisible({ timeout: 10000 });
  });
});
