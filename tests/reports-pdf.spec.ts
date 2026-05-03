/**
 * Testes E2E — Exportação de PDF de Relatórios
 *
 * Cobre:
 *   - Botão visível apenas para relatório aprovado
 *   - Botão ausente para outros status
 *   - Download do PDF é iniciado ao clicar
 *   - Funciona com campos opcionais ausentes
 *   - Funciona com assinaturas presentes
 *
 * Pré-requisitos:
 *   1. Dev server: npm run dev
 *   2. tests/.env.test preenchido com credenciais reais
 *   3. npx playwright install chromium
 *   4. npx playwright test tests/reports-pdf.spec.ts
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import * as path from 'path';

const TECH_EMAIL    = process.env.TEST_TECH_EMAIL    ?? '';
const TECH_PASSWORD = process.env.TEST_TECH_PASSWORD ?? '';
const MGR_EMAIL     = process.env.TEST_MGR_EMAIL     ?? '';
const MGR_PASSWORD  = process.env.TEST_MGR_PASSWORD  ?? '';

// ── Helpers ─────────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|reports)/, { timeout: 20_000 });
}

async function drawSignature(page: Page) {
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ timeout: 8_000 });
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 80);
    await page.mouse.up();
  }
}

async function createMinimalReport(page: Page, serviceType = 'Corretiva'): Promise<string> {
  await page.goto('/reports/new');
  await page.waitForSelector('text=Novo Relatório', { timeout: 10_000 });

  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: serviceType }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Problema identificado para teste de PDF.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Procedimento executado conforme protocolo de teste.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();

  await drawSignature(page);
  await page.getByRole('button', { name: /enviar relatório/i }).click();
  await expect(page.getByText(/enviado com sucesso/i)).toBeVisible({ timeout: 25_000 });
  await page.waitForURL('/reports', { timeout: 10_000 });

  const firstLink = page.locator('a[href*="/reports/"]').first();
  await firstLink.waitFor({ timeout: 5_000 });
  const href = await firstLink.getAttribute('href') ?? '';
  return href.split('/reports/')[1] ?? '';
}

async function approveReport(mgr: Page, reportId: string) {
  await mgr.goto(`/reports/${reportId}`);
  await mgr.waitForSelector('text=Identificação', { timeout: 15_000 });

  const approveBtn = mgr.getByRole('button', { name: /aprovar/i }).first();
  await approveBtn.waitFor({ timeout: 8_000 });
  await approveBtn.click();

  const confirmBtn = mgr.getByRole('button', { name: /confirmar|sim/i });
  if (await confirmBtn.count() > 0) await confirmBtn.click();

  await expect(mgr.getByText(/aprovado/i).first()).toBeVisible({ timeout: 15_000 });
}

// ── RP-01: Botão PDF ausente em relatório pending_review ─────────────────────
test('RP-01 — Botão "Exportar PDF" NÃO aparece em relatório pending_review', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page, 'Preventiva');

  await page.goto(`/reports/${reportId}`);
  await page.waitForSelector('text=Identificação', { timeout: 15_000 });

  // Status deve ser pending_review — botão não deve existir
  const pdfBtn = page.getByRole('button', { name: /exportar pdf/i });
  await expect(pdfBtn).not.toBeVisible();
});

// ── RP-02: Botão PDF visível após aprovação ──────────────────────────────────
test('RP-02 — Botão "Exportar PDF" aparece quando status = approved', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  // Técnico cria relatório
  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page, 'Corretiva');

  // Gestor aprova
  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await approveReport(mgr, reportId);
  await ctx2.close();

  // Técnico recarrega o detalhe — deve ver o botão PDF
  await page.goto(`/reports/${reportId}`);
  await page.waitForSelector('text=Identificação', { timeout: 15_000 });

  await expect(page.getByRole('button', { name: /exportar pdf/i })).toBeVisible({ timeout: 10_000 });
});

// ── RP-03: Clique no botão inicia download ──────────────────────────────────
test('RP-03 — Clique em "Exportar PDF" inicia o download', async ({ page, browser }, testInfo) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  // Criar e aprovar
  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page, 'Vistoria');

  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await approveReport(mgr, reportId);
  await ctx2.close();

  // Recarregar como técnico e baixar
  await page.goto(`/reports/${reportId}`);
  await page.waitForSelector('text=Identificação', { timeout: 15_000 });

  const pdfBtn = page.getByRole('button', { name: /exportar pdf/i });
  await expect(pdfBtn).toBeVisible({ timeout: 10_000 });

  // Aguarda evento de download
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    pdfBtn.click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/relatorio.*\.pdf$/i);

  // Salva para inspeção manual se necessário
  await download.saveAs(path.join(testInfo.outputDir, download.suggestedFilename()));
});

// ── RP-04: Gestor também vê o botão PDF ─────────────────────────────────────
test('RP-04 — Gestor/Master também pode exportar PDF de relatório aprovado', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page, 'Instalação');

  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await approveReport(mgr, reportId);

  // Gestor ainda está no detalhe aprovado — deve ver o botão
  await mgr.goto(`/reports/${reportId}`);
  await mgr.waitForSelector('text=Identificação', { timeout: 15_000 });

  await expect(mgr.getByRole('button', { name: /exportar pdf/i })).toBeVisible({ timeout: 10_000 });
  await ctx2.close();
});

// ── RP-05: Botão ausente para status 'returned' ──────────────────────────────
test('RP-05 — Botão PDF ausente em relatório returned', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page, 'Emergência');

  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await mgr.goto(`/reports/${reportId}`);
  await mgr.waitForSelector('text=Identificação', { timeout: 15_000 });

  // Gestor devolve
  const returnBtn = mgr.getByRole('button', { name: /devolver/i }).first();
  await returnBtn.waitFor({ timeout: 8_000 });
  await returnBtn.click();

  const commentField = mgr.locator('textarea').first();
  if (await commentField.count() > 0) {
    await commentField.fill('Ajuste necessário para teste.');
  }
  const confirmBtn = mgr.getByRole('button', { name: /confirmar|devolver|sim/i }).last();
  await confirmBtn.click();

  await expect(mgr.getByText(/devolvido/i).first()).toBeVisible({ timeout: 15_000 });

  // Botão PDF não deve aparecer
  await expect(mgr.getByRole('button', { name: /exportar pdf/i })).not.toBeVisible();
  await ctx2.close();
});

// ── RP-06: PDF gerado com relatório minimalista (campos opcionais ausentes) ──
test('RP-06 — Exportação funciona sem campos opcionais (checklist, peças, notas)', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page, 'Preventiva');

  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await approveReport(mgr, reportId);
  await ctx2.close();

  await page.goto(`/reports/${reportId}`);
  await page.waitForSelector('text=Identificação', { timeout: 15_000 });

  const pdfBtn = page.getByRole('button', { name: /exportar pdf/i });
  await expect(pdfBtn).toBeVisible({ timeout: 10_000 });

  // Não deve lançar erro ao clicar
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Aguarda download sem erro
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    pdfBtn.click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/\.pdf$/i);
  expect(errors.filter(e => e.includes('gerarPdf') || e.includes('jsPDF'))).toHaveLength(0);
});

// ── RP-07: Botão ausente para status 'rejected' ──────────────────────────────
test('RP-07 — Botão PDF ausente em relatório rejected', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page, 'Corretiva');

  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await mgr.goto(`/reports/${reportId}`);
  await mgr.waitForSelector('text=Identificação', { timeout: 15_000 });

  const rejectBtn = mgr.getByRole('button', { name: /reprovar/i }).first();
  await rejectBtn.waitFor({ timeout: 8_000 });
  await rejectBtn.click();

  const commentField = mgr.locator('textarea').first();
  if (await commentField.count() > 0) {
    await commentField.fill('Reprovado para teste automatizado.');
  }
  const confirmBtn = mgr.getByRole('button', { name: /confirmar|reprovar|sim/i }).last();
  await confirmBtn.click();

  await expect(mgr.getByText(/reprovado/i).first()).toBeVisible({ timeout: 15_000 });

  await expect(mgr.getByRole('button', { name: /exportar pdf/i })).not.toBeVisible();
  await ctx2.close();
});
