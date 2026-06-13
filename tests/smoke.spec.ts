/**
 * Smoke tests — NextAI
 *
 * Pré-requisitos:
 *   1. Dev server rodando: npm run dev
 *   2. Copiar tests/.env.test.example → tests/.env.test e preencher credenciais
 *   3. Instalar browser: npx playwright install chromium
 *   4. Rodar: npx playwright test
 */

import { test, expect, type Page } from '@playwright/test';

// ── Credenciais de teste (via env) ─────────────────────────────────────────────
const TECH_EMAIL    = process.env.TEST_TECH_EMAIL    ?? '';
const TECH_PASSWORD = process.env.TEST_TECH_PASSWORD ?? '';
const TECH2_EMAIL   = process.env.TEST_TECH2_EMAIL   ?? '';
const TECH2_PASSWORD = process.env.TEST_TECH2_PASSWORD ?? '';
const MGR_EMAIL     = process.env.TEST_MGR_EMAIL     ?? '';
const MGR_PASSWORD  = process.env.TEST_MGR_PASSWORD  ?? '';

// ── Helper: login ──────────────────────────────────────────────────────────────
async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|reports)/, { timeout: 15_000 });

  // Suppress onboarding modal so it doesn't block test interactions
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      if (key.includes('auth-token')) {
        try {
          const data = JSON.parse(localStorage.getItem(key) ?? '{}');
          const userId = data?.user?.id;
          if (userId) {
            localStorage.setItem(`onboarding_v1_done_${userId}`, 'true');
          }
        } catch { /* ignore */ }
      }
    }
  });
}

// ── Helper: logout ─────────────────────────────────────────────────────────────
async function logout(page: Page) {
  // Tentar botão de logout via aria-label ou texto
  const logoutBtn = page.getByRole('button', { name: /sair|logout/i });
  if (await logoutBtn.count() > 0) {
    await logoutBtn.click();
  } else {
    await page.goto('/');
  }
  await page.waitForURL('/', { timeout: 5_000 }).catch(() => {});
}

// ── Smoke 1: Técnico cria relatório e ele aparece no banco ─────────────────────
test('S1 — Técnico cria relatório (7 steps) → aparece na lista', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await page.goto('/reports/new');

  // Step 1 — Identificação
  await page.waitForSelector('text=Nova OS', { timeout: 10_000 });
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Corretiva' }).click();
  // service_date já vem preenchido com hoje
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 2 — Ativo e Contexto (opcional, avançar)
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 3 — Checklist (pode estar vazio, avançar)
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 4 — Diagnóstico (campo obrigatório)
  await page.fill('textarea[placeholder*="problema"]', 'Motor não liga ao acionar a partida.');
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 5 — Execução (campo obrigatório)
  await page.fill('textarea[placeholder*="procedimentos"]', 'Substituição do relé de partida e limpeza dos contatos elétricos.');
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 6 — Evidências (sem upload, avançar)
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 7 — Assinatura
  // Assinar no canvas do técnico
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ timeout: 5_000 });
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 50, box.y + 50);
    await page.mouse.down();
    await page.mouse.move(box.x + 150, box.y + 80);
    await page.mouse.up();
  }

  const sendBtn = page.getByRole('button', { name: /enviar relatório|enviar os/i });
  await sendBtn.waitFor({ state: 'visible', timeout: 5_000 });
  await sendBtn.click();

  // Aguardar toast de sucesso e redirect para /reports
  await expect(page.getByText(/enviada com sucesso/i)).toBeVisible({ timeout: 20_000 });
  await page.waitForURL('/reports', { timeout: 10_000 });

  // Confirmar que o relatório aparece na lista
  await expect(page.getByText(/corretiva/i).first()).toBeVisible({ timeout: 10_000 });
});

// ── Smoke 2: Gestor aprova relatório → status muda ────────────────────────────
test('S2 — Gestor aprova relatório → status muda para Aprovado', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await page.goto('/reports');

  // Clicar no "Detalhes" do primeiro relatório
  const firstDetailLink = page.getByRole('link', { name: 'Detalhes' }).first();
  await firstDetailLink.waitFor({ timeout: 25_000 });
  await firstDetailLink.click();

  // Aguardar a tela de detalhe
  await page.waitForURL(/\/reports\/.+/, { timeout: 10_000 });

  // Painel de aprovação
  const approveBtn = page.getByRole('button', { name: /aprovar/i }).first();
  await approveBtn.waitFor({ timeout: 5_000 });
  await approveBtn.click();

  // Confirmar no dialog/modal se existir
  const confirmBtn = page.getByRole('button', { name: /confirmar|sim/i });
  if (await confirmBtn.count() > 0) await confirmBtn.click();

  // Status deve mudar
  await expect(page.getByText(/aprovado/i).first()).toBeVisible({ timeout: 15_000 });
});

// ── Smoke 3: Reembolso criado não fica em status 'Revisao' sem acento ─────────
test('S3 — Reembolso criado tem status PT correto (sem enum duplicado)', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await page.goto('/reimbursements/new');

  // Se estiver na tela de seleção inicial, clica em "Preencher manualmente"
  const manualBtn = page.getByRole('button', { name: /preencher manualmente/i });
  await manualBtn.waitFor({ state: 'visible', timeout: 10_000 });
  await manualBtn.click();

  // Selecionar categoria (obrigatória no novo form)
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Alimentação' }).click();

  // Preencher campos mínimos do formulário de reembolso
  const amountInput = page.locator('input[placeholder*="valor"], input[type="number"]').first();
  await amountInput.waitFor({ state: 'visible', timeout: 10_000 });
  if (await amountInput.count() > 0) await amountInput.fill('50.00');

  const descInput = page.locator('textarea, input[placeholder*="descri"]').first();
  if (await descInput.count() > 0) await descInput.fill('Almoço de campo');

  await page.getByRole('button', { name: /salvar|enviar|criar|solicitar/i }).first().click();

  await expect(page.getByText(/pendente/i).first()).toBeVisible({ timeout: 15_000 });

  // Confirmar que NÃO existe nenhum texto "Revisao" (sem acento) na UI
  const revisaoSemAcento = page.getByText('Revisao');
  await expect(revisaoSemAcento).toHaveCount(0);
});

// ── Smoke 4: RLS — Técnico A não acessa relatório de Técnico B via URL ────────
test('S4 — RLS isolation: Técnico B não vê relatório do Técnico A', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !TECH2_EMAIL, 'TEST_TECH_EMAIL ou TEST_TECH2_EMAIL não configurados');

  // Tech A cria relatório e captura o ID
  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await page.goto('/reports');

  // Pegar o ID do primeiro relatório do Tech A
  const firstLink = page.getByRole('link', { name: 'Detalhes' }).first();
  await firstLink.waitFor({ timeout: 25_000 });
  const href = await firstLink.getAttribute('href') ?? '';
  const reportId = href.split('/reports/')[1];
  expect(reportId).toBeTruthy();

  // Logar como Tech B em contexto isolado
  const context2 = await browser.newContext();
  const page2 = await context2.newPage();
  await login(page2, TECH2_EMAIL, TECH2_PASSWORD);

  // Tentar acessar diretamente o relatório do Tech A
  await page2.goto(`/reports/${reportId}`);

  // Deve ser redirecionado ou mostrar erro — NÃO deve mostrar conteúdo do relatório
  const content = await page2.content();
  const hasReportContent = content.includes('Diagnóstico') || content.includes('Execução');
  expect(hasReportContent, 'Tech B não deve ver relatório do Tech A').toBe(false);

  await context2.close();
});
