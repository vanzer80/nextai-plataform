import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const MGR_EMAIL     = process.env.TEST_MGR_EMAIL     ?? '';
const MGR_PASSWORD  = process.env.TEST_MGR_PASSWORD  ?? '';
const TECH_EMAIL    = process.env.TEST_TECH_EMAIL    ?? '';
const TECH_PASSWORD = process.env.TEST_TECH_PASSWORD ?? '';

async function login(page: any, email: string, password: string) {
  await loginAs(page, email, password);
  await page.waitForSelector('aside', { timeout: 10_000 });
  await page.waitForTimeout(800);
}

test('Gestor – todos os grupos aparecem no sidebar desktop', async ({ page }) => {
  await login(page, MGR_EMAIL, MGR_PASSWORD);
  const sidebar = page.locator('aside').first();

  for (const label of [
    'Operações de Campo', 'Comercial', 'Suprimentos',
    'Financeiro', 'Recursos Humanos', 'Conhecimento',
    'Configurações', 'Administração',
  ]) {
    await expect(sidebar.getByText(label, { exact: true })).toBeVisible({ timeout: 5_000 });
  }

  // Grupo "Ativos" não existe mais (Equipamentos foi para Suprimentos)
  await expect(sidebar.getByText('Ativos', { exact: true })).not.toBeVisible();

  await expect(sidebar.getByText('Dashboard', { exact: true })).toBeVisible();

  // Ordem: Operações < Financeiro < RH < Configurações < Administração
  const labels = await sidebar.locator('p.uppercase').allTextContents();
  console.log('Labels no DOM:', labels);

  const idx = (t: string) => labels.findIndex(l => l.includes(t));
  expect(idx('Operações')).toBeLessThan(idx('Financeiro'));
  expect(idx('Financeiro')).toBeLessThan(idx('Recursos'));
  expect(idx('Recursos')).toBeLessThan(idx('Configurações'));
  expect(idx('Configurações')).toBeLessThan(idx('Administração'));

  await page.screenshot({ path: 'tests/screenshots/sidebar-gestor.png' });
});

test('Gestor – itens estão nos grupos corretos', async ({ page }) => {
  await login(page, MGR_EMAIL, MGR_PASSWORD);
  const sidebar = page.locator('aside').first();

  // Orçamentos deve aparecer APÓS Comercial e ANTES de Suprimentos
  const comercLabel  = sidebar.getByText('Comercial', { exact: true });
  const supLabel     = sidebar.getByText('Suprimentos', { exact: true });
  const orcLink      = sidebar.getByRole('link', { name: 'Orçamentos' });

  const comercY = (await comercLabel.boundingBox())!.y;
  const supY    = (await supLabel.boundingBox())!.y;
  const orcY    = (await orcLink.boundingBox())!.y;

  expect(orcY).toBeGreaterThan(comercY);
  expect(orcY).toBeLessThan(supY);

  // Manutenção Preventiva deve aparecer APÓS Operações de Campo e ANTES de Comercial
  const opsLabel   = sidebar.getByText('Operações de Campo', { exact: true });
  const maintLink  = sidebar.getByRole('link', { name: 'Manutenção Preventiva' });

  const opsY    = (await opsLabel.boundingBox())!.y;
  const maintY  = (await maintLink.boundingBox())!.y;

  expect(maintY).toBeGreaterThan(opsY);
  expect(maintY).toBeLessThan(comercY);

  // Equipamentos deve aparecer APÓS Suprimentos e ANTES de Financeiro
  const finLabel  = sidebar.getByText('Financeiro', { exact: true });
  const equipLink = sidebar.getByRole('link', { name: 'Equipamentos' });

  const finY   = (await finLabel.boundingBox())!.y;
  const equipY = (await equipLink.boundingBox())!.y;

  expect(equipY).toBeGreaterThan(supY);
  expect(equipY).toBeLessThan(finY);

  // Colaboradores deve aparecer após RH e antes de Conhecimento
  const rhLabel   = sidebar.getByText('Recursos Humanos', { exact: true });
  const connLabel = sidebar.getByText('Conhecimento', { exact: true });
  const colabLink = sidebar.getByRole('link', { name: 'Colaboradores' });

  const rhY    = (await rhLabel.boundingBox())!.y;
  const connY  = (await connLabel.boundingBox())!.y;
  const colabY = (await colabLink.boundingBox())!.y;

  expect(colabY).toBeGreaterThan(rhY);
  expect(colabY).toBeLessThan(connY);

  // Tipos de Serviço deve aparecer em Configurações (após Conhecimento, antes de Administração)
  const cfgLabel  = sidebar.getByText('Configurações', { exact: true });
  const adminLabel = sidebar.getByText('Administração', { exact: true });
  const svcLink   = sidebar.getByRole('link', { name: 'Tipos de Serviço' });

  const cfgY   = (await cfgLabel.boundingBox())!.y;
  const adminY = (await adminLabel.boundingBox())!.y;
  const svcY   = (await svcLink.boundingBox())!.y;

  expect(svcY).toBeGreaterThan(cfgY);
  expect(svcY).toBeLessThan(adminY);
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
  await expect(sidebar.getByText('Configurações', { exact: true })).not.toBeVisible();
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
  await expect(sidebar.getByRole('link', { name: 'Manutenção Preventiva' })).not.toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/sidebar-tecnico.png' });
});

test('Navegação – clicar em item do grupo navega para a rota correta', async ({ page }) => {
  await login(page, MGR_EMAIL, MGR_PASSWORD);
  const sidebar = page.locator('aside').first();

  // Clientes (grupo Comercial)
  await sidebar.getByRole('link', { name: 'Clientes' }).click();
  await expect(page).toHaveURL(/\/clients/, { timeout: 20_000 });

  // Orçamentos (grupo Comercial)
  await sidebar.getByRole('link', { name: 'Orçamentos' }).click();
  await expect(page).toHaveURL(/\/orcamentos/, { timeout: 20_000 });

  // Colaboradores (grupo Recursos Humanos)
  await sidebar.getByRole('link', { name: 'Colaboradores' }).click();
  await expect(page).toHaveURL(/\/rh\/employees/, { timeout: 20_000 });

  // Tipos de Serviço (grupo Configurações)
  await sidebar.getByRole('link', { name: 'Tipos de Serviço' }).click();
  await expect(page).toHaveURL(/\/admin\/service-types/, { timeout: 20_000 });

  // Manutenção Preventiva (grupo Operações de Campo)
  await sidebar.getByRole('link', { name: 'Manutenção Preventiva' }).click();
  await expect(page).toHaveURL(/\/admin\/maintenance-plans/, { timeout: 20_000 });

  await page.screenshot({ path: 'tests/screenshots/sidebar-nav-final.png' });
});

test('Sem console errors no load do sidebar', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('pageerror', err => errors.push(err.message));

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await page.waitForTimeout(2000);

  const appErrors = errors.filter(e =>
    !e.includes('net::ERR') &&
    !e.includes('favicon') &&
    !e.includes('content_script') &&
    !e.includes('Refused to load') &&
    !e.includes('cannot be a descendant') &&
    !e.includes('cannot contain a nested') &&
    !e.includes('asChild')
  );

  console.log('Console errors:', appErrors);
  expect(appErrors).toHaveLength(0);
});
