import { test, expect } from '@playwright/test';
import { loginAs } from './helpers/auth';

const MGR_EMAIL    = process.env.TEST_MGR_EMAIL!;
const MGR_PASS     = process.env.TEST_MGR_PASSWORD!;
const TECH_EMAIL   = process.env.TEST_TECH_EMAIL!;
const TECH_PASS    = process.env.TEST_TECH_PASSWORD!;
const MASTER_EMAIL = process.env.TEST_MASTER_MOPAR_EMAIL!;
const MASTER_PASS  = process.env.TEST_MASTER_MOPAR_PASSWORD!;

// ─── Gestor: dashboard carrega ───────────────────────────────────────────────
test('Gestor — dashboard carrega KPI cards, período e botão Personalizar', async ({ page }) => {
  await loginAs(page, MGR_EMAIL, MGR_PASS);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 20000 });

  // Saudação
  await expect(page.locator('h1').first()).toBeVisible({ timeout: 30000 });

  // Seletor de período visível
  await expect(page.getByRole('button', { name: '30 dias' }).first()).toBeVisible();

  // Botão Personalizar
  await expect(page.getByRole('button', { name: /personalizar/i })).toBeVisible();

  // KPI grid com pelo menos 1 card
  const kpiGrid = page.locator('[data-onboarding="dashboard-kpis"]');
  await expect(kpiGrid).toBeVisible({ timeout: 15000 });
  await expect(kpiGrid.locator('> *').first()).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/dashboard-gestor.png', fullPage: true });
});

// ─── Personalizar: modal, validação, cancelar ─────────────────────────────────
test('Personalizar — modal abre, validação mínimo 1, cancelar fecha', async ({ page }) => {
  await loginAs(page, MGR_EMAIL, MGR_PASS);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 20000 });

  // KPI grid carregado antes de interagir
  await expect(page.locator('[data-onboarding="dashboard-kpis"]')).toBeVisible({ timeout: 20000 });

  await page.getByRole('button', { name: /personalizar/i }).click();

  // Modal do customizer
  const dialog = page.getByRole('dialog', { name: /personalizar dashboard/i });
  await expect(dialog).toBeVisible({ timeout: 10000 });

  // Widgets do Gestor presentes (exact:true evita partial match em descrições)
  await expect(dialog.getByText('OS Pendentes', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Orçamentos (CPQ)', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Agenda & Dispatch', { exact: true })).toBeVisible();
  await expect(dialog.getByText('Gestão de Pessoas & Financeiro', { exact: true })).toBeVisible();

  // Salvar habilitado por padrão
  const saveBtn = dialog.getByRole('button', { name: /salvar/i });
  await expect(saveBtn).toBeEnabled();

  // Desativa todos os switches (Base-UI usa data-checked, não data-state)
  const switches = dialog.locator('[role="switch"]');
  const total = await switches.count();
  for (let i = 0; i < total; i++) {
    const sw = switches.nth(i);
    const isChecked = await sw.evaluate(el => el.hasAttribute('data-checked'));
    if (isChecked) await sw.click();
  }

  // Com 0 ativos: Salvar desabilitado
  await expect(saveBtn).toBeDisabled();

  // Reativa um
  await switches.first().click();
  await expect(saveBtn).toBeEnabled();

  // Cancelar fecha o modal
  await dialog.getByRole('button', { name: /cancelar/i }).click();
  await expect(dialog).not.toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/dashboard-customizer.png', fullPage: true });
});

// ─── Seletor de período ───────────────────────────────────────────────────────
test('Seletor de período — troca entre 4 períodos sem crash', async ({ page }) => {
  await loginAs(page, MGR_EMAIL, MGR_PASS);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 20000 });

  await expect(page.locator('[data-onboarding="dashboard-kpis"]')).toBeVisible({ timeout: 20000 });

  for (const label of ['90 dias', '12 meses', '7 dias', '30 dias']) {
    await page.getByRole('button', { name: label }).first().click();
    await page.waitForTimeout(800);
    await expect(page.locator('[data-onboarding="dashboard-kpis"]')).toBeVisible();
  }

  await page.screenshot({ path: 'tests/screenshots/dashboard-period.png', fullPage: true });
});

// ─── RBAC: Técnico não vê hr-summary ─────────────────────────────────────────
test('Técnico — dashboard carrega; não vê Gestão de Pessoas & Financeiro', async ({ page }) => {
  await loginAs(page, TECH_EMAIL, TECH_PASS);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 20000 });

  await expect(page.locator('[data-onboarding="dashboard-kpis"]')).toBeVisible({ timeout: 20000 });

  // HrSummary ausente para Técnico
  await expect(page.getByText('Gestão de Pessoas & Financeiro')).not.toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/dashboard-tecnico.png', fullPage: true });
});

// ─── Master: HrSummary visível e no customizer ────────────────────────────────
test('Master — HrSummaryWidget visível por padrão e aparece no customizer', async ({ page }) => {
  await loginAs(page, MASTER_EMAIL, MASTER_PASS);
  await page.goto('/');
  await page.waitForLoadState('networkidle', { timeout: 20000 });

  // HrSummary visível por padrão para Master
  await expect(page.getByText('Gestão de Pessoas & Financeiro').first()).toBeVisible({ timeout: 25000 });

  // Abre customizer — HR Summary deve constar
  await page.getByRole('button', { name: /personalizar/i }).click();
  const dialog = page.getByRole('dialog', { name: /personalizar dashboard/i });
  await expect(dialog).toBeVisible({ timeout: 10000 });
  await expect(dialog.getByText('Gestão de Pessoas & Financeiro')).toBeVisible();

  await page.screenshot({ path: 'tests/screenshots/dashboard-master.png', fullPage: true });
});
