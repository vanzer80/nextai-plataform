/**
 * OS → Orçamento Linkage — Full E2E Verification Suite
 *
 * Commits under test: e918ed7 (feature) + 62a2bfd (16 audit fixes)
 *
 * Role clarification (discovered during test run):
 *   - /orcamentos/* RoleGuard = ['Master', 'Admin', 'Gestor', 'Supervisor']
 *   - Tecnico does NOT have access to orcamentos routes
 *   - Button in ReportDetail uses isReviewer (same guard list)
 *   => All orcamentos tests use MGR credentials
 *   => V1-B specifically tests that Tecnico does NOT see the button
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';

// ── Credentials ──────────────────────────────────────────────────────────────

const TECH = {
  email:    process.env.TEST_TECH_EMAIL    ?? '',
  password: process.env.TEST_TECH_PASSWORD ?? '',
};
const MGR = {
  email:    process.env.TEST_MGR_EMAIL    ?? '',
  password: process.env.TEST_MGR_PASSWORD ?? '',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Auth helper ───────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.waitForSelector('#email', { timeout: 20_000 });
  await page.fill('#email', email);
  await page.fill('#password', password);
  await page.click('button[type="submit"]');

  // Wait for redirect away from /login
  await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 45_000 });

  // Wait for Supabase cold-start + AuthContext profile load to complete.
  // Free-tier DB can take 30-45s to wake from hibernation; AuthContext retries after TIMEOUT_EXCEEDED.
  // "Autenticando sessão..." overlay disappears once the profile is fully resolved.
  await page.waitForFunction(
    () => !document.body.innerText.includes('Autenticando sessão'),
    { timeout: 75_000 },
  );

  // Dismiss onboarding modal
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

// ── Data helpers ──────────────────────────────────────────────────────────────

/** Returns UUID of the first OS visible in the reports list.
 *
 *  Uses waitForResponse to intercept the Supabase service_reports REST call
 *  (avoids dependency on UI text which can be absent during fast cold-starts).
 *  Filters hrefs with full UUID regex to exclude /reports/new etc.
 */
async function getFirstOSId(page: Page): Promise<string> {
  // Set up response intercept BEFORE navigation (otherwise we miss it)
  const reportsResponsePromise = page.waitForResponse(
    resp =>
      resp.url().includes('/rest/v1/service_reports') &&
      resp.status() === 200,
    { timeout: 75_000 },
  );

  await page.goto('/reports');
  await reportsResponsePromise;

  // Give React one tick to render the cards
  await page.waitForTimeout(800);

  const hrefs = await page.$$eval('a[href^="/reports/"]', els =>
    els
      .map(e => (e as HTMLAnchorElement).getAttribute('href') ?? '')
      .filter(h =>
        /^\/reports\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(h)
      ),
  );

  if (hrefs.length === 0) {
    throw new Error('No OS found in reports list — DB returned empty results');
  }
  return hrefs[0].replace('/reports/', '');
}

/** Creates minimal orçamento (skips OS section) and returns its UUID. */
async function createMinimalOrcamento(page: Page): Promise<string> {
  await page.goto('/orcamentos/novo');
  await page.waitForSelector('text=Novo Orçamento', { timeout: 30_000 });

  await page.getByText('Pular vinculação').click();

  const combo = page.locator('[role="combobox"]').first();
  await combo.click();
  await page.locator('[role="option"]').first().waitFor({ timeout: 5_000 });
  await page.locator('[role="option"]').first().click();

  await page.locator('input[placeholder*="Descrição"]').first().fill('Item E2E minimal');
  await page.getByRole('button', { name: /criar orçamento/i }).click();
  await page.waitForURL(/\/orcamentos\/[a-f0-9-]+$/, { timeout: 15_000 });
  return page.url().split('/orcamentos/')[1]!;
}

