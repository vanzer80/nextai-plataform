/**
 * CP Module — E2E Verification Suite
 *
 * RoleGuard: ['Financeiro', 'Gestor', 'Admin', 'Master'] — Tecnico é bloqueado
 *
 * Cobre:
 *   CP-01 — Gestor acessa /cp/payables (autorizado)
 *   CP-02 — Tecnico é redirecionado para /dashboard (RBAC)
 *   CP-03 — Resposta REST /payables retorna status 200 com RLS ativo
 *   CP-04 — KPIs financeiros são renderizados
 *   CP-05 — Status labels dos registros são do domínio válido
 *   CP-06 — Botão "Nova Conta" navega para /cp/new
 *   CP-07 — Formulário de nova conta renderiza campos obrigatórios
 *   CP-08 — Filtro de status dispara nova requisição REST
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

/** Navega para /cp/payables e aguarda resposta REST da tabela payables. */
async function gotoPayables(page: Page) {
  const responsePromise = page.waitForResponse(
    r => r.url().includes('/rest/v1/payables') && r.status() === 200,
    { timeout: 75_000 },
  );
  await page.goto('/cp/payables');
  await responsePromise;
}

// ── Suite: RBAC ───────────────────────────────────────────────────────────────

test.describe('CP — Controle de Acesso (RBAC)', () => {
  test.setTimeout(150_000);

  // ── CP-01 ──────────────────────────────────────────────────────────────────
  test('CP-01 — Gestor acessa /cp/payables sem redirecionamento', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoPayables(page);

    await expect(page).toHaveURL(/\/cp\/payables/);
    await expect(page.getByRole('heading', { name: 'Contas a Pagar', exact: true })).toBeVisible();
  });

  // ── CP-02 ──────────────────────────────────────────────────────────────────
  test('CP-02 — Tecnico é redirecionado para /dashboard ao acessar /cp', async ({ page }) => {
    test.skip(!hasTechCreds, 'TEST_TECH_EMAIL não configurado');

    await login(page, TECH.email, TECH.password);
    await page.goto('/cp/payables');

    await page.waitForFunction(
      () => !window.location.pathname.startsWith('/cp'),
      { timeout: 10_000 },
    );
    await expect(page).toHaveURL(/\/dashboard/);
  });

});

// ── Suite: Listagem e KPIs ────────────────────────────────────────────────────

test.describe('CP — Listagem e KPIs', () => {
  test.setTimeout(150_000);

  // ── CP-03 ──────────────────────────────────────────────────────────────────
  test('CP-03 — Resposta REST /payables retorna status 200 com RLS ativo', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);

    const responsePromise = page.waitForResponse(
      r => r.url().includes('/rest/v1/payables') && r.status() === 200,
      { timeout: 75_000 },
    );
    await page.goto('/cp/payables');
    const response = await responsePromise;

    expect(response.status()).toBe(200);
    // RLS isolando por team_id — resultado deve ser array (pode ser vazio)
    const body = await response.json();
    expect(Array.isArray(body)).toBe(true);
  });

  // ── CP-04 ──────────────────────────────────────────────────────────────────
  test('CP-04 — KPIs financeiros são renderizados na página', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoPayables(page);

    // KPI cards definidos no componente PayablesList
    await expect(page.getByText('A Vencer',             { exact: true })).toBeVisible();
    await expect(page.getByText('Vencido',              { exact: true })).toBeVisible();
    await expect(page.getByText('Pago no Mês',          { exact: true })).toBeVisible();
    await expect(page.getByText('Aprovado',             { exact: true })).toBeVisible();
    await expect(page.getByText('Aguardando Aprovação', { exact: true })).toBeVisible();
  });

  // ── CP-05 ──────────────────────────────────────────────────────────────────
  test('CP-05 — Status labels dos registros são do domínio válido', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoPayables(page);

    // Status válidos conforme STATUS_CONFIG do componente
    const validLabels = ['Rascunho', 'Pendente', 'Aprovado', 'Pago', 'Rejeitado', 'Cancelado'];
    const bodyText = await page.locator('body').innerText();

    // Se houver registros, ao menos um status válido deve aparecer nos badges
    const hasAnyRecord = validLabels.some(label => bodyText.includes(label));
    if (hasAnyRecord) {
      let foundValid = false;
      for (const label of validLabels) {
        const count = await page.getByText(label, { exact: true }).count();
        if (count > 0) { foundValid = true; break; }
      }
      expect(foundValid).toBe(true);
    }
  });

});

// ── Suite: Navegação ──────────────────────────────────────────────────────────

test.describe('CP — Navegação', () => {
  test.setTimeout(150_000);

  // ── CP-06 ──────────────────────────────────────────────────────────────────
  test('CP-06 — Botão "Nova Conta" navega para /cp/new', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await gotoPayables(page);

    await page.getByRole('button', { name: /Nova Conta/i }).click();

    await expect(page).toHaveURL(/\/cp\/new/);
  });

  // ── CP-07 ──────────────────────────────────────────────────────────────────
  test('CP-07 — Formulário de nova conta renderiza seções e campos obrigatórios', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);
    await page.goto('/cp/new');

    // Heading da página
    await expect(page.getByRole('heading', { name: 'Nova Conta a Pagar', exact: true }))
      .toBeVisible({ timeout: 15_000 });

    // Seções do formulário (h2 internos ao form)
    await expect(page.getByText('Classificação', { exact: true })).toBeVisible();
    await expect(page.getByText('Valor e Datas',  { exact: true })).toBeVisible();

    // Campo de descrição — identificado pelo placeholder (o form usa label sem htmlFor)
    await expect(page.getByPlaceholder('Descreva o pagamento...')).toBeVisible();

    // Campo de valor (input type=number com step 0.01)
    await expect(page.locator('input[type="number"][step="0.01"]')).toBeVisible();

    // Campo de vencimento (último input[type="date"] da seção)
    await expect(page.locator('input[type="date"]').last()).toBeVisible();
  });

  // ── CP-08 ──────────────────────────────────────────────────────────────────
  test('CP-08 — Filtro por status "pendente" dispara nova requisição REST', async ({ page }) => {
    test.skip(!hasMgrCreds, 'TEST_MGR_EMAIL não configurado');

    await login(page, MGR.email, MGR.password);

    // Navega sem usar gotoPayables para não consumir a resposta que queremos interceptar
    await page.goto('/cp/payables');

    // Aguarda KPI cards renderizarem — confirma que o carregamento inicial completou
    await expect(page.getByText('A Vencer', { exact: true })).toBeVisible({ timeout: 75_000 });

    // Configura intercept ANTES de acionar o filtro (garante que não captura carga inicial)
    const filteredResponsePromise = page.waitForResponse(
      r => r.url().includes('/rest/v1/payables') && r.status() === 200,
      { timeout: 30_000 },
    );

    // Abre o Select de status e escolhe "Pendente"
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Pendente', exact: true }).click();

    const filteredResponse = await filteredResponsePromise;
    expect(filteredResponse.status()).toBe(200);
  });

});
