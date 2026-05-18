import { test, expect } from '@playwright/test';
import { loginAs, SUPERMASTER } from '../helpers/auth';

const TEST_USER = {
  email: `pw-test-${Date.now()}@playwright.dev`,
  name: 'Playwright Teste Usuário',
  password: 'Test123456',
};

test.describe('PlatformUsers — criação e remoção cross-tenant', () => {
  test('SuperMaster cria usuário no tenant Mopar e depois remove', async ({ page }) => {
    await loginAs(page, SUPERMASTER.email, SUPERMASTER.password);
    await page.goto('/platform/users');

    await expect(page.getByRole('heading', { name: /Usuários da Plataforma/i })).toBeVisible({ timeout: 10000 });

    // Abre dialog de criação
    await page.getByRole('button', { name: /Adicionar Usuário/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Empresa: Mopar Engenharia
    await dialog.getByRole('combobox').first().click();
    await page.getByRole('option', { name: /Mopar Engenharia/i }).click();

    // Dados do usuário
    await dialog.getByPlaceholder('Ex: João da Silva').fill(TEST_USER.name);
    await dialog.getByPlaceholder('colaborador@empresa.com').fill(TEST_USER.email);
    await dialog.getByPlaceholder('Mín. 6 caracteres').fill(TEST_USER.password);

    // Perfil: Técnico de Campo
    await dialog.getByRole('combobox').last().click();
    await page.getByRole('option', { name: /Técnico de Campo/i }).click();

    // Submete (Edge Function tem sleep de 2s interno)
    await page.getByRole('button', { name: /Criar Usuário/i }).click();
    await expect(page.getByText('Usuário criado com sucesso!')).toBeVisible({ timeout: 20000 });

    // Usuário aparece na tabela
    await expect(page.locator('tr').filter({ hasText: TEST_USER.email })).toBeVisible({ timeout: 15000 });

    // Remove o usuário
    const userRow = page.locator('tr').filter({ hasText: TEST_USER.email });
    await userRow.locator('button').click();
    await page.waitForSelector('[role="menu"]');
    await page.getByRole('menuitem', { name: /Excluir/i }).click();

    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog).toBeVisible();
    await page.getByRole('button', { name: /Confirmar exclusão/i }).click();

    await expect(page.locator('tr').filter({ hasText: TEST_USER.email })).not.toBeVisible({ timeout: 10000 });
  });
});