/** Creates orçamento with OS linked via ?fromOS, returns orcamento UUID. */
async function createOrcamentoWithOS(page: Page, osId: string): Promise<string> {
  await page.goto(`/orcamentos/novo?fromOS=${osId}`);
  await page.waitForSelector('text=Novo Orçamento', { timeout: 30_000 });

  // Wait for Estado 2 — OS linked
  await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 20_000 });

  // Ensure client is selected (some OS may have null client_id)
  const clientValue = await page.locator('[role="combobox"]').first().textContent();
  if (!clientValue || clientValue.trim() === '' || clientValue.includes('Selecione')) {
    // Manually pick first client
    const combo = page.locator('[role="combobox"]').first();
    await combo.click();
    const firstOption = page.locator('[role="option"]').first();
    await firstOption.waitFor({ timeout: 5_000 });
    await firstOption.click();
  }

  await page.getByRole('button', { name: /criar orçamento/i }).click();
  await page.waitForURL(/\/orcamentos\/[a-f0-9-]+$/, { timeout: 15_000 });
  return page.url().split('/orcamentos/')[1]!;
}

// ─────────────────────────────────────────────────────────────────────────────
// TEST SUITE
// ─────────────────────────────────────────────────────────────────────────────

test.describe('OS → Orçamento Vinculação', () => {
  test.skip(!MGR.email, 'TEST_MGR_EMAIL não configurado');

  // ── V1: ReportDetail button ──────────────────────────────────────────────

  test.describe('V1 — ReportDetail: botão Orçamento vs Ver Orçamento', () => {

    test('V1-A: Botão "Orçamento" aparece em OS não-draft para Gestor', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);

      await page.goto(`/reports/${osId}`);
      await page.waitForSelector('h1', { timeout: 15_000 });

      // If status is draft, button should not appear — find a non-draft
      const statusText = await page.locator('[class*="badge"], span').filter({ hasText: /aprovad|revisão|devolv|reprova/i }).first().textContent().catch(() => '');

      if (!statusText) {
        test.info().annotations.push({ type: 'info', description: 'OS is draft — checking button is absent' });
        await expect(page.getByRole('button', { name: /orçamento/i })).not.toBeVisible();
      } else {
        await expect(
          page.getByRole('button', { name: /orçamento|ver orçamento/i })
        ).toBeVisible({ timeout: 8_000 });
      }
    });

    test('V1-B: Técnico NÃO vê o botão Orçamento (sem acesso à rota)', async ({ page }) => {
      test.skip(!TECH.email, 'TEST_TECH_EMAIL não configurado');
      await login(page, TECH.email, TECH.password);
      const osId = await getFirstOSId(page);

      await page.goto(`/reports/${osId}`);
      await page.waitForSelector('h1', { timeout: 15_000 });

      // Técnico is not in isReviewer — button should NEVER appear
      await expect(
        page.getByRole('button', { name: /^orçamento$/i })
      ).not.toBeVisible({ timeout: 3_000 });
    });

    test('V1-C: Botão muda para "Ver Orçamento" após criar orçamento vinculado', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);
      await createOrcamentoWithOS(page, osId);

      await page.goto(`/reports/${osId}`);
      await page.waitForSelector('h1', { timeout: 15_000 });

      const verOrcBtn = page.getByRole('button', { name: /ver orçamento/i });
      await expect(verOrcBtn).toBeVisible({ timeout: 10_000 });

      const cls = await verOrcBtn.getAttribute('class') ?? '';
      expect(cls).toMatch(/blue/);
    });

    test('V1-D: "Ver Orçamento" navega para /orcamentos/:id correto', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);
      const orcId = await createOrcamentoWithOS(page, osId);

      await page.goto(`/reports/${osId}`);
      await page.waitForSelector('h1', { timeout: 15_000 });

      await page.getByRole('button', { name: /ver orçamento/i }).click();
      await page.waitForURL(/\/orcamentos\/[a-f0-9-]+$/, { timeout: 10_000 });
      expect(page.url()).toContain(orcId);
    });
  });

  // ── V2: ?fromOS auto-fill ─────────────────────────────────────────────────

  test.describe('V2 — NovoOrcamento: ?fromOS param', () => {

    test('V2-A: Estado 2 aparece após ?fromOS válido', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);

      await page.goto(`/orcamentos/novo?fromOS=${osId}`);
      await page.waitForSelector('text=Novo Orçamento', { timeout: 30_000 });

      await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 20_000 });
    });

    test('V2-B: OS vinculada exibe os_number em font-mono bold', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);

      await page.goto(`/orcamentos/novo?fromOS=${osId}`);
      await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 20_000 });

      const monoEl = page.locator('p.font-mono.font-bold');
      await expect(monoEl).toBeVisible({ timeout: 5_000 });
      const text = await monoEl.textContent();
      expect(text?.trim().length).toBeGreaterThan(0);
    });

    test('V2-C: Toast de erro com ?fromOS UUID inexistente', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const fakeId = '00000000-0000-0000-0000-000000000000';

      await page.goto(`/orcamentos/novo?fromOS=${fakeId}`);
      await page.waitForSelector('text=Novo Orçamento', { timeout: 30_000 });

      await expect(
        page.getByText(/não foi possível carregar/i)
      ).toBeVisible({ timeout: 15_000 });
    });

    test('V2-D: ?fromOS inválido mantém Estado 1 (campo de busca visível)', async ({ page }) => {
      await login(page, MGR.email, MGR.password);

      await page.goto('/orcamentos/novo?fromOS=00000000-0000-0000-0000-000000000000');
      await page.waitForSelector('text=Novo Orçamento', { timeout: 30_000 });
      await page.waitForTimeout(3_000); // allow async to settle

      await expect(
        page.locator('input[placeholder*="Buscar"]')
      ).toBeVisible({ timeout: 5_000 });
    });
  });

  // ── V3: Manual search ─────────────────────────────────────────────────────

  test.describe('V3 — Busca manual de OS', () => {

    test('V3-A: Spinner aparece e desaparece durante busca', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      await page.goto('/orcamentos/novo');
      await page.waitForSelector('text=Vincular Ordem de Serviço', { timeout: 10_000 });

      const input = page.locator('input[placeholder*="Buscar"]');
      await input.fill('manutenção');

      // Spinner should appear during debounce
      await expect(page.locator('.animate-spin').last()).toBeVisible({ timeout: 3_000 });
      // Then disappear after debounce + fetch
      await expect(page.locator('.animate-spin').last()).not.toBeVisible({ timeout: 8_000 });
    });

    test('V3-B: Limpar busca antes do debounce NÃO trava spinner (fix C3)', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      await page.goto('/orcamentos/novo');
      await page.waitForSelector('text=Vincular Ordem de Serviço', { timeout: 10_000 });

      const input = page.locator('input[placeholder*="Buscar"]');
      await input.fill('manutenção');
      await page.waitForTimeout(150); // Before 400ms debounce
      await input.fill('');

      // After 1s: spinner must NOT be stuck
      await page.waitForTimeout(1_000);
      const spinnerVisible = await page.locator('.animate-spin').last().isVisible().catch(() => false);
      expect(spinnerVisible).toBe(false);
    });

    test('V3-C: Busca sem resultado → mensagem "Nenhuma OS encontrada"', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      await page.goto('/orcamentos/novo');
      await page.waitForSelector('text=Vincular Ordem de Serviço', { timeout: 10_000 });

      await page.locator('input[placeholder*="Buscar"]').fill('xyzwqabc99999noresult');
      await page.waitForTimeout(700); // after debounce
      await expect(page.locator('.animate-spin').last()).not.toBeVisible({ timeout: 5_000 });

      await expect(
        page.getByText(/nenhuma os encontrada/i)
      ).toBeVisible({ timeout: 5_000 });
    });

    test('V3-D: Selecionar OS da lista recentes → Estado 2', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      await page.goto('/orcamentos/novo');
      await page.waitForSelector('text=Vincular Ordem de Serviço', { timeout: 10_000 });

      // Wait for recent OS list to load
      await page.waitForTimeout(2_000);
      const osBtns = page.locator('.divide-y button, [class*="divide-y"] button');

      if (await osBtns.count() === 0) {
        test.info().annotations.push({ type: 'skip', description: 'No recent OS in DB' });
        return;
      }

      await osBtns.first().click();
      await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 10_000 });
    });
  });

  // ── V4: SelectValue shows name not UUID (fix C2) ──────────────────────────

  test('V4 — SelectValue mostra nome do cliente (não UUID) após auto-fill', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    const osId = await getFirstOSId(page);

    await page.goto(`/orcamentos/novo?fromOS=${osId}`);
    await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 20_000 });

    const trigger = page.locator('[role="combobox"]').first();
    await trigger.waitFor({ timeout: 5_000 });
    const text = await trigger.textContent() ?? '';

    // Must NOT be UUID format
    expect(text).not.toMatch(UUID_RE);
    // Must not be the placeholder
    expect(text.trim()).not.toBe('Selecione o cliente');
    // If OS has a client, it should show client name (not UUID)
    if (text.trim() !== 'Selecione o cliente') {
      expect(text.trim().length).toBeGreaterThan(2);
    }
  });

  // ── V5: Chips "• OS" appear and disappear (fixes C2, M1 area) ────────────

  test.describe('V5 — Chips "• OS" rastreiam auto-fill', () => {

    test('V5-A: Chips aparecem nos labels após selecionar OS', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);

      await page.goto(`/orcamentos/novo?fromOS=${osId}`);
      await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 20_000 });

      const chips = page.locator('span:has-text("• OS")');
      const count = await chips.count();
      expect(count).toBeGreaterThanOrEqual(1); // At minimum título or observações
    });

    test('V5-B: Chip "• OS" do Título desaparece ao editar manualmente', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);

      await page.goto(`/orcamentos/novo?fromOS=${osId}`);
      await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 20_000 });

      const countBefore = await page.locator('span:has-text("• OS")').count();

      const tituloInput = page.locator('input[placeholder*="Manutenção"]');
      await tituloInput.clear();
      await tituloInput.fill('Título editado pelo gestor');
      await page.waitForTimeout(400);

      const countAfter = await page.locator('span:has-text("• OS")').count();
      expect(countAfter).toBeLessThan(countBefore);
    });
  });

  // ── V6: Textarea expands with OS content (fix A3) ─────────────────────────

  test('V6 — Textarea de observações tem rows≥8 quando preenchida pela OS', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    const osId = await getFirstOSId(page);

    await page.goto(`/orcamentos/novo?fromOS=${osId}`);
    await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 20_000 });

    const textarea = page.locator('textarea[placeholder*="Condições"]');
    await textarea.waitFor({ timeout: 5_000 });
    const rows = Number(await textarea.getAttribute('rows') ?? '3');
    expect(rows).toBeGreaterThanOrEqual(8);
  });

  // ── V7: Desvincular selective clearing (fix A4) ───────────────────────────

  test('V7-A — Desvincular preserva campo editado (título)', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    const osId = await getFirstOSId(page);

    await page.goto(`/orcamentos/novo?fromOS=${osId}`);
    await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 20_000 });

    // Edit title
    const tituloInput = page.locator('input[placeholder*="Manutenção"]');
    await tituloInput.clear();
    const customTitle = 'Título personalizado — não deve ser limpo';
    await tituloInput.fill(customTitle);
    await page.waitForTimeout(300);

    // Desvincular
    await page.locator('button[title="Desvincular OS"]').first().click();
    await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible({ timeout: 5_000 });

    // Title PRESERVED (user edited it)
    await expect(tituloInput).toHaveValue(customTitle);
  });

  test('V7-B — Desvincular limpa observações não editadas', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    const osId = await getFirstOSId(page);

    await page.goto(`/orcamentos/novo?fromOS=${osId}`);
    await expect(page.getByText('OS vinculada')).toBeVisible({ timeout: 20_000 });

    const textarea = page.locator('textarea[placeholder*="Condições"]');
    const obsBefore = await textarea.inputValue();

    // Desvincular WITHOUT editing observações
    await page.locator('button[title="Desvincular OS"]').first().click();
    await page.waitForTimeout(300);

    if (obsBefore.trim().length > 0) {
      const obsAfter = await textarea.inputValue();
      expect(obsAfter.trim()).toBe('');
    }
  });

  // ── V8: Pular / Restaurar reversibility (fix A5) ──────────────────────────

  test('V8 — "Pular vinculação" é reversível via "Vincular uma OS"', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    await page.goto('/orcamentos/novo');
    await page.waitForSelector('text=Vincular Ordem de Serviço', { timeout: 10_000 });

    // Pular
    await page.getByText('Pular vinculação').click();
    await expect(page.getByText('Vincular Ordem de Serviço')).not.toBeVisible({ timeout: 3_000 });

    // Restore link appears
    const restoreBtn = page.getByText(/vincular uma os/i);
    await expect(restoreBtn).toBeVisible({ timeout: 5_000 });

    // Restore
    await restoreBtn.click();
    await expect(page.getByText('Vincular Ordem de Serviço')).toBeVisible({ timeout: 5_000 });
  });

  // ── V9: Skeleton + empty state (fixes A6, A7) ─────────────────────────────

  test('V9 — Lista de OS recentes carrega (skeleton ou lista, sem container vazio)', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    await page.goto('/orcamentos/novo');
    await page.waitForSelector('text=Vincular Ordem de Serviço', { timeout: 10_000 });

    // Skeleton may appear briefly
    // After 3s, state must be settled: either list or "no OS" message
    await page.waitForTimeout(3_000);

    const listItems = await page.locator('.divide-y button, [class*="divide-y"] button').count();
    if (listItems === 0) {
      // Must show message, not empty bordered container
      await expect(
        page.getByText(/nenhuma os disponível/i)
      ).toBeVisible({ timeout: 5_000 });
    } else {
      expect(listItems).toBeGreaterThan(0);
    }
  });

  // ── V10: End-to-end submit flow ───────────────────────────────────────────

  test('V10 — Criar orçamento com OS vinculada → report_id no OrcamentoDetail', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    const osId = await getFirstOSId(page);
    const orcId = await createOrcamentoWithOS(page, osId);

    await expect(page).toHaveURL(`/orcamentos/${orcId}`);
    await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 10_000 });
  });

  // ── V11: OrcamentoDetail card richness (fix A1) ───────────────────────────

  test.describe('V11 — OrcamentoDetail: card OS rico', () => {

    test('V11-A: Card exibe os_number em font-mono', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);
      const orcId = await createOrcamentoWithOS(page, osId);

      await page.goto(`/orcamentos/${orcId}`);
      await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 10_000 });

      const monoEl = page.locator('span.font-mono').first();
      await expect(monoEl).toBeVisible({ timeout: 5_000 });
      expect((await monoEl.textContent())?.trim().length).toBeGreaterThan(0);
    });

    test('V11-B: Card tem informações além do os_number (type/date/status)', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);
      const orcId = await createOrcamentoWithOS(page, osId);

      await page.goto(`/orcamentos/${orcId}`);
      await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 10_000 });

      const cardContent = await page.locator('div').filter({
        has: page.getByText('Ordem de Serviço Vinculada')
      }).first().textContent() ?? '';

      // Card should have more than just the header and number
      expect(cardContent.trim().length).toBeGreaterThan(40);
    });

    test('V11-C: HTML válido — link "Ver OS →" é um <a>, não <button> dentro de <a>', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);
      const orcId = await createOrcamentoWithOS(page, osId);

      await page.goto(`/orcamentos/${orcId}`);
      await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 10_000 });

      // The "Ver OS" element should be an <a> link, not a button nested inside <a>
      const verOSEl = page.getByText('Ver OS →');
      await expect(verOSEl).toBeVisible();

      const tagName = await verOSEl.evaluate(el => el.tagName.toLowerCase());
      expect(tagName).toBe('a');

      // Should NOT have a <button> nested inside an <a>
      const buttonInLink = await verOSEl.locator('button').count().catch(() => 0);
      expect(buttonInLink).toBe(0);
    });
  });

  // ── V12: "Ver OS →" navigation ────────────────────────────────────────────

  test('V12 — "Ver OS →" navega para /reports/:osId correto', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    const osId = await getFirstOSId(page);
    const orcId = await createOrcamentoWithOS(page, osId);

    await page.goto(`/orcamentos/${orcId}`);
    await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 10_000 });

    await page.getByText('Ver OS →').click();
    await page.waitForURL(/\/reports\/[a-f0-9-]+/, { timeout: 10_000 });
    expect(page.url()).toContain(osId);
  });

  // ── V13: Edit mode (fixes A2, C1) ────────────────────────────────────────

  test.describe('V13 — Modo edição com OS vinculada', () => {

    test('V13-A: Card azul aparece no modo edição quando OS vinculada', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);
      const orcId = await createOrcamentoWithOS(page, osId);

      await page.goto(`/orcamentos/${orcId}/editar`);
      await expect(page.getByText('Editar Orçamento')).toBeVisible({ timeout: 10_000 });
      await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 8_000 });
    });

    test('V13-B: Desvincular no modo edição remove o card', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);
      const orcId = await createOrcamentoWithOS(page, osId);

      await page.goto(`/orcamentos/${orcId}/editar`);
      await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 10_000 });

      await page.locator('button[title="Desvincular OS"]').first().click();
      await expect(page.getByText('Ordem de Serviço Vinculada')).not.toBeVisible({ timeout: 5_000 });
    });

    test('V13-C: Salvar após desvincular → report_id = null (fix C1 — sem link no detail)', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);
      const orcId = await createOrcamentoWithOS(page, osId);

      await page.goto(`/orcamentos/${orcId}/editar`);
      await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 10_000 });

      await page.locator('button[title="Desvincular OS"]').first().click();
      await page.getByRole('button', { name: /salvar alterações/i }).click();
      await page.waitForURL(`/orcamentos/${orcId}`, { timeout: 15_000 });

      await expect(page.getByText('Ordem de Serviço Vinculada')).not.toBeVisible({ timeout: 8_000 });
    });

    test('V13-D: Salvar SEM desvincular → report_id PRESERVADO (fix C1)', async ({ page }) => {
      await login(page, MGR.email, MGR.password);
      const osId = await getFirstOSId(page);
      const orcId = await createOrcamentoWithOS(page, osId);

      await page.goto(`/orcamentos/${orcId}/editar`);
      await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 10_000 });

      // Edit title without unlinking
      await page.locator('input[placeholder*="Manutenção"]').fill('C1 fix test — OS should remain');
      await page.getByRole('button', { name: /salvar alterações/i }).click();
      await page.waitForURL(`/orcamentos/${orcId}`, { timeout: 15_000 });

      // OS link must still be present
      await expect(page.getByText('Ordem de Serviço Vinculada')).toBeVisible({ timeout: 8_000 });
    });
  });

  // ── PROBES: edge cases & regressions ─────────────────────────────────────

  test('🔍 PROBE: duplo-clique em OS não cria estado duplicado', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    await page.goto('/orcamentos/novo');
    await page.waitForSelector('text=Vincular Ordem de Serviço', { timeout: 10_000 });
    await page.waitForTimeout(2_000);

    const osBtns = page.locator('.divide-y button, [class*="divide-y"] button');
    if (await osBtns.count() === 0) {
      test.info().annotations.push({ type: 'skip', description: 'No recent OS' });
      return;
    }

    await osBtns.first().dblclick();
    const vinculadaCount = await page.locator('text=OS vinculada').count();
    expect(vinculadaCount).toBe(1);
  });

  test('🔍 PROBE: orçamento sem OS funciona normalmente (sem report_id)', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    const orcId = await createMinimalOrcamento(page);

    await expect(page).toHaveURL(`/orcamentos/${orcId}`);
    await expect(page.getByText('Ordem de Serviço Vinculada')).not.toBeVisible({ timeout: 5_000 });
  });

  test('🔍 PROBE: botão "Orçamento" não aparece em OS com status draft', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    // Navigate to a report and verify behavior based on status
    await page.goto('/reports');
    await page.waitForSelector('a[href*="/reports/"]', { timeout: 20_000 });

    const links = await page.$$eval('a[href*="/reports/"]', els =>
      els.map(e => (e as HTMLAnchorElement).href)
    );

    for (const href of links) {
      const id = href.split('/reports/')[1]?.split('?')[0];
      if (!id || !UUID_RE.test(id)) continue;

      await page.goto(`/reports/${id}`);
      await page.waitForSelector('h1', { timeout: 10_000 });

      const isDraft = await page.getByText('Rascunho').isVisible().catch(() => false);
      if (isDraft) {
        const orcBtn = page.getByRole('button', { name: /^orçamento$/i });
        await expect(orcBtn).not.toBeVisible({ timeout: 2_000 });
        return; // Test passed
      }
    }

    test.info().annotations.push({ type: 'info', description: 'No draft OS found in list' });
  });

  test('🔍 PROBE: /orcamentos/novo sem param → Estado 1 com campo de busca', async ({ page }) => {
    await login(page, MGR.email, MGR.password);
    await page.goto('/orcamentos/novo');
    await page.waitForSelector('text=Vincular Ordem de Serviço', { timeout: 10_000 });

    await expect(page.locator('input[placeholder*="Buscar"]')).toBeVisible();
    // Estado 2 should NOT appear
    await expect(page.getByText('OS vinculada')).not.toBeVisible({ timeout: 2_000 });
  });
});
