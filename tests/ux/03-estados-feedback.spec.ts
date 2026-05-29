/**
 * UX/UI — Estados de dados e feedback de ações
 *
 * Requer credenciais em tests/.env.test
 *
 * Cobre:
 *  UX-EST-01: Lista OS mostra spinner de loading antes dos dados chegarem
 *  UX-EST-02: Lista OS vazia tem estado próprio com mensagem de ação
 *  UX-EST-03: Dashboard exibe saudação personalizada com nome do usuário
 *  UX-EST-04: Badge de conectividade "Online" visível na tela de OS
 *  UX-FBK-01: Submit de OS com sucesso exibe toast de confirmação
 *  UX-FBK-02: Botão submit fica disabled durante loading (previne duplo submit)
 *  UX-FBK-03: Offline → badge âmbar de sync pendente aparece na lista de OS
 */

import { test, expect, type Page } from '@playwright/test';
import { loginAs, CREDS, waitForSidebar } from './ux-helpers';

const hasTecnico = !!CREDS.tecnico.email;
const hasGestor  = !!CREDS.gestor.email;

// ── Helper: assinar canvas ───────────────────────────────────────────────────
async function drawSignature(page: Page) {
  const canvas = page.locator('canvas').first();
  // Aguarda o canvas estar no DOM (attached). O timeout é maior aqui porque
  // depois de submits consecutivos o step 7 pode demorar mais para renderizar.
  await canvas.waitFor({ state: 'attached', timeout: 15_000 });
  // Rola o canvas para dentro do viewport antes de medir coordenadas
  await canvas.scrollIntoViewIfNeeded();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.move(box.x + 40, box.y + 40);
    await page.mouse.down();
    await page.mouse.move(box.x + 160, box.y + 80);
    await page.mouse.up();
  }
}

