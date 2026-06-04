import { test, expect, type Page } from '@playwright/test';

const MGR_EMAIL     = process.env.TEST_MGR_EMAIL     ?? '';
const MGR_PASSWORD  = process.env.TEST_MGR_PASSWORD  ?? '';
const TECH_EMAIL    = process.env.TEST_TECH_EMAIL    ?? '';
const TECH_PASSWORD = process.env.TEST_TECH_PASSWORD ?? '';

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|reports)/, { timeout: 20_000 });
  await page.waitForSelector('aside', { timeout: 10_000 });
  await page.waitForTimeout(1000);
}

test('Gestor – todos os grupos SAP aparecem no sidebar desktop', async ({ page }) => {
  await login(page, MGR_EMAIL, MGR_PASSWORD);
  const sidebar = page.locator('aside').first();

  // Todos os labels de grupo devem estar visíveis
  for (const label of [
    'Operações de Campo', 'Comercial', 'Suprimentos',
    'Financeiro', 'Ativos', 'Recursos Humanos',
    'Conhecimento', 'Administração',
  ]) {
    await expect(sidebar.getByText(label, { exact: true })).toBeVisible({ timeout: 5_000 });
  }

  // Dashboard presente sem label (grupo com label vazio)
  await expect(sidebar.getByText('Dashboard', { exact: true })).toBeVisible();

  // Ordem dos grupos: Operações < Financeiro < RH < Administração
  const labels = await sidebar.locator('p.uppercase').allTextContents();
  console.log('Labels no DOM:', labels);

  const idx = (t: string) => labels.findIndex(l => l.includes(t));
  expect(idx('Operações')).toBeLessThan(idx('Financeiro'));
  expect(idx('Financeiro')).toBeLessThan(idx('Recursos'));
  expect(idx('Recursos')).toBeLessThan(idx('Administração'));

  await page.screenshot({ path: 'tests/screenshots/sidebar-gestor.png' });
});

test('Gestor – itens estão nos grupos corretos', async ({ page }) => {
  await login(page, MGR_EMAIL, MGR_PASSWORD);
  const sidebar = page.locator('aside').first();

  // Ordens de Serviço e Orçamentos devem aparecer APÓS o label de Operações de Campo
  // e ANTES do label de Comercial
  const opsLabel   = sidebar.getByText('Operações de Campo', { exact: true });
  const comercLabel = sidebar.getByText('Comercial', { exact: true });
  const osLink     = sidebar.getByRole('link', { name: 'Ordens de Serviço' });

  const opsY   = (await opsLabel.boundingBox())!.y;
  const comercY = (await comercLabel.boundingBox())!.y;
  const osY    = (await osLink.boundingBox())!.y;

  expect(osY).toBeGreaterThan(opsY);
  expect(osY).toBeLessThan(comercY);

  // Colaboradores deve aparecer após label RH e antes de Conhecimento
  const rhLabel  = sidebar.getByText('Recursos Humanos', { exact: true });
  const connLabel = sidebar.getByText('Conhecimento', { exact: true });
  const colabLink = sidebar.getByRole('link', { name: 'Colaboradores' });

  const rhY    = (await rhLabel.boundingBox())!.y;
  const connY  = (await connLabel.boundingBox())!.y;
  const colabY = (await colabLink.boundingBox())!.y;

  expect(colabY).toBeGreaterThan(rhY);
  expect(colabY).toBeLessThan(connY);
});

test('Técnico – apenas grupos com itens acessíveis aparecem', async ({ page }) => {
  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const sidebar = page.locator('aside').first();

  // Grupos que DEVEM existir para Técnico
  await expect(sidebar.getByText('Operações de Campo', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('Suprimentos', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('Financeiro', { exact: true })).toBeVisible();
  await expect(sidebar.getByText('Conhecimento', { exact: true })).toBeVisible();

  // Grupos que NÃO devem aparecer para Técnico
  await expect(sidebar.getByText('Comercial', { exact: true })).not.toBeVisible();
  await expect(sidebar.getByText('Ativos', { exact: true })).not.toBeVisible();
  await expect(sidebar.getByText('Recursos Humanos', { exact: true })).not.toBeVisible();
  await expect(sidebar.getByText('Administração', { exact: true })).not.toBeVisible();

  // Itens corretos visíveis
  await expect(sidebar.getByRole('link', { name: 'Ordens de Serviço' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Compras' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Reembolsos' })).toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Base de Conhecimento' })).toBeVisible();

  // Itens que NÃO pertencem ao Técnico
  await expect(sidebar.getByRole('link', { name: 'Orçamentos' })).not.toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Clientes' })).not.toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Equipamentos' })).not.toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Colaboradores' })).not.toBeVisible();
  await expect(sidebar.getByRole('link', { name: 'Contas a Pagar' })).not.toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/sidebar-tecnico.png' });
});

test('Navegação – clicar em item do grupo navega para a rota correta', async ({ page }) => {
  await login(page, MGR_EMAIL, MGR_PASSWORD);
  const sidebar = page.locator('aside').first();

  // Clientes (grupo Comercial)
  await sidebar.getByRole('link', { name: 'Clientes' }).click();
  await expect(page).toHaveURL(/\/clients/, { timeout: 10_000 });

  // Colaboradores (grupo Recursos Humanos)
  await sidebar.getByRole('link', { name: 'Colaboradores' }).click();
  await expect(page).toHaveURL(/\/rh\/employees/, { timeout: 10_000 });

  // Manutenção Preventiva (grupo Administração)
  await sidebar.getByRole('link', { name: 'Manutenção Preventiva' }).click();
  await expect(page).toHaveURL(/\/admin\/maintenance-plans/, { timeout: 10_000 });

  await page.screenshot({ path: 'tests/screenshots/sidebar-nav-final.png' });
});

test('Sem console errors no load do sidebar', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await page.waitForTimeout(2000);

  // Filtrar erros conhecidos de rede/supabase/ads que não são do app
  const appErrors = errors.filter(e =>
    !e.includes('net::ERR') &&
    !e.includes('favicon') &&
    !e.includes('content_script') &&
    !e.includes('Refused to load')
  );

  console.log('Console errors:', appErrors);
  expect(appErrors).toHaveLength(0);
});
