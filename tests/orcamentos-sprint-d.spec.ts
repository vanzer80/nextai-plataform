/**
 * Testes E2E — Sprint D: Versioning e Assinatura Eletrônica de Orçamentos
 *
 * Cobre:
 *   - OD-01: Badge de versão aparece ao criar orçamento (v1)
 *   - OD-02: Editar orçamento incrementa versão (v2) e registra histórico
 *   - OD-03: Botão "Coletar assinatura" aparece apenas quando aprovado e não assinado
 *   - OD-04: Fluxo completo de assinatura — canvas + nome → estado assinado
 *   - OD-05: PDF pode ser gerado de orçamento assinado sem erro de console
 *
 * Pré-requisitos:
 *   1. Dev server: npm run dev
 *   2. tests/.env.test preenchido com credenciais reais (TECH + MGR)
 *   3. npx playwright install chromium
 *   4. npx playwright test tests/orcamentos-sprint-d.spec.ts
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const TECH_EMAIL    = process.env.TEST_TECH_EMAIL    ?? '';
const TECH_PASSWORD = process.env.TEST_TECH_PASSWORD ?? '';
const MGR_EMAIL     = process.env.TEST_MGR_EMAIL     ?? '';
const MGR_PASSWORD  = process.env.TEST_MGR_PASSWORD  ?? '';

// ── Helpers ──────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|orcamentos|reports)/, { timeout: 20_000 });
}

async function drawOnCanvas(page: Page) {
  const canvas = page.locator('canvas').first();
  await canvas.waitFor({ timeout: 8_000 });
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 80);
    await page.mouse.move(box.x + 200, box.y + 50);
    await page.mouse.up();
  }
}

/** Cria um orçamento mínimo e retorna o ID extraído da URL de detalhe. */
async function createMinimalOrcamento(page: Page): Promise<string> {
  await page.goto('/orcamentos/novo');
  await page.waitForSelector('text=Novo Orçamento', { timeout: 10_000 });

  // Selecionar cliente (primeiro da lista)
  const clientSelect = page.locator('[role="combobox"]').first();
  await clientSelect.click();
  const firstOption = page.locator('[role="option"]').first();
  await firstOption.waitFor({ timeout: 5_000 });
  await firstOption.click();

  // Preencher item mínimo
  await page.locator('input[placeholder="Descrição do serviço ou produto"]').first().fill('Item de teste Sprint D');

  // Submeter
  await page.getByRole('button', { name: /criar orçamento/i }).click();

  // Aguardar redirect para detalhe
  await page.waitForURL(/\/orcamentos\/[a-f0-9-]+$/, { timeout: 15_000 });

  const url = page.url();
  const id = url.split('/orcamentos/')[1] ?? '';
  return id;
}

/** Navega para o orçamento e aprova via interface do gestor. */
async function approveOrcamento(mgr: Page, orcamentoId: string) {
  await mgr.goto(`/orcamentos/${orcamentoId}`);
  await mgr.waitForSelector('text=v1', { timeout: 10_000 });

  // Técnico precisa enviar primeiro — checar se o botão de envio existe (gestor vê rascunho)
  // No fluxo real o técnico envia e o gestor aprova; aqui simplificamos:
  // Primeiro, enviar como gestor se tiver permissão, ou usar o botão "Aprovar" direto
  const enviarBtn = mgr.getByRole('button', { name: /enviar para aprovação/i });
  if (await enviarBtn.count() > 0) {
    await enviarBtn.click();
    await mgr.waitForTimeout(1_500);
    await mgr.reload();
    await mgr.waitForSelector('text=Enviado', { timeout: 10_000 });
  }

  const aprovarBtn = mgr.getByRole('button', { name: /^aprovar$/i }).first();
  await aprovarBtn.waitFor({ timeout: 8_000 });
  await aprovarBtn.click();

  await expect(mgr.getByText(/aprovado/i).first()).toBeVisible({ timeout: 15_000 });
}

// ── OD-01: Badge v1 após criação ─────────────────────────────────────────────

test('OD-01 — Badge "v1" é exibido ao criar orçamento', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const id = await createMinimalOrcamento(page);

  await page.goto(`/orcamentos/${id}`);
  await page.waitForSelector('text=v1', { timeout: 10_000 });

  await expect(page.getByText('v1')).toBeVisible();
});

// ── OD-02: Editar incrementa versão e registra histórico ─────────────────────

