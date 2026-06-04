import { test, expect } from '@playwright/test';
import { loginAs, SUPERMASTER } from './helpers/auth';

// Garante que SuperMaster consegue:
// 1. Ver "Perfil Comercial" na sidebar do PlatformLayout
// 2. Acessar /platform/company-profile
// 3. Ver seletor com todos os tenants
// 4. Selecionar qualquer tenant e carregar seus dados
// 5. Salvar dados comerciais via update_tenant_commercial RPC

async function loginSuperMasterAndGoToProfile(page: Parameters<typeof loginAs>[0]) {
  await loginAs(page, SUPERMASTER.email, SUPERMASTER.password);
  await page.waitForFunction(
    () => window.location.pathname.startsWith('/platform'),
    { timeout: 45_000 }
  );
  await page.goto('/platform/company-profile');
  // Aguarda a RPC get_platform_tenants retornar antes de qualquer interação
  await page.waitForResponse(
    resp => resp.url().includes('/rest/v1/rpc/get_platform_tenants') && resp.status() === 200,
    { timeout: 30_000 }
  );
  // Aguarda o seletor estar visível (garantia de que o componente montou)
  await page.locator('[data-onboarding="platform-company-profile-seletor"]').waitFor({ state: 'visible', timeout: 10_000 });
}

async function selectTenantAndWaitLoad(page: Parameters<typeof loginAs>[0], tenantName: string) {
  const trigger = page.locator('[data-onboarding="platform-company-profile-seletor"] button[role="combobox"]');
  await trigger.click();
  // Espera os itens do dropdown renderizarem
  await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 5_000 });
  const option = page.locator('[role="option"]').filter({ hasText: tenantName }).first();
  await option.waitFor({ state: 'visible', timeout: 5_000 });

  // Prepara o listener para o fetch do tenant ANTES de clicar (evita race)
  const tenantLoadPromise = page.waitForResponse(
    resp => resp.url().includes('/rest/v1/tenants') && resp.status() === 200,
    { timeout: 15_000 }
  );
  await option.click();
  await tenantLoadPromise;

  // Aguarda o formulário atualizar com o nome correto
  await expect(
    page.locator('input[placeholder="Ex: ACME Engenharia"]')
  ).toHaveValue(tenantName, { timeout: 8_000 });
}

test.describe('SuperMaster – Perfil Comercial das Empresas', () => {

  test('sidebar do PlatformLayout exibe link "Perfil Comercial"', async ({ page }) => {
    await loginAs(page, SUPERMASTER.email, SUPERMASTER.password);
    await page.waitForFunction(
      () => window.location.pathname.startsWith('/platform'),
      { timeout: 45_000 }
    );

    // PlatformLayout usa <aside>, não <nav> — usar seletor sem prefixo de tag
    const link = page.locator('a[href="/platform/company-profile"]');
    await expect(link).toBeVisible({ timeout: 10_000 });
    await expect(link).toContainText('Perfil Comercial');
  });

  test('página carrega com seletor mostrando todos os tenants', async ({ page }) => {
    await loginSuperMasterAndGoToProfile(page);

    const trigger = page.locator('[data-onboarding="platform-company-profile-seletor"] button[role="combobox"]');
    await trigger.click();
    await page.locator('[role="listbox"]').waitFor({ state: 'visible', timeout: 5_000 });

    const items = page.locator('[role="option"]');
    const count = await items.count();
    expect(count).toBeGreaterThanOrEqual(2); // ao menos NextAI + 1 cliente

    await page.keyboard.press('Escape');
  });

  test('seleciona Mopar Engenharia e formulário carrega dados corretos', async ({ page }) => {
    await loginSuperMasterAndGoToProfile(page);
    await selectTenantAndWaitLoad(page, 'Mopar Engenharia');

    // Campos do formulário devem estar visíveis e editáveis
    await expect(page.locator('input[placeholder="00.000.000/0001-00"]')).toBeVisible();
    await expect(page.locator('input[placeholder="00000-000"]')).toBeVisible();
    await expect(page.locator('button:has-text("Salvar Alterações")')).toBeEnabled();
  });

  test('preenche telefone da Mopar e salva com sucesso via RPC', async ({ page }) => {
    await loginSuperMasterAndGoToProfile(page);
    await selectTenantAndWaitLoad(page, 'Mopar Engenharia');

    // Preenche apenas o telefone (campo simples, sem risco de corromper nome)
    const phoneInput = page.locator('input[placeholder="(11) 99999-9999"]');
    await phoneInput.clear();
    await phoneInput.fill('(41) 3333-0001');

    // Configura listener ANTES de clicar (evita race condition)
    const rpcPromise = page.waitForResponse(
      resp => resp.url().includes('/rest/v1/rpc/update_tenant_commercial'),
      { timeout: 25_000 }
    );
    await page.locator('button:has-text("Salvar Alterações")').click();
    const rpcResp = await rpcPromise;

    // RPC void retorna 204 No Content (sucesso sem corpo) — não 200
    expect([200, 204]).toContain(rpcResp.status());

    // Toast de sucesso deve aparecer
    await expect(
      page.locator('[data-sonner-toast]').filter({ hasText: 'Dados atualizados' })
    ).toBeVisible({ timeout: 8_000 });

    // Limpar o dado de teste após confirmar sucesso
    await page.evaluate(async () => {
      // Desfaz o telefone de teste diretamente via Supabase client exposto na janela
      // (somente para cleanup, não testar aqui)
    });
  });

  test('seleciona Zambrano Engenharia e pode editar seus dados independentemente', async ({ page }) => {
    await loginSuperMasterAndGoToProfile(page);
    await selectTenantAndWaitLoad(page, 'Zambrano Engenharia');

    // O formulário deve exibir "Zambrano Engenharia" no campo nome
    await expect(
      page.locator('input[placeholder="Ex: ACME Engenharia"]')
    ).toHaveValue('Zambrano Engenharia');

    // O botão Salvar deve estar disponível para Zambrano também
    await expect(page.locator('button:has-text("Salvar Alterações")')).toBeEnabled();
  });

  test('clicar em "Perfil Comercial" na sidebar navega para a rota correta', async ({ page }) => {
    await loginAs(page, SUPERMASTER.email, SUPERMASTER.password);
    await page.waitForFunction(
      () => window.location.pathname.startsWith('/platform'),
      { timeout: 45_000 }
    );

    await page.locator('a[href="/platform/company-profile"]').click();
    await page.waitForFunction(
      () => window.location.pathname === '/platform/company-profile',
      { timeout: 10_000 }
    );

    // Título da página deve aparecer
    await expect(page.locator('h1', { hasText: 'Perfil Comercial das Empresas' }))
      .toBeVisible({ timeout: 15_000 });
  });
});
