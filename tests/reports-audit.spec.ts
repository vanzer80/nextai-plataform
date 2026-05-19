/**
 * Testes de auditoria — Módulo de Relatórios
 *
 * Cobre os bugs identificados na auditoria de 2026-05-03:
 *   - PGRST201 (embed ambíguo users ↔ service_reports)
 *   - Auth timeout com role fallback indevido
 *   - Listagem para técnico e gestor/master
 *   - Detalhe do relatório sem erro de relacionamento
 *   - Submit → banco (não cai no fallback offline)
 *   - Sync offline → reconexão
 *
 * Pré-requisitos:
 *   1. Dev server: npm run dev
 *   2. tests/.env.test preenchido com credenciais reais
 *   3. npx playwright install chromium
 *   4. npx playwright test tests/reports-audit.spec.ts
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

const TECH_EMAIL    = process.env.TEST_TECH_EMAIL    ?? '';
const TECH_PASSWORD = process.env.TEST_TECH_PASSWORD ?? '';
const MGR_EMAIL     = process.env.TEST_MGR_EMAIL     ?? '';
const MGR_PASSWORD  = process.env.TEST_MGR_PASSWORD  ?? '';

// ── Helpers ────────────────────────────────────────────────────────────────────

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
  await page.waitForSelector('text=Nova OS', { timeout: 10_000 });

  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: serviceType }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();

  await page.locator('textarea').first().fill('Problema identificado em auditoria automatizada.');
  await page.getByRole('button', { name: /próximo/i }).click();

  await page.locator('textarea').first().fill('Procedimento executado conforme protocolo.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();

  await drawSignature(page);
  await page.getByRole('button', { name: /enviar relatório/i }).click();
  await expect(page.getByText(/enviado com sucesso/i)).toBeVisible({ timeout: 25_000 });
  await page.waitForURL('/reports', { timeout: 10_000 });

  // Captura o ID do relatório mais recente via URL do primeiro card
  const firstLink = page.locator('a[href*="/reports/"]').first();
  await firstLink.waitFor({ timeout: 5_000 });
  const href = await firstLink.getAttribute('href') ?? '';
  return href.split('/reports/')[1] ?? '';
}

// ── RA-01: Auth resolve para role correto sem fallback permanente ───────────────
test('RA-01 — Auth carrega role correto (sem ficar preso em fallback Tecnico)', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);

  // Aguardar que a UI reflita o role correto (Gestor/Master tem acesso a /clients)
  // Se ficar preso como Tecnico, /clients seria bloqueado pelo RoleGuard
  await page.goto('/reports');
  await page.waitForSelector('text=Ordens de Serviço', { timeout: 10_000 });

  // Master deve ver todos os relatórios (sem filtro por técnico)
  // O texto de empty state de Master é diferente do de Tecnico
  const content = await page.content();
  // Não deve mostrar "Crie seu primeiro relatório" (mensagem do Tecnico) se houver relatórios
  // (só verifica se não está preso em fallback de role errado)
  expect(content).not.toContain('Aguarde que sua equipe envie relatórios');
});

// ── RA-02: PGRST201 não ocorre ao abrir detalhe de relatório ──────────────────
test('RA-02 — Detalhe do relatório abre sem erro PGRST201', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);

  // Criar relatório para garantir que existe um
  const reportId = await createMinimalReport(page);
  expect(reportId).toBeTruthy();

  // Navegar ao detalhe
  await page.goto(`/reports/${reportId}`);

  // Deve carregar sem mostrar erro
  await expect(page.getByText(/relatório não encontrado/i)).not.toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/erro ao carregar/i)).not.toBeVisible();

  // Deve mostrar conteúdo do relatório
  await expect(page.getByText(/identificação/i).first()).toBeVisible({ timeout: 10_000 });

  // Console não deve ter PGRST201
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error' && msg.text().includes('PGRST201')) {
      errors.push(msg.text());
    }
  });
  // Reload para capturar erros de console no carregamento inicial
  await page.reload();
  await page.waitForSelector('text=Identificação', { timeout: 10_000 });
  expect(errors).toHaveLength(0);
});

// ── RA-03: FK users↔service_reports — embed correto (não ambíguo) ──────────────
test('RA-03 — Nome do técnico aparece no detalhe (FK technician_id desambiguada)', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page);

  await page.goto(`/reports/${reportId}`);
  await page.waitForSelector('text=Identificação', { timeout: 15_000 });

  // O campo "Técnico" deve existir no card de Identificação
  // (só aparece se users:technician_id(full_name) resolveu corretamente)
  const techField = page.getByText(/técnico/i).first();
  await expect(techField).toBeVisible({ timeout: 5_000 });
});

// ── RA-04: Listagem para técnico — só vê os próprios ─────────────────────────
test('RA-04 — Técnico vê lista de relatórios (RLS SELECT correto)', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await createMinimalReport(page);

  await page.goto('/reports');
  await page.waitForSelector('text=Ordens de Serviço', { timeout: 10_000 });

  // Deve haver pelo menos um relatório na lista
  const cards = page.locator('a[href*="/reports/"]');
  await expect(cards.first()).toBeVisible({ timeout: 10_000 });

  // Não deve mostrar erro de cache
  await expect(page.getByText(/exibindo dados em cache/i)).not.toBeVisible();
});

// ── RA-05: Listagem para gestor — vê todos os relatórios ─────────────────────
test('RA-05 — Gestor/Master vê relatórios de outros técnicos na lista', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  // Técnico cria relatório
  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await createMinimalReport(page);

  // Gestor verifica a lista
  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await mgr.goto('/reports');
  await mgr.waitForSelector('text=Ordens de Serviço', { timeout: 10_000 });

  const cards = mgr.locator('a[href*="/reports/"]');
  await expect(cards.first()).toBeVisible({ timeout: 10_000 });

  await ctx2.close();
});

// ── RA-06: Aprovação — gestor aprova → status muda ───────────────────────────
test('RA-06 — Gestor aprova relatório pending_review → status approved', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL || !MGR_EMAIL, 'Credenciais de técnico e gestor necessárias');

  // Técnico cria relatório
  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page);

  // Gestor aprova
  const ctx2: BrowserContext = await browser.newContext();
  const mgr = await ctx2.newPage();
  await login(mgr, MGR_EMAIL, MGR_PASSWORD);
  await mgr.goto(`/reports/${reportId}`);
  await mgr.waitForSelector('text=Identificação', { timeout: 15_000 });

  const approveBtn = mgr.getByRole('button', { name: /aprovar/i }).first();
  await approveBtn.waitFor({ timeout: 8_000 });
  await approveBtn.click();

  const confirmBtn = mgr.getByRole('button', { name: /confirmar|sim/i });
  if (await confirmBtn.count() > 0) await confirmBtn.click();

  await expect(mgr.getByText(/aprovado/i).first()).toBeVisible({ timeout: 15_000 });
  await ctx2.close();
});

// ── RA-07: Submit → banco, não fallback offline ──────────────────────────────
test('RA-07 — Relatório criado online vai para o banco (não para IndexedDB)', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);

  // Monitorar console para detectar fallback indevido
  const offlineFallbacks: string[] = [];
  page.on('console', msg => {
    const text = msg.text();
    if (text.includes('submit error') || text.includes('salvo localmente') || text.includes('Sem conexão')) {
      offlineFallbacks.push(text);
    }
  });

  await createMinimalReport(page, 'Preventiva');

  // Nenhuma mensagem de fallback offline deve ter aparecido
  expect(offlineFallbacks).toHaveLength(0);

  // Badge de pendente não deve existir
  await expect(page.getByText(/aguardando sync/i)).not.toBeVisible();
});

// ── RA-08: Relatório inválido → erro claro, não fallback offline ──────────────
test('RA-08 — Tentativa de submit sem assinatura → erro claro (não vai para offline)', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await page.goto('/reports/new');
  await page.waitForSelector('text=Nova OS', { timeout: 10_000 });

  // Preencher até step 7 sem assinar
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Corretiva' }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Teste de validação.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Execução de teste.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();

  // Tentar enviar SEM assinar
  await page.getByRole('button', { name: /enviar relatório/i }).click();

  // Deve mostrar erro de validação, NÃO toast de "salvo localmente"
  await expect(
    page.getByText(/assinatura do técnico obrigatória/i)
  ).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(/salvo localmente/i)).not.toBeVisible();
});

// ── RA-09: Offline real → badge âmbar → sync ao reconectar ───────────────────
test('RA-09 — Offline → salvo localmente → sincronizado ao reconectar', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await page.goto('/reports/new');
  await page.waitForSelector('text=Nova OS', { timeout: 10_000 });

  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Corretiva' }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Teste de sync offline.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.locator('textarea').first().fill('Executado em campo offline.');
  await page.getByRole('button', { name: /próximo/i }).click();
  await page.getByRole('button', { name: /próximo/i }).click();
  await drawSignature(page);

  // Vai offline antes de enviar
  await page.context().setOffline(true);
  await page.getByRole('button', { name: /enviar relatório/i }).click();

  await expect(page.getByText(/salvo localmente/i)).toBeVisible({ timeout: 10_000 });
  await page.waitForURL('/reports', { timeout: 10_000 });

  // Badge âmbar deve aparecer
  const amberBadge = page.locator('[class*="amber"]').filter({ hasText: /relatório|sync/i }).first();
  await expect(amberBadge).toBeVisible({ timeout: 5_000 });

  // Volta online → sync acontece em ~5s
  await page.context().setOffline(false);

  // Após sync, badge de pendente deve desaparecer
  await expect(page.getByText(/aguardando sync/i)).not.toBeVisible({ timeout: 35_000 });
});

// ── RA-10: RLS isolamento — técnico B não acessa relatório do técnico A ────────
test('RA-10 — RLS isolamento: técnico B não lê relatório do técnico A', async ({ page, browser }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL e TEST_TECH2_EMAIL necessários');
  const TECH2_EMAIL    = process.env.TEST_TECH2_EMAIL    ?? '';
  const TECH2_PASSWORD = process.env.TEST_TECH2_PASSWORD ?? '';
  test.skip(!TECH2_EMAIL, 'TEST_TECH2_EMAIL não configurado');

  // Tech A cria relatório
  await login(page, TECH_EMAIL, TECH_PASSWORD);
  const reportId = await createMinimalReport(page);
  expect(reportId).toBeTruthy();

  // Tech B tenta acessar diretamente
  const ctx2: BrowserContext = await browser.newContext();
  const page2 = await ctx2.newPage();
  await login(page2, TECH2_EMAIL, TECH2_PASSWORD);
  await page2.goto(`/reports/${reportId}`);

  // Deve mostrar erro de acesso ou "não encontrado", não o conteúdo do relatório
  await page2.waitForLoadState('networkidle');
  const hasSensitiveContent =
    (await page2.getByText(/problema identificado em auditoria/i).count()) > 0;

  expect(hasSensitiveContent, 'Tech B não deve ver conteúdo do relatório do Tech A').toBe(false);
  await ctx2.close();
});