test('OD-02 — Editar orçamento incrementa badge para v2 e exibe histórico', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const id = await createMinimalOrcamento(page);

  // Abrir edição
  await page.goto(`/orcamentos/${id}/editar`);
  await page.waitForSelector('text=Editar Orçamento', { timeout: 10_000 });

  // Mudar título
  const tituloInput = page.locator('input[placeholder*="Manutenção"]');
  await tituloInput.fill('Orçamento editado Sprint D');

  await page.getByRole('button', { name: /salvar alterações/i }).click();
  await page.waitForURL(`/orcamentos/${id}`, { timeout: 15_000 });

  // Deve mostrar v2
  await page.waitForSelector('text=v2', { timeout: 10_000 });
  await expect(page.getByText('v2')).toBeVisible();

  // Histórico de versões deve mostrar v1 ao expandir
  const histBtn = page.getByRole('button', { name: /histórico de versões/i });
  await histBtn.waitFor({ timeout: 5_000 });
  await histBtn.click();

  await expect(page.getByText('v1')).toBeVisible({ timeout: 8_000 });
});

// ── OD-03: Botão de assinatura aparece apenas em "aprovado" e não assinado ───

test('OD-03 — Botão "Coletar assinatura" aparece somente em orçamento aprovado não assinado', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const id = await createMinimalOrcamento(page);

  // Em rascunho — botão NÃO deve aparecer
  await page.goto(`/orcamentos/${id}`);
  await page.waitForSelector('text=v1', { timeout: 10_000 });
  await expect(page.getByRole('button', { name: /coletar assinatura/i })).not.toBeVisible();

  // Gestor aprova
  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await approveOrcamento(mgr, id);
  await ctx2.close();

  // Após aprovação — técnico recarrega e deve ver o botão
  await page.goto(`/orcamentos/${id}`);
  await page.waitForSelector('text=Aprovado', { timeout: 10_000 });
  await expect(page.getByRole('button', { name: /coletar assinatura/i })).toBeVisible({ timeout: 8_000 });
});

// ── OD-04: Fluxo completo de assinatura ──────────────────────────────────────

test('OD-04 — Fluxo de assinatura: coletar → confirmar → exibir estado assinado', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const id = await createMinimalOrcamento(page);

  // Aprovar
  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await approveOrcamento(mgr, id);
  await ctx2.close();

  // Abrir diálogo de assinatura
  await page.goto(`/orcamentos/${id}`);
  await page.waitForSelector('text=Aprovado', { timeout: 10_000 });

  const signBtn = page.getByRole('button', { name: /coletar assinatura/i });
  await signBtn.waitFor({ timeout: 8_000 });
  await signBtn.click();

  // Dialog deve aparecer
  await page.waitForSelector('text=Coletar Assinatura do Cliente', { timeout: 8_000 });

  // Preencher nome do signatário
  await page.locator('input[placeholder="Nome completo"]').fill('João Silva Teste');

  // Assinar no canvas
  await drawOnCanvas(page);

  // Confirmar
  await page.getByRole('button', { name: /confirmar assinatura/i }).click();

  // Toast de sucesso
  await expect(page.getByText(/assinado com sucesso/i)).toBeVisible({ timeout: 15_000 });

  // Estado assinado deve aparecer na página
  await expect(page.getByText(/assinado eletronicamente/i)).toBeVisible({ timeout: 10_000 });
  await expect(page.getByText('João Silva Teste')).toBeVisible();

  // Botão de assinatura deve desaparecer
  await expect(page.getByRole('button', { name: /coletar assinatura/i })).not.toBeVisible();
});

// ── OD-05: PDF de orçamento assinado sem erro ─────────────────────────────────

test('OD-05 — Geração de PDF com assinatura eletrônica não gera erros de console', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const id = await createMinimalOrcamento(page);

  // Aprovar e assinar
  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await approveOrcamento(mgr, id);
  await ctx2.close();

  await page.goto(`/orcamentos/${id}`);
  await page.waitForSelector('text=Aprovado', { timeout: 10_000 });

  const signBtn = page.getByRole('button', { name: /coletar assinatura/i });
  await signBtn.waitFor({ timeout: 8_000 });
  await signBtn.click();
  await page.waitForSelector('text=Coletar Assinatura do Cliente', { timeout: 8_000 });
  await page.locator('input[placeholder="Nome completo"]').fill('Maria Teste PDF');
  await drawOnCanvas(page);
  await page.getByRole('button', { name: /confirmar assinatura/i }).click();
  await expect(page.getByText(/assinado com sucesso/i)).toBeVisible({ timeout: 15_000 });

  // Aguardar estado assinado
  await expect(page.getByText(/assinado eletronicamente/i)).toBeVisible({ timeout: 10_000 });

  // Coletar erros de console antes de gerar PDF
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // Gerar PDF
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByRole('button', { name: /pdf/i }).click(),
  ]);

  expect(download.suggestedFilename()).toMatch(/orcamento.*\.pdf$/i);
  expect(errors.filter(e => e.includes('jsPDF') || e.includes('addImage') || e.includes('gerarPdf'))).toHaveLength(0);
});