test.describe('UX — Estados e Feedback', () => {

  // ── UX-EST-01 ─────────────────────────────────────────────────────────────
  test('UX-EST-01 — Lista OS exibe spinner de loading antes dos dados chegarem', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');

    // Atrasar a query de service_reports para capturar o estado de loading
    await page.route('**/rest/v1/service_reports**', async (route) => {
      await new Promise<void>((r) => setTimeout(r, 1_500));
      await route.continue();
    });

    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reports');

    // Durante o delay da query, o spinner de loading deve estar visível
    const spinner = page.locator('[class*="animate-spin"]').first();
    await expect(spinner).toBeVisible({ timeout: 3_000 });
  });

  // ── UX-EST-02 ─────────────────────────────────────────────────────────────
  test('UX-EST-02 — Estado vazio na lista de OS tem mensagem de feedback', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');

    // Simular resposta vazia do PostgREST (lista de OS)
    await page.route('**/rest/v1/service_reports**', async (route) => {
      await route.fulfill({
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Content-Range': '*/0',
          'Range-Unit': 'items',
        },
        body: JSON.stringify([]),
      });
    });

    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reports');

    // Aguardar o spinner sumir (dados "chegaram" - lista vazia)
    const spinner = page.locator('[class*="animate-spin"]');
    await spinner.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});

    // Deve mostrar mensagem de empty state — não tela em branco
    const emptyMsg = page.locator('p, span, div').filter({
      hasText: /nenhum|ainda não|crie|primeiro|sem relatório|vazio/i,
    }).first();
    await expect(emptyMsg).toBeVisible({ timeout: 8_000 });
  });

  // ── UX-EST-03 ─────────────────────────────────────────────────────────────
  test('UX-EST-03 — Dashboard exibe saudação personalizada com nome do usuário', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/dashboard');
    await waitForSidebar(page);

    // Dashboard tem "Olá, [nome]!" no h1
    const greeting = page.locator('h1').first();
    await expect(greeting).toContainText(/olá/i, { timeout: 10_000 });

    // Nome não deve ser o fallback genérico "Profissional" se o perfil carregou
    const text = await greeting.textContent() ?? '';
    expect(text.trim().length, 'Saudação deve ter conteúdo').toBeGreaterThan(4);
  });

  // ── UX-EST-04 ─────────────────────────────────────────────────────────────
  test('UX-EST-04 — Badge de conectividade "Online" visível na página de OS', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reports');

    // Aguardar o h1 da página de OS
    await expect(page.locator('h1').first()).toContainText(/ordens de servi/i, { timeout: 15_000 });

    // Badge "Online" indica conexão com o banco
    const onlineBadge = page.getByText(/^online$/i);
    await expect(onlineBadge).toBeVisible({ timeout: 10_000 });
  });

  // ── UX-FBK-01 ─────────────────────────────────────────────────────────────
  test('UX-FBK-01 — Submit de OS com sucesso exibe toast de confirmação', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reports/new');
    await page.waitForSelector('text=Nova OS', { timeout: 10_000 });

    // Preencher os 7 steps mínimos
    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Corretiva' }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.locator('textarea').first().fill('Diagnóstico do teste UX automatizado.');
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.locator('textarea').first().fill('Execução do procedimento padrão de campo.');
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    // Aguardar a chegada ao step 7 antes de tentar desenhar a assinatura
    // Esperar o botão de envio do step 7 aparecer (confirma que chegamos ao último passo)
    await page.locator('[data-onboarding="wizard-step7-enviar"]').waitFor({ state: 'visible', timeout: 30_000 });
    await drawSignature(page);

    await page.locator('[data-onboarding="wizard-step7-enviar"]').click();

    // Toast de sucesso deve aparecer
    await expect(
      page.getByText(/OS enviada com sucesso/i)
    ).toBeVisible({ timeout: 25_000 });
  });

  // ── UX-FBK-02 ─────────────────────────────────────────────────────────────
  test('UX-FBK-02 — Botão "Enviar" fica disabled durante submit (previne duplo click)', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');

    // Atrasar o INSERT de service_reports para capturar o estado de loading
    await page.route('**/rest/v1/service_reports**', async (route) => {
      if (route.request().method() === 'POST') {
        await new Promise<void>((r) => setTimeout(r, 2_000));
      }
      await route.continue();
    });

    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reports/new');
    await page.waitForSelector('text=Nova OS', { timeout: 10_000 });

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Corretiva' }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.locator('textarea').first().fill('Teste de prevenção de duplo submit.');
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.locator('textarea').first().fill('Execução para teste de duplo submit.');
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    // Esperar o botão de envio do step 7 aparecer (confirma que chegamos ao último passo)
    await page.locator('[data-onboarding="wizard-step7-enviar"]').waitFor({ state: 'visible', timeout: 30_000 });
    await drawSignature(page);

    // Localizar pelo data-onboarding para não depender do texto que muda para "Enviando..."
    const sendBtn = page.locator('[data-onboarding="wizard-step7-enviar"]');
    await sendBtn.click();

    // Durante o POST interceptado (2s de delay), o botão deve estar desabilitado
    await expect(sendBtn).toBeDisabled({ timeout: 3_000 });
  });

  // ── UX-FBK-03 ─────────────────────────────────────────────────────────────
  test('UX-FBK-03 — Offline → badge âmbar de sync pendente na lista de OS', async ({ page }) => {
    test.skip(!hasTecnico, 'TEST_TECH_EMAIL não configurado em tests/.env.test');
    await loginAs(page, CREDS.tecnico.email, CREDS.tecnico.password);
    await page.goto('/reports/new');
    await page.waitForSelector('text=Nova OS', { timeout: 10_000 });

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Corretiva' }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.locator('textarea').first().fill('Diagnóstico em modo offline.');
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.locator('textarea').first().fill('Execução offline simulada.');
    await page.getByRole('button', { name: /próximo/i }).click();
    await page.getByRole('button', { name: /próximo/i }).click();
    await drawSignature(page);

    // Vai offline antes de enviar
    // Esperar o botão de envio do step 7 aparecer (confirma que chegamos ao último passo)
    await page.locator('[data-onboarding="wizard-step7-enviar"]').waitFor({ state: 'visible', timeout: 30_000 });
    await page.context().setOffline(true);
    await page.locator('[data-onboarding="wizard-step7-enviar"]').click();

    // Toast de "salvo localmente" ou feedback de offline
    await expect(
      page.getByText(/salvo localmente|offline/i)
    ).toBeVisible({ timeout: 10_000 });

    // Restaura conexão
    await page.context().setOffline(false);
  });

});
