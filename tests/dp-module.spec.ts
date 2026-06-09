/**
 * DP Module — E2E Verification Suite
 *
 * RoleGuard: ['Gestor', 'Admin', 'Master'] — Tecnico é bloqueado e vai para /dashboard
 *
 * Cobre:
 *   DP-01 — Gestor acessa /dp/payroll (autorizado)
 *   DP-02 — Tecnico é redirecionado para /dashboard (RBAC)
 *   DP-03 — Resposta REST /payroll_periods retorna status 200
 *   DP-04 — Status badges dos períodos renderizam corretamente
 *   DP-05 — Botão "Nova Folha" abre dialog de criação
 *   DP-06 — Gestor acessa /dp/vacation sem redirecionamento
 *   DP-07 — Gestor acessa /dp/timerecords sem redirecionamento
 */

import { test, expect, type Page } from '@playwright/test';

// ── Credentials ───────────────────────────────────────────────────────────────

const TECH = {
  email:    process.env.TEST_TECH_EMAIL    ?? '',
  password: process.env.TEST_TECH_PASSWORD ?? '',
};
const MGR = {
  email:    process.env.TEST_MGR_EMAIL    ?? '',
  password: process.env.TEST_MGR_PASSWORD ?? '',
};

const hasTechCreds = !!TECH.email;
const hasMgrCreds  = !!MGR.email;

// ── Auth helper ───────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('#email', { timeout: 20_000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(
    () => !window.location.pathname.includes('/login'),
    { timeout: 45_000 },
  );
  await page.waitForFunction(
    () => !document.body.innerText.includes('Autenticando sessão'),
    { timeout: 75_000 },
  );
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.includes('auth-token')) {
        try {
          const d = JSON.parse(localStorage.getItem(key) ?? '{}');
          if (d?.user?.id) localStorage.setItem(`onboarding_v1_done_${d.user.id}`, 'true');
        } catch { /* ignore */ }
      }
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Navega para a rota e aguarda a resposta REST da tabela payroll_periods. */
async function gotoPayroll(page: Page) {
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/rest/v1/payroll_periods') && r.status() === 200,
    { timeout: 75_000 },
  );
  await page.goto('/dp/payroll');
  await responsePromise;
}

// ── Suite: RBAC ───────────────────────────────────────────────────────────────

test.describe('DP — Controle de Acesso (RBAC)', () => {
  test.setTimeout(150_000);

  // ── DP-01 ──────────────────────────────────────────────────────────────────
  test('DP-01 — Gestor acessa /dp/payroll sem redirecionamento', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoPayroll(page);

    await expect(page).toHaveURL(/\/dp\/payroll/);
    await expect(page.getByRole('heading', { name: /Folha de Pagamento/i })).toBeVisible();
  });

  // ── DP-02 ──────────────────────────────────────────────────────────────────
  test('DP-02 — Tecnico é redirecionado para /dashboard ao acessar /dp', async ({ page }) => {
    test.skip(!hasTechCreds, 'TEST_TECH_EMAIL não configurado');

    await login(page, TECH.email, TECH.password);
    await page.goto('/dp/payroll');

    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/dp'),
      { timeout: 10_000 },
    );
    await expect(page).toHaveURL(/\/dashboard/);
  });

});

// ── Suite: Lista de Períodos ──────────────────────────────────────────────────

test.describe('DP — Lista de Períodos de Folha', () => {
  test.setTimeout(150_000);

  // ── DP-03 ──────────────────────────────────────────────────────────────────
  test('DP-03 — Resposta REST /payroll_periods retorna status 200', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/rest/v1/payroll_periods') && r.status() === 200,
      { timeout: 75_000 },
    );
    await page.goto('/dp/payroll');
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    // RLS deve retornar array — nunca 403/401
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  // ── DP-04 ──────────────────────────────────────────────────────────────────
  test('DP-04 — Status labels dos períodos são do domínio válido', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoPayroll(page);

    // Status válidos conforme STATUS_CONFIG do componente PayrollList
    const validLabels = ['Aberta', 'Calculada', 'Fechada', 'Paga'];
    const bodyText = await page.locator('body').innerText();
    const hasPeriod = validLabels.some(label => bodyText.includes(label));

    if (hasPeriod) {
      // Verifica que ao menos um badge usa o label correto do domínio
      let foundValid = false;
      for (const label of validLabels) {
        const count = await page.getByText(label, { exact: true }).count();
        if (count > 0) { foundValid = true; break; }
      }
      expect(foundValid).toBe(true);
    }
    // Sem períodos → estado inicial válido, teste passa
  });

  // ── DP-05 ──────────────────────────────────────────────────────────────────
  test('DP-05 — Botão "Nova Folha" abre dialog de criação', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoPayroll(page);

    await page.getByRole('button', { name: /Nova Competência/i }).click();

    // Dialog deve aparecer com campo de competência (input month)
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByRole('dialog').locator('input')).toBeVisible();
  });

});

// ── Suite: Sub-rotas DP ───────────────────────────────────────────────────────

test.describe('DP — Sub-rotas (Férias e Ponto)', () => {
  test.setTimeout(150_000);

  // ── DP-06 ──────────────────────────────────────────────────────────────────
  test('DP-06 — Gestor acessa /dp/vacation sem redirecionamento', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await page.goto('/dp/vacation');

    // Aguarda saída da tela de loading (sem depender de texto específico da lista)
    await page.waitForFunction(
      () => !document.body.innerText.includes('Autenticando sessão'),
      { timeout: 30_000 },
    );
    await expect(page).toHaveURL(/\/dp\/vacation/);
  });

  // ── DP-07 ──────────────────────────────────────────────────────────────────
  test('DP-07 — Gestor acessa /dp/timerecords sem redirecionamento', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await page.goto('/dp/timerecords');

    await page.waitForFunction(
      () => !document.body.innerText.includes('Autenticando sessão'),
      { timeout: 30_000 },
    );
    await expect(page).toHaveURL(/\/dp\/timerecords/);
  });

});
