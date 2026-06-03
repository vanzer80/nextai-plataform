/**
 * RH Module — E2E Verification Suite
 *
 * RoleGuard: ['Gestor', 'Admin', 'Master'] — Tecnico é bloqueado e vai para /dashboard
 *
 * Cobre:
 *   RH-01 — Gestor acessa /rh/employees (autorizado)
 *   RH-02 — Tecnico é redirecionado para /dashboard (RBAC)
 *   RH-03 — KPIs do quadro de pessoal são renderizados
 *   RH-04 — Lista de colaboradores carrega via Supabase REST
 *   RH-05 — Botão "Admitir" navega para /rh/employees/new
 *   RH-06 — Formulário de novo colaborador renderiza campos obrigatórios
 *   RH-07 — Gestor acessa /rh/departments sem redirecionamento
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

/** Navega para a rota e aguarda a resposta REST da tabela employees. */
async function gotoEmployees(page: Page) {
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/rest/v1/employees') && r.status() === 200,
    { timeout: 75_000 },
  );
  await page.goto('/rh/employees');
  await responsePromise;
}

// ── Suite: RBAC ───────────────────────────────────────────────────────────────

test.describe('RH — Controle de Acesso (RBAC)', () => {
  test.setTimeout(150_000);

  // ── RH-01 ──────────────────────────────────────────────────────────────────
  test('RH-01 — Gestor acessa /rh/employees sem redirecionamento', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoEmployees(page);

    await expect(page).toHaveURL(/\/rh\/employees/);
    await expect(page.getByRole('heading', { name: 'Colaboradores', exact: true })).toBeVisible();
  });

  // ── RH-02 ──────────────────────────────────────────────────────────────────
  test('RH-02 — Tecnico é redirecionado para /dashboard ao acessar /rh', async ({ page }) => {
    test.skip(!hasTechCreds, 'TEST_TECH_EMAIL não configurado');

    await login(page, TECH.email, TECH.password);
    await page.goto('/rh/employees');

    // RoleGuard redireciona para /dashboard imediatamente
    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/rh'),
      { timeout: 10_000 },
    );
    await expect(page).toHaveURL(/\/dashboard/);
  });

});

// ── Suite: Listagem ───────────────────────────────────────────────────────────

test.describe('RH — Listagem de Colaboradores', () => {
  test.setTimeout(150_000);

  // ── RH-03 ──────────────────────────────────────────────────────────────────
  test('RH-03 — KPIs do quadro de pessoal são renderizados', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoEmployees(page);

    // Os 4 KPI cards do componente
    await expect(page.getByText('Ativos',           { exact: true })).toBeVisible();
    await expect(page.getByText('Em Férias',        { exact: true })).toBeVisible();
    await expect(page.getByText('Afastados',        { exact: true })).toBeVisible();
    await expect(page.getByText('Desligados (mês)', { exact: true })).toBeVisible();
  });

  // ── RH-04 ──────────────────────────────────────────────────────────────────
  test('RH-04 — Resposta REST /employees retorna status 200', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/rest/v1/employees') && r.status() === 200,
      { timeout: 75_000 },
    );
    await page.goto('/rh/employees');
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    // RLS deve retornar array (mesmo que vazio) — nunca 403/401
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  // ── RH-05 ──────────────────────────────────────────────────────────────────
  test('RH-05 — Botão "Admitir" navega para /rh/employees/new', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoEmployees(page);

    await page.getByRole('button', { name: /Admitir/i }).click();

    await expect(page).toHaveURL(/\/rh\/employees\/new/);
  });

  // ── RH-06 ──────────────────────────────────────────────────────────────────
  test('RH-06 — Formulário de admissão renderiza seções e campos obrigatórios', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await page.goto('/rh/employees/new');

    // Heading da página (form usa label sem htmlFor — não usar getByLabel)
    await expect(page.getByRole('heading', { name: 'Admitir Colaborador', exact: true }))
      .toBeVisible({ timeout: 15_000 });

    // Aba "Dados Pessoais" é a ativa por padrão — h2 visível; outras abas estão ocultas
    await expect(page.getByRole('heading', { name: 'Dados Pessoais', exact: true })).toBeVisible();

    // Campo full_name — exact: true evita match com "Nome completo da mãe"
    await expect(page.getByPlaceholder('Nome completo', { exact: true })).toBeVisible();
  });

});

// ── Suite: Departamentos ──────────────────────────────────────────────────────

test.describe('RH — Departamentos', () => {
  test.setTimeout(150_000);

  // ── RH-07 ──────────────────────────────────────────────────────────────────
  test('RH-07 — Gestor acessa /rh/departments e página carrega', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/rest/v1/departments') && r.status() === 200,
      { timeout: 75_000 },
    );
    await page.goto('/rh/departments');
    const response = await responsePromise;

    await expect(page).toHaveURL(/\/rh\/departments/);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

});
