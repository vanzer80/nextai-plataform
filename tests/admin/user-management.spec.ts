import { test, expect, type Page, type Locator } from '@playwright/test';
import { loginAs, MASTER_MOPAR } from '../helpers/auth';

test.describe('UserManagement — controle de acessos', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, MASTER_MOPAR.email, MASTER_MOPAR.password);
    await page.goto('/admin/usuarios');
    // Aguarda ao menos uma linha na tabela (spinner some e dados chegam)
    await page.waitForSelector('table tbody tr', { timeout: 15000 });
  });

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function getOwnRow(page: Page): Locator {
    return page.locator('tr').filter({ has: page.locator('p', { hasText: 'Você' }) });
  }

  function getOtherRow(page: Page): Locator {
    return page
      .locator('tr')
      .filter({ has: page.locator('td') })
      .filter({ hasNot: page.locator('p', { hasText: 'Você' }) })
      .first();
  }

  async function openMenu(row: Locator, page: Page): Promise<void> {
    await row.locator('button').click();
    await page.waitForSelector('[role="menu"]');
  }

  // ── 1. Botões Excluir e Redefinir Senha ocultos na própria linha ─────────

  test('própria linha exibe apenas Editar no menu de ações', async ({ page }) => {
    const own = getOwnRow(page);
    await expect(own).toBeVisible({ timeout: 10000 });

    await openMenu(own, page);

    await expect(page.getByRole('menuitem', { name: /Editar/i })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Excluir/i })).not.toBeVisible();
    await expect(page.getByRole('menuitem', { name: /Redefinir Senha/i })).not.toBeVisible();

    await page.keyboard.press('Escape');
  });

  // ── 2. Campo role desabilitado na edição da própria conta ────────────────

  test('campo role desabilitado na edição da própria conta', async ({ page }) => {
    const own = getOwnRow(page);
    await expect(own).toBeVisible({ timeout: 10000 });

    await openMenu(own, page);
    await page.getByRole('menuitem', { name: /Editar/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();

    const roleTrigger = page.getByRole('dialog').locator('[role="combobox"]');
    await expect(roleTrigger).toBeDisabled();
    await expect(page.getByText(/não pode alterar seu próprio perfil/i)).toBeVisible();

    await page.getByRole('button', { name: /Cancelar/i }).click();
  });

  // ── 3. Edita nome de colaborador com sucesso (com reversão) ─────────────

  test('edita nome de colaborador com sucesso', async ({ page }) => {
    const row = getOtherRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });

    const nameEl = row.locator('td').first().locator('p.font-semibold');
    const original = ((await nameEl.textContent()) ?? '').trim();
    const edited = `${original} EDITADO`;

    // Abre e edita
    await openMenu(row, page);
    await page.getByRole('menuitem', { name: /Editar/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const nameInput = page.getByRole('dialog').locator('input[placeholder="Ex: João da Silva"]');
    await nameInput.clear();
    await nameInput.fill(edited);

    await page.getByRole('button', { name: /Salvar Alterações/i }).click();
    await expect(page.getByText('Colaborador atualizado!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText(edited)).toBeVisible({ timeout: 10000 });

    // Reverte o nome original
    const editedRow = page.locator('tr').filter({ hasText: edited });
    await openMenu(editedRow, page);
    await page.getByRole('menuitem', { name: /Editar/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const nameInput2 = page.getByRole('dialog').locator('input[placeholder="Ex: João da Silva"]');
    await nameInput2.clear();
    await nameInput2.fill(original);
    await page.getByRole('button', { name: /Salvar Alterações/i }).click();
    await expect(page.getByText('Colaborador atualizado!')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('table').getByText(edited)).not.toBeVisible({ timeout: 5000 });
  });

  // ── 4. Altera role de colaborador para Supervisor e reverte ─────────────

  test('altera role de colaborador para Supervisor e reverte', async ({ page }) => {
    const row = getOtherRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });

    const nameEl = row.locator('td').first().locator('p.font-semibold');
    const userName = ((await nameEl.textContent()) ?? '').trim();

    await openMenu(row, page);
    await page.getByRole('menuitem', { name: /Editar/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    const roleTrigger = page.getByRole('dialog').locator('[role="combobox"]');
    // textContent inclui o ícone de seta (▼) — descarta sufixo não-alfanumérico/espaço
    const rawLabel = ((await roleTrigger.textContent()) ?? '').trim();
    const originalRoleLabel = rawLabel.replace(/[^a-zA-ZÀ-ú\s]+$/, '').trim();

    // Muda para Supervisor (rank 2, sempre abaixo de Master rank 5)
    await roleTrigger.click();
    await page.getByRole('option', { name: 'Supervisor' }).click();

    await page.getByRole('button', { name: /Salvar Alterações/i }).click();
    await expect(page.getByText('Colaborador atualizado!')).toBeVisible({ timeout: 10000 });

    // Reverte para o role original (pula se era Master — hierarquia impede reatribuição)
    const targetRow = page.locator('tr').filter({ hasText: userName }).first();
    await openMenu(targetRow, page);
    await page.getByRole('menuitem', { name: /Editar/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    if (originalRoleLabel && originalRoleLabel !== 'Master') {
      const roleTrigger2 = page.getByRole('dialog').locator('[role="combobox"]');
      await roleTrigger2.click();
      await page.getByRole('option', { name: originalRoleLabel, exact: true }).click();
      await page.getByRole('button', { name: /Salvar Alterações/i }).click();
      await expect(page.getByText('Colaborador atualizado!')).toBeVisible({ timeout: 10000 });
    } else {
      await page.getByRole('button', { name: /Cancelar/i }).click();
    }
  });

  // ── 5. Redefine senha de colaborador ────────────────────────────────────

  test('redefine senha de colaborador com sucesso', async ({ page }) => {
    const row = getOtherRow(page);
    await expect(row).toBeVisible({ timeout: 10000 });

    const nameEl = row.locator('td').first().locator('p.font-semibold');
    const userName = ((await nameEl.textContent()) ?? '').trim();

    await openMenu(row, page);
    await page.getByRole('menuitem', { name: /Redefinir Senha/i }).click();

    await expect(page.getByRole('dialog')).toBeVisible();
    // Confirma que o nome do colaborador aparece na descrição do dialog
    await expect(page.getByRole('dialog')).toContainText(userName);

    await page.getByRole('dialog').locator('input[type="password"]').fill('novaSenha123');
    await page.getByRole('dialog').getByRole('button', { name: /Redefinir Senha/i }).click();

    await expect(page.getByText(/redefinida/i)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
  });

  // ── 6. Busca por nome ────────────────────────────────────────────────────

  test('busca filtra colaboradores por nome', async ({ page }) => {
    const own = getOwnRow(page);
    await expect(own).toBeVisible({ timeout: 10000 });

    const nameEl = own.locator('td').first().locator('p.font-semibold');
    const ownName = ((await nameEl.textContent()) ?? '').trim();
    const term = ownName.slice(0, Math.min(5, ownName.length));

    const searchInput = page.getByPlaceholder(/Buscar por nome/i);
    await searchInput.fill(term);

    // A própria linha deve permanecer visível
    await expect(own).toBeVisible({ timeout: 5000 });

    // Termo inexistente → empty state
    await searchInput.fill('xyzabcdef123');
    await expect(page.getByText(/Nenhum colaborador encontrado/i)).toBeVisible({ timeout: 5000 });

    // Limpa e restaura lista completa
    await searchInput.clear();
    await expect(own).toBeVisible({ timeout: 5000 });
  });

  // ── 7. Busca por perfil de acesso ────────────────────────────────────────

  test('busca filtra colaboradores por perfil de acesso', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Buscar por nome/i);
    await searchInput.fill('master');

    // Linha do MASTER_MOPAR (role "Master") deve permanecer visível
    await expect(getOwnRow(page)).toBeVisible({ timeout: 5000 });

    await searchInput.clear();
  });
});
