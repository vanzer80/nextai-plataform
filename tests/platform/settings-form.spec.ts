import { test, expect } from '@playwright/test';
import { loginAs, SUPERMASTER } from '../helpers/auth';

test.describe('PlatformSettings — formulário de configurações', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, SUPERMASTER.email, SUPERMASTER.password);
    await page.goto('/platform/settings');
  });

  test('formulário carrega com o nome do tenant (não vazio)', async ({ page }) => {
    const nameInput = page.locator('input[placeholder="Ex: NextAI"]');
    await expect(nameInput).not.toHaveValue('', { timeout: 10000 });
    await expect(nameInput).toHaveValue('NextAI');
  });

  test('campo cor primária carrega com valor hex válido', async ({ page }) => {
    const colorInput = page.locator('input[placeholder="#0066CC"]');
    await expect(colorInput).not.toHaveValue('', { timeout: 10000 });
    await expect(colorInput).toHaveValue(/^#[0-9a-fA-F]{6}$/);
  });

  test('seção da conta exibe o email e badge SuperMaster', async ({ page }) => {
    await expect(page.getByRole('main').getByText(SUPERMASTER.email)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('SuperMaster').first()).toBeVisible();
  });

  test('botão Salvar fica desabilitado quando não há alterações', async ({ page }) => {
    // Aguarda o form carregar com os dados do tenant
    await expect(page.locator('input[placeholder="Ex: NextAI"]')).not.toHaveValue('', { timeout: 10000 });
    const saveButton = page.getByRole('button', { name: /Salvar Configurações/i });
    await expect(saveButton).toBeDisabled();
  });
});
