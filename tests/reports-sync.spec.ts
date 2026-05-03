/**
 * Testes E2E — Fluxo de criação e sync de relatórios
 *
 * Reproduz e verifica o bug: signature_type cast + fallback offline enganoso
 *
 * Pré-requisitos:
 *   1. Dev server rodando: npm run dev
 *   2. tests/.env.test preenchido com credenciais válidas
 *   3. npx playwright install chromium
 *   4. npx playwright test tests/reports-sync.spec.ts
 */

import { test, expect, type Page } from '@playwright/test';

const TECH_EMAIL    = process.env.TEST_TECH_EMAIL    ?? '';
const TECH_PASSWORD = process.env.TEST_TECH_PASSWORD ?? '';
const MGR_EMAIL     = process.env.TEST_MGR_EMAIL     ?? '';
const MGR_PASSWORD  = process.env.TEST_MGR_PASSWORD  ?? '';

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|reports)/, { timeout: 15_000 });
}

async function drawSignature(page: Page) {
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ timeout: 5_000 });
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 80);
    await page.mouse.move(box.x + 100, box.y + 120);
    await page.mouse.up();
  }
}

async function fillMinimalReport(page: Page, serviceType = 'Corretiva') {
  await page.goto('/reports/new');
  await page.waitForSelector('text=Novo Relatório', { timeout: 10_000 });

  // Step 1
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: serviceType }).click();
  await page.getByRole('button', { name: /próximo/i }).click();

  // Steps 2 e 3 — opcionais
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 4 — problema relatado (obrigatório)
  await page.locator('textarea').first().fill('Motor não responde ao acionamento.');
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 5 — serviços executados (obrigatório)
  await page.locator('textarea').first().fill('Substituição do módulo de ignição.');
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 6 — evidências (sem upload)
  await page.getByRole('button', { name: /próximo/i }).click();

  // Step 7 — assinatura
  await drawSignature(page);
}

// ── RS-01: Técnico cria relatório → chega ao banco (não vai para offline) ──────
test('RS-01 — Relatório criado chega ao banco (toast sucesso, não "salvo offline")', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await fillMinimalReport(page);

  await page.getByRole('button', { name: /enviar relatório/i }).click();

  // Deve aparecer toast de SUCESSO, não "salvo localmente"
  await expect(page.getByText(/enviado com sucesso/i)).toBeVisible({ timeout: 20_000 });

  // NÃO deve aparecer toast de "salvo localmente" (indica que foi para o banco)
  await expect(page.getByText(/salvo localmente/i)).not.toBeVisible();
  await expect(page.getByText(/sem conexão/i)).not.toBeVisible();

  // Redireciona para /reports
  await page.waitForURL('/reports', { timeout: 10_000 });
});

// ── RS-02: Relatório aparece na lista do técnico após envio ────────────────────
test('RS-02 — Relatório aparece na lista do técnico imediatamente após envio', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await fillMinimalReport(page, 'Preventiva');

  await page.getByRole('button', { name: /enviar relatório/i }).click();
  await expect(page.getByText(/enviado com sucesso/i)).toBeVisible({ timeout: 20_000 });
  await page.waitForURL('/reports', { timeout: 10_000 });

  // Lista deve ter pelo menos um relatório (status "Aguardando Revisão")
  await expect(page.getByText(/aguardando revis/i).first()).toBeVisible({ timeout: 10_000 });

  // Badge de "aguardando sync" não deve estar presente (relatório chegou ao banco)
  await expect(page.getByText(/aguardando sync/i)).not.toBeVisible();
});

// ── RS-03: Gestor/Master vê relatório criado pelo técnico ─────────────────────
test('RS-03 — Gestor vê relatório criado pelo técnico', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  // Técnico cria relatório
  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await fillMinimalReport(page, 'Vistoria');
  await page.getByRole('button', { name: /enviar relatório/i }).click();
  await expect(page.getByText(/enviado com sucesso/i)).toBeVisible({ timeout: 20_000 });
  await page.waitForURL('/reports', { timeout: 10_000 });

  // Gestor abre a lista em contexto separado
  const ctx2 = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await mgr.goto('/reports');

  // Gestor deve ver pelo menos um relatório
  await expect(mgr.locator('[data-report-card], .report-card, a[href*="/reports/"]').first()).toBeVisible({ timeout: 10_000 });

  // O relatório não deve estar em estado de erro/offline
  await expect(mgr.getByText(/erro ao sincronizar/i)).not.toBeVisible();

  await ctx2.close();
});

// ── RS-04: Assinatura do técnico não quebra o envio ───────────────────────────
test('RS-04 — Assinatura do técnico é incluída sem quebrar a RPC', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await fillMinimalReport(page, 'Instalação');

  // Verificar que o Step 7 está visível e a assinatura foi desenhada
  await expect(page.locator('canvas').first()).toBeVisible();

  await page.getByRole('button', { name: /enviar relatório/i }).click();

  // Sucesso confirma que o cast ::signature_type funcionou
  await expect(page.getByText(/enviado com sucesso/i)).toBeVisible({ timeout: 20_000 });
});

// ── RS-05: Falha real de rede → mostra "salvo offline" corretamente ────────────
test('RS-05 — Offline real → feedback "salvo localmente" e badge âmbar na lista', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await page.goto('/reports/new');
  await page.waitForSelector('text=Novo Relatório', { timeout: 10_000 });

  // Step 1
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Emergência' }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Falha crítica de equipamento.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Protocolo emergencial acionado.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await drawSignature(page);

  // Simular offline antes de enviar
  await page.context().setOffline(true);

  await page.getByRole('button', { name: /enviar relatório/i }).click();

  // Deve mostrar mensagem de "salvo localmente"
  await expect(page.getByText(/salvo localmente/i)).toBeVisible({ timeout: 15_000 });

  // Restaurar online
  await page.context().setOffline(false);

  await page.waitForURL('/reports', { timeout: 10_000 });

  // Badge âmbar de pendente deve aparecer
  await expect(
    page.locator('.text-amber-700, .text-amber-300').filter({ hasText: /aguardando sync|relatório/i }).first()
  ).toBeVisible({ timeout: 5_000 });
});

// ── RS-06: Sync offline processa fila ao reconectar ───────────────────────────
test('RS-06 — Itens salvos offline são sincronizados ao reconectar', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await page.goto('/reports/new');
  await page.waitForSelector('text=Novo Relatório', { timeout: 10_000 });

  // Criar relatório offline
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Corretiva' }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Problema elétrico identificado em campo.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Circuito reparado e testado.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await drawSignature(page);

  await page.context().setOffline(true);
  await page.getByRole('button', { name: /enviar relatório/i }).click();
  await expect(page.getByText(/salvo localmente/i)).toBeVisible({ timeout: 10_000 });
  await page.waitForURL('/reports', { timeout: 10_000 });

  // Voltar online — sync deve ocorrer automaticamente
  await page.context().setOffline(false);

  // Aguardar o sync acontecer (até 30s — inclui o debounce de 5s do useOfflineSync)
  await expect(
    page.locator('.text-emerald-700, .text-emerald-300').filter({ hasText: /online/i }).first()
  ).toBeVisible({ timeout: 10_000 });

  // Badge de pendente deve desaparecer após sync bem-sucedido
  await expect(
    page.getByText(/aguardando sync/i)
  ).not.toBeVisible({ timeout: 35_000 });
});
