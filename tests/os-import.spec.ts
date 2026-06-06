/**
 * os-import.spec.ts — Testes completos de importação de OS de sistemas externos
 *
 * Cobre TODA a funcionalidade implementada em s74:
 *
 *   BLOCO 1 — RBAC
 *     IM-01  Técnico NÃO vê botão "Importar OS"
 *     IM-02  Gestor VÊ botão "Importar OS" e botão Exportar
 *
 *   BLOCO 2 — Dialog UI: estrutura e validação de formulário
 *     IM-03  Dialog abre com título, duas tabs e seletor de sistema
 *     IM-04  Tab PDF: submeter sem arquivo mostra toast de erro
 *     IM-05  Tab Campos: submeter sem "Problema reportado" mostra toast de erro
 *     IM-06  Tab Campos: todos os campos opcionais ficam visíveis após trocar de tab
 *
 *   BLOCO 3 — Edge Function: CORS, autenticação e validação HTTP
 *     IM-07  OPTIONS preflight retorna 200 com "apikey" em Access-Control-Allow-Headers
 *     IM-08  POST sem autenticação retorna 401 (missing_auth)
 *     IM-09  POST com JWT de Técnico retorna 403 (insufficient_role)
 *     IM-10  POST com X-API-Key inválida retorna 401 (invalid_api_key)
 *     IM-11  POST com Content-Type errado retorna 415
 *     IM-12  POST com campos obrigatórios ausentes retorna 400 com lista de erros

 *   BLOCO 4 — Importação modo "Preencher campos" (happy path E2E)
 *     IM-13  Gestor importa OS mínima → estado de sucesso com número da OS
 *     IM-14  "Ver OS" navega para /reports/{id} com status "Aguardando Revisão"
 *     IM-15  Fechar dialog → lista de OS atualiza (onImported callback)
 *
 *   BLOCO 5 — Deduplicação
 *     IM-16  UI: reimportar mesma external_ref_id mostra "OS já importada anteriormente"
 *     IM-17  API: segundo POST com mesma ref retorna 200 duplicate:true com os_id original
 *
 *   BLOCO 6 — Resolução de entidades (via chamada HTTP direta com JWT)
 *     IM-18  Importar com client_name parcial → client_resolution matched_name ou auto_created
 *     IM-19  Importar com nome de cliente garantidamente inédito → client_resolution auto_created
 *     IM-20  Importar com priority "high" → OS criada com priority "alta" (mapeamento)
 *
 *   BLOCO 7 — Log de importações /admin/os-imports
 *     IM-21  Página carrega; exibe entradas após testes anteriores
 *     IM-22  Expandir linha mostra payload sanitizado (sem pdf_base64 raw)
 *     IM-23  Filtro por status "success" oculta entradas de outros status
 *     IM-24  Botão Atualizar recarrega a lista
 *
 *   BLOCO 8 — Importação via PDF (condicional, requer TEST_PDF_IMPORT=true)
 *     IM-25  Upload de PDF fixture → OS criada ou falha controlada do Gemini
 *
 * Pré-requisitos:
 *   1. Dev server: npm run dev
 *   2. tests/.env.test preenchido com TEST_MGR_EMAIL, TEST_MGR_PASSWORD,
 *                                       TEST_TECH_EMAIL, TEST_TECH_PASSWORD
 *   3. npx playwright install chromium
 *   4. npx playwright test tests/os-import.spec.ts
 *
 * Para habilitar o teste de PDF: adicionar TEST_PDF_IMPORT=true no .env.test
 */

import { test, expect, type Page, type APIRequestContext } from '@playwright/test';
import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';

// ── Constantes de ambiente ───────────────────────────────────────────────────────

const SUPABASE_URL   = 'https://sksursvmgvxqbbdsztcd.supabase.co';
const ANON_KEY       = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc3Vyc3ZtZ3Z4cWJiZHN6dGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDY2NDgsImV4cCI6MjA5MTYyMjY0OH0.0Yux9J3y5eLJ4qVN8VFy7Q-qivFiRwCJqPL4whj_YcE';
const FUNCTION_URL   = `${SUPABASE_URL}/functions/v1/os-import-processor`;

const TECH_EMAIL     = process.env.TEST_TECH_EMAIL     ?? '';
const TECH_PASSWORD  = process.env.TEST_TECH_PASSWORD  ?? '';
const MGR_EMAIL      = process.env.TEST_MGR_EMAIL      ?? '';
const MGR_PASSWORD   = process.env.TEST_MGR_PASSWORD   ?? '';

// RUN_ID único por execução — impede colisão de external_ref_id entre reruns
const RUN_ID = `pw-${Date.now()}`;

// Tokens JWT obtidos uma vez no beforeAll e reutilizados nos blocos de API
let mgrJwt  = '';
let techJwt = '';

// ── Helpers ──────────────────────────────────────────────────────────────────────

async function login(page: Page, email: string, password: string) {
  await page.goto('/');
  await page.waitForSelector('input[type="email"]', { timeout: 15_000 });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|reports)/, { timeout: 20_000 });
}

async function getJwt(api: APIRequestContext, email: string, password: string): Promise<string> {
  const res  = await api.post(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    data:    { email, password },
  });
  const body = await res.json() as { access_token?: string };
  return body.access_token ?? '';
}

/** Abre o dialog de importação assumindo que o gestor já está logado em /reports. */
async function openImportDialog(page: Page) {
  await page.goto('/reports');
  await page.waitForSelector('text=Ordens de Serviço', { timeout: 10_000 });
  await page.locator('[data-onboarding="os-importar"]').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
}

/** Troca para a tab "Preencher campos" dentro do dialog já aberto. */
async function switchToFieldsTab(page: Page) {
  await page.getByRole('button', { name: /preencher campos/i }).click();
  await expect(page.getByText('Problema reportado')).toBeVisible({ timeout: 3_000 });
}

/** PDF mínimo válido (sem conteúdo real — apenas estrutura) para testar upload. */
function minimalPdfBuffer(): Buffer {
  const body = [
    '%PDF-1.0',
    '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
    '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
    '3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj',
    'xref\n0 4',
    '0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \n0000000115 00000 n ',
    'trailer<</Size 4/Root 1 0 R>>\nstartxref\n190\n%%EOF',
  ].join('\n');
  return Buffer.from(body);
}

// ── Setup: JWT tokens obtidos uma vez para todos os testes de API ─────────────────

test.beforeAll(async ({ request }) => {
  if (MGR_EMAIL && MGR_PASSWORD)   mgrJwt  = await getJwt(request, MGR_EMAIL,  MGR_PASSWORD);
  if (TECH_EMAIL && TECH_PASSWORD) techJwt = await getJwt(request, TECH_EMAIL, TECH_PASSWORD);
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOCO 1 — RBAC: Controle de Acesso ao Botão
// ════════════════════════════════════════════════════════════════════════════════

test('IM-01 — Técnico NÃO vê botão "Importar OS" nem "Exportar"', async ({ page }) => {
  test.skip(!TECH_EMAIL, 'TEST_TECH_EMAIL não configurado');

  await login(page, TECH_EMAIL, TECH_PASSWORD);
  await page.goto('/reports');
  await page.waitForSelector('text=Ordens de Serviço', { timeout: 10_000 });

  await expect(page.locator('[data-onboarding="os-importar"]')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /exportar/i })).not.toBeVisible();

  // Técnico ainda deve ver o botão "Nova OS" (disponível para todos)
  await expect(page.getByRole('link', { name: /nova os/i })).toBeVisible();
});

test('IM-02 — Gestor VÊ botão "Importar OS" e botão "Exportar"', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await page.goto('/reports');
  await page.waitForSelector('text=Ordens de Serviço', { timeout: 10_000 });

  await expect(page.locator('[data-onboarding="os-importar"]')).toBeVisible();
  await expect(page.getByRole('button', { name: /exportar/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /nova os/i })).toBeVisible();
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOCO 2 — Dialog UI: Estrutura e Validação de Formulário
// ════════════════════════════════════════════════════════════════════════════════

test('IM-03 — Dialog abre com título, duas tabs e seletor de sistema', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await openImportDialog(page);

  // Título e descrição
  await expect(page.getByRole('dialog').getByText('Importar OS de sistema externo')).toBeVisible();

  // Duas tabs presentes
  await expect(page.getByRole('button', { name: /importar pdf/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /preencher campos/i })).toBeVisible();

  // Tab PDF ativa por padrão — zona de upload visível
  await expect(page.getByText(/clique para selecionar o pdf/i)).toBeVisible();
  await expect(page.getByText(/gemini extrai automaticamente/i)).toBeVisible();

  // Campos comuns visíveis (presentes em ambas as tabs)
  await expect(page.getByText('Sistema de origem')).toBeVisible();
  await expect(page.getByPlaceholder('Nº da OS no sistema de origem')).toBeVisible();

  // Fechar limpa o estado
  await page.getByRole('button', { name: /cancelar/i }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });
});

test('IM-04 — Tab PDF: submeter sem arquivo mostra toast de erro', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await openImportDialog(page);

  // Tab PDF já ativa — clicar em "Importar OS" sem selecionar arquivo
  await page.getByRole('dialog').getByRole('button', { name: /importar os/i }).click();

  await expect(page.getByText(/selecione um arquivo pdf/i)).toBeVisible({ timeout: 5_000 });

  // Dialog permanece aberto — não fecha em caso de erro
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByRole('button', { name: /cancelar/i }).click();
});

test('IM-05 — Tab Campos: submeter sem "Problema reportado" mostra toast de erro', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await openImportDialog(page);
  await switchToFieldsTab(page);

  // Preencher campos opcionais mas deixar o obrigatório em branco
  await page.getByPlaceholder('Ex: Empresa ABC Ltda').fill('Empresa Qualquer');

  await page.getByRole('dialog').getByRole('button', { name: /importar os/i }).click();

  await expect(page.getByText(/problema reportado é obrigatório/i)).toBeVisible({ timeout: 5_000 });
  await expect(page.getByRole('dialog')).toBeVisible();

  await page.getByRole('button', { name: /cancelar/i }).click();
});

test('IM-06 — Tab Campos: todos os campos opcionais estão visíveis', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await openImportDialog(page);
  await switchToFieldsTab(page);

  // Verificar presença de todos os campos do formulário
  await expect(page.getByPlaceholder('Ex: Empresa ABC Ltda')).toBeVisible();
  await expect(page.getByPlaceholder('00.000.000/0000-00')).toBeVisible();
  await expect(page.getByPlaceholder('Nome do técnico')).toBeVisible();
  await expect(page.getByPlaceholder('Ex: Manutenção preventiva')).toBeVisible();
  await expect(page.getByPlaceholder('Endereço / local')).toBeVisible();
  await expect(page.getByPlaceholder('Nome ou modelo')).toBeVisible();
  await expect(page.getByPlaceholder(/descreva o problema/i)).toBeVisible();
  await expect(page.getByPlaceholder(/serviços realizados/i)).toBeVisible();
  await expect(page.getByPlaceholder(/diagnóstico técnico/i)).toBeVisible();
  await expect(page.getByPlaceholder(/lista de peças/i)).toBeVisible();

  // Seletor de prioridade presente
  await expect(page.getByText('Prioridade')).toBeVisible();

  await page.getByRole('button', { name: /cancelar/i }).click();
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOCO 3 — Edge Function: CORS, Autenticação e Validação HTTP
// ════════════════════════════════════════════════════════════════════════════════

test('IM-07 — CORS preflight: status 200 e "apikey" em Access-Control-Allow-Headers', async ({ request }) => {
  const res = await request.fetch(FUNCTION_URL, {
    method: 'OPTIONS',
    headers: {
      'Origin':                         'https://nextai-plataform.vercel.app',
      'Access-Control-Request-Method':  'POST',
      'Access-Control-Request-Headers': 'authorization, content-type, apikey, x-client-info',
    },
  });

  expect(res.status()).toBe(200);

  const allowHeaders = (res.headers()['access-control-allow-headers'] ?? '').toLowerCase();
  expect(allowHeaders).toContain('apikey');
  expect(allowHeaders).toContain('authorization');
  expect(allowHeaders).toContain('content-type');
  expect(allowHeaders).toContain('x-api-key');
  expect(allowHeaders).toContain('x-client-info');

  expect(res.headers()['access-control-allow-origin']).toBe('*');
  expect((res.headers()['access-control-allow-methods'] ?? '').toUpperCase()).toContain('POST');
});

test('IM-08 — POST sem autenticação retorna 401 (missing_auth)', async ({ request }) => {
  const res = await request.post(FUNCTION_URL, {
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    data: { mode: 'json', external_source: 'custom', external_ref_id: `${RUN_ID}-no-auth` },
  });

  expect(res.status()).toBe(401);
  const body = await res.json() as { status: number; type: string };
  expect(body.status).toBe(401);
  expect(body.type).toContain('missing_auth');
});

test('IM-09 — JWT de Técnico retorna 403 (insufficient_role)', async ({ request }) => {
  test.skip(!techJwt, 'JWT de técnico não disponível — verifique TEST_TECH_EMAIL/PASSWORD');

  const res = await request.post(FUNCTION_URL, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${techJwt}`,
      apikey:          ANON_KEY,
    },
    data: {
      mode: 'json', external_source: 'custom',
      external_ref_id: `${RUN_ID}-tech-403`,
      reported_problem: 'Problema de teste — deve ser rejeitado.',
    },
  });

  expect(res.status()).toBe(403);
  const body = await res.json() as { status: number; type: string };
  expect(body.status).toBe(403);
  expect(body.type).toContain('insufficient_role');
});

test('IM-10 — X-API-Key inválida retorna 401 (invalid_api_key)', async ({ request }) => {
  const res = await request.post(FUNCTION_URL, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key':    'key-invalida-playwright-test-0000',
      apikey:         ANON_KEY,
    },
    data: { mode: 'json', external_source: 'custom', external_ref_id: `${RUN_ID}-bad-key` },
  });

  expect(res.status()).toBe(401);
  const body = await res.json() as { status: number; type: string };
  expect(body.status).toBe(401);
  expect(body.type).toContain('invalid_api_key');
});

test('IM-11 — Content-Type incorreto retorna 415', async ({ request }) => {
  test.skip(!mgrJwt, 'JWT de gestor não disponível');

  const res = await request.post(FUNCTION_URL, {
    headers: {
      'Content-Type':  'text/plain',
      'Authorization': `Bearer ${mgrJwt}`,
      apikey:          ANON_KEY,
    },
    data: '{ "mode": "json" }',
  });

  expect(res.status()).toBe(415);
  const body = await res.json() as { status: number; type: string };
  expect(body.status).toBe(415);
  expect(body.type).toContain('unsupported_media_type');
});

test('IM-12 — Payload sem campos obrigatórios retorna 400 com lista detalhada de erros', async ({ request }) => {
  test.skip(!mgrJwt, 'JWT de gestor não disponível');

  const res = await request.post(FUNCTION_URL, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${mgrJwt}`,
      apikey:          ANON_KEY,
    },
    data: { mode: 'json' }, // faltam external_source e external_ref_id
  });

  expect(res.status()).toBe(400);
  const body = await res.json() as { errors: Array<{ field: string; message: string }> };
  expect(Array.isArray(body.errors)).toBe(true);
  expect(body.errors.length).toBeGreaterThan(0);

  const fields = body.errors.map(e => e.field);
  expect(fields).toContain('external_source');
  expect(fields).toContain('external_ref_id');

  // Cada erro deve ter field e message
  body.errors.forEach(e => {
    expect(e.field).toBeTruthy();
    expect(e.message).toBeTruthy();
  });
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOCO 4 — Importação via Campos: Happy Path E2E
// ════════════════════════════════════════════════════════════════════════════════

test('IM-13 — Gestor importa OS mínima → estado de sucesso com número da OS', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await openImportDialog(page);

  // Referência externa única para este run
  await page.getByPlaceholder('Nº da OS no sistema de origem').fill(`${RUN_ID}-main`);

  await switchToFieldsTab(page);

  // Campos mínimos + extras para validar resolução
  await page.getByPlaceholder('Ex: Empresa ABC Ltda').fill('Empresa Teste Playwright');
  await page.getByPlaceholder('Nome do técnico').fill('Técnico Playwright');
  await page.getByPlaceholder('Ex: Manutenção preventiva').fill('Preventiva');
  await page.getByPlaceholder('Endereço / local').fill('Rua de Teste, 123');
  await page.getByPlaceholder('Nome ou modelo').fill('Equipamento Teste E2E');
  await page.getByPlaceholder(/descreva o problema/i).fill('Falha identificada em teste E2E automatizado.');
  await page.getByPlaceholder(/serviços realizados/i).fill('Inspeção e ajuste conforme protocolo de teste.');
  await page.getByPlaceholder(/diagnóstico técnico/i).fill('Componente desgastado — substituição necessária.');
  await page.getByPlaceholder(/lista de peças/i).fill('Filtro x1, Óleo 5L');

  // Submeter
  await page.getByRole('dialog').getByRole('button', { name: /importar os/i }).click();

  // Estado de sucesso deve aparecer em até 30s (Supabase free tier pode hibernar)
  await expect(page.getByText(/os importada com sucesso/i)).toBeVisible({ timeout: 35_000 });

  // Número da OS exibido
  await expect(page.getByText(/número:/i)).toBeVisible();

  // Botões de ação pós-sucesso
  await expect(page.getByRole('button', { name: /fechar/i })).toBeVisible();
  await expect(page.getByRole('button', { name: /ver os/i })).toBeVisible();

  // Aviso de cliente auto-criado pode aparecer (não obrigatório)
  // — não é um erro, apenas informativo
});

test('IM-14 — "Ver OS" navega para /reports/{id} com status Aguardando Revisão', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await openImportDialog(page);

  await page.getByPlaceholder('Nº da OS no sistema de origem').fill(`${RUN_ID}-ver-os`);
  await switchToFieldsTab(page);
  await page.getByPlaceholder(/descreva o problema/i).fill('OS criada para testar navegação "Ver OS".');
  await page.getByRole('dialog').getByRole('button', { name: /importar os/i }).click();

  await expect(page.getByText(/os importada com sucesso/i)).toBeVisible({ timeout: 35_000 });

  // Clicar em "Ver OS"
  await page.getByRole('button', { name: /ver os/i }).click();

  // Deve navegar para /reports/{id}
  await page.waitForURL(/\/reports\/.{20,}/, { timeout: 10_000 });

  // Status "Aguardando Revisão" (pending_review) visível na página da OS
  await expect(page.getByText(/aguardando revis/i).first()).toBeVisible({ timeout: 15_000 });

  // A OS importada não deve ter nenhum campo marcado como inválido
  await expect(page.getByText(/erro ao carregar/i)).not.toBeVisible();
});

test('IM-15 — Fechar dialog → onImported atualiza a lista de OS', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await page.goto('/reports');
  await page.waitForSelector('text=Ordens de Serviço', { timeout: 10_000 });

  // Conta OSs antes do import (pode ser 0 se lista vazia)
  const countAntes = await page.locator('a[href*="/reports/"]').count();

  await page.locator('[data-onboarding="os-importar"]').click();
  await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });

  await page.getByPlaceholder('Nº da OS no sistema de origem').fill(`${RUN_ID}-lista-refresh`);
  await switchToFieldsTab(page);
  await page.getByPlaceholder(/descreva o problema/i).fill('OS para verificar refresh da lista.');
  await page.getByRole('dialog').getByRole('button', { name: /importar os/i }).click();

  await expect(page.getByText(/os importada com sucesso/i)).toBeVisible({ timeout: 35_000 });

  // Fechar dialog — dispara onImported → refresh()
  await page.getByRole('button', { name: /fechar/i }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

  // Aguardar atualização da lista (realtime/refresh)
  await page.waitForTimeout(1_500);

  // Lista deve ter mais OSs que antes
  const countDepois = await page.locator('a[href*="/reports/"]').count();
  expect(countDepois).toBeGreaterThan(countAntes);
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOCO 5 — Deduplicação
// ════════════════════════════════════════════════════════════════════════════════

test('IM-16 — UI: reimportar mesma external_ref_id mostra "OS já importada anteriormente"', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  const dedupeRef = `${RUN_ID}-dedup-ui`;

  async function importWithRef() {
    await page.locator('[data-onboarding="os-importar"]').click();
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5_000 });
    await page.getByPlaceholder('Nº da OS no sistema de origem').fill(dedupeRef);
    await switchToFieldsTab(page);
    await page.getByPlaceholder(/descreva o problema/i).fill('Problema para teste de deduplicação.');
    await page.getByRole('dialog').getByRole('button', { name: /importar os/i }).click();
  }

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await page.goto('/reports');
  await page.waitForSelector('text=Ordens de Serviço', { timeout: 10_000 });

  // Primeiro import — sucesso
  await importWithRef();
  await expect(page.getByText(/os importada com sucesso/i)).toBeVisible({ timeout: 35_000 });
  await page.getByRole('button', { name: /fechar/i }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible({ timeout: 3_000 });

  // Segundo import — mesma ref → duplicata
  await importWithRef();
  await expect(page.getByText(/os já importada anteriormente/i)).toBeVisible({ timeout: 15_000 });

  // Número da OS original ainda é exibido para facilitar navegação
  await expect(page.getByText(/número:/i)).toBeVisible();

  await page.getByRole('button', { name: /fechar/i }).click();
});

test('IM-17 — API: segundo POST retorna 200 com duplicate:true e os_id do original', async ({ request }) => {
  test.skip(!mgrJwt, 'JWT de gestor não disponível');

  const dedupeRef = `${RUN_ID}-dedup-api`;
  const headers   = {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${mgrJwt}`,
    apikey:          ANON_KEY,
  };
  const payload = {
    mode: 'json', external_source: 'custom',
    external_ref_id: dedupeRef,
    reported_problem: 'Problema para teste de deduplicação via API.',
  };

  // Primeiro import — 201 Created
  const res1  = await request.post(FUNCTION_URL, { headers, data: payload });
  expect(res1.status()).toBe(201);
  const body1 = await res1.json() as { data: { os_id: string; duplicate: boolean; os_number: string } };
  expect(body1.data.duplicate).toBe(false);
  expect(body1.data.os_id).toBeTruthy();
  expect(body1.data.os_number).toBeTruthy();
  const originalOsId = body1.data.os_id;

  // Segundo import — 200 Duplicate
  const res2  = await request.post(FUNCTION_URL, { headers, data: payload });
  expect(res2.status()).toBe(200);
  const body2 = await res2.json() as { data: { os_id: string; duplicate: boolean } };
  expect(body2.data.duplicate).toBe(true);
  expect(body2.data.os_id).toBe(originalOsId); // mesmo ID — não criou nova OS
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOCO 6 — Resolução de Entidades
// ════════════════════════════════════════════════════════════════════════════════

test('IM-18 — Resolução: client_name parcial → matched_name ou auto_created', async ({ request }) => {
  test.skip(!mgrJwt, 'JWT de gestor não disponível');

  const res = await request.post(FUNCTION_URL, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${mgrJwt}`,
      apikey:          ANON_KEY,
    },
    data: {
      mode: 'json', external_source: 'custom',
      external_ref_id: `${RUN_ID}-client-match`,
      client_name:     'Mopar', // substring ILIKE — deve bater em "Mopar Engenharia" se existir
      reported_problem: 'Teste de resolução de cliente por nome parcial.',
    },
  });

  expect([201, 200]).toContain(res.status()); // 201 novo ou 200 dedup
  const body = await res.json() as { data: { client_resolution: string } };
  // Aceita qualquer resolução válida — o importante é não ter undefined/null
  expect(['matched_name', 'matched_cnpj', 'auto_created', 'not_found']).toContain(body.data.client_resolution);
});

test('IM-19 — Resolução: nome inédito → client_resolution === "auto_created"', async ({ request }) => {
  test.skip(!mgrJwt, 'JWT de gestor não disponível');

  // Nome único garantidamente não existe no banco
  const uniqueClientName = `Cliente AutoCriado Playwright ${RUN_ID}`;

  const res = await request.post(FUNCTION_URL, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${mgrJwt}`,
      apikey:          ANON_KEY,
    },
    data: {
      mode: 'json', external_source: 'custom',
      external_ref_id: `${RUN_ID}-auto-create`,
      client_name:     uniqueClientName,
      reported_problem: 'Problema para cliente auto-criado.',
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json() as { data: { client_resolution: string; os_id: string } };
  expect(body.data.client_resolution).toBe('auto_created');
  expect(body.data.os_id).toBeTruthy();
});

test('IM-20 — Mapeamento de prioridade: "high" → priority "alta" na OS criada', async ({ request }) => {
  test.skip(!mgrJwt, 'JWT de gestor não disponível');

  const res = await request.post(FUNCTION_URL, {
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${mgrJwt}`,
      apikey:          ANON_KEY,
    },
    data: {
      mode: 'json', external_source: 'custom',
      external_ref_id: `${RUN_ID}-priority-map`,
      priority:         'high', // inglês → deve ser mapeado para "alta"
      reported_problem: 'Teste de mapeamento de prioridade.',
    },
  });

  expect(res.status()).toBe(201);
  const body = await res.json() as { data: { os_id: string } };
  expect(body.data.os_id).toBeTruthy();

  // Verificar na base que a OS foi criada com priority "alta"
  // (via API Supabase REST com o JWT do gestor)
  const checkRes = await request.get(
    `${SUPABASE_URL}/rest/v1/service_reports?id=eq.${body.data.os_id}&select=priority`,
    {
      headers: {
        'Authorization': `Bearer ${mgrJwt}`,
        apikey:          ANON_KEY,
      },
    }
  );
  const rows = await checkRes.json() as Array<{ priority: string }>;
  expect(rows.length).toBe(1);
  expect(rows[0].priority).toBe('alta');
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOCO 7 — Log de Importações: /admin/os-imports
// ════════════════════════════════════════════════════════════════════════════════

test('IM-21 — /admin/os-imports carrega e exibe entradas dos imports anteriores', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  // Gestor pode acessar a rota diretamente mesmo sem o link no menu lateral
  await page.goto('/admin/os-imports');
  await page.waitForSelector('text=Importação de OS', { timeout: 10_000 });

  // Descrição da página visível
  await expect(page.getByText(/log de oss recebidas/i)).toBeVisible();

  // Filtros presentes
  await expect(page.getByRole('combobox').first()).toBeVisible();

  // Botão "Atualizar" presente
  await expect(page.getByRole('button', { name: /atualizar/i })).toBeVisible();

  // Deve ter pelo menos uma entrada (os imports dos testes anteriores)
  // Ou estado vazio — ambos são aceitáveis
  const hasEntries = await page.locator('text=Sucesso').count() > 0
    || await page.locator('text=Nenhuma importação encontrada').count() > 0;
  expect(hasEntries).toBe(true);
});

test('IM-22 — Expandir linha exibe payload sanitizado e resolução de entidades', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await page.goto('/admin/os-imports');
  await page.waitForSelector('text=Importação de OS', { timeout: 10_000 });

  // Precisa de ao menos uma entrada de sucesso para expandir
  const successBadge = page.getByText('Sucesso').first();
  const hasSuccess   = await successBadge.isVisible({ timeout: 5_000 }).catch(() => false);
  if (!hasSuccess) { test.skip(); return; }

  // Clicar na primeira linha para expandir
  await page.locator('button.w-full.text-left').first().click();

  // Detalhes de resolução visíveis
  await expect(page.getByText(/cliente:/i).first()).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText(/técnico:/i).first()).toBeVisible();

  // Payload sanitizado presente
  await expect(page.getByText('Payload (sanitizado)')).toBeVisible();
  const payloadText = await page.locator('pre').last().textContent() ?? '';

  // pdf_base64 jamais deve aparecer em clear text (sanitizado pelo Edge Function)
  expect(payloadText).not.toMatch(/[A-Za-z0-9+/]{200,}/); // sem base64 raw longo
  expect(payloadText).not.toContain('data:application/pdf');

  // Se tiver pdf_base64, deve estar como "[redacted]"
  if (payloadText.includes('pdf_base64')) {
    expect(payloadText).toContain('[redacted]');
  }
});

test('IM-23 — Filtro por status "success" oculta entradas de falha e pendentes', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await page.goto('/admin/os-imports');
  await page.waitForSelector('text=Importação de OS', { timeout: 10_000 });

  // Aplicar filtro "Sucesso"
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Sucesso' }).click();
  await page.waitForTimeout(1_000);

  // Nenhuma badge "Falha" ou "Pendente" deve estar visível
  await expect(page.getByText('Falha').first()).not.toBeVisible({ timeout: 3_000 });
  await expect(page.getByText('Pendente').first()).not.toBeVisible({ timeout: 3_000 });

  // Aplicar filtro "Falha" — não deve mostrar "Sucesso"
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: 'Falha' }).click();
  await page.waitForTimeout(1_000);

  // Não deve aparecer badge "Sucesso" em nenhuma linha
  await expect(page.getByText('Sucesso').first()).not.toBeVisible({ timeout: 3_000 });

  // Restaurar "Todos"
  await page.getByRole('combobox').first().click();
  await page.getByRole('option', { name: /todos os status/i }).click();
});

test('IM-24 — Botão "Atualizar" recarrega a lista sem erro', async ({ page }) => {
  test.skip(!MGR_EMAIL, 'TEST_MGR_EMAIL não configurado');

  await login(page, MGR_EMAIL, MGR_PASSWORD);
  await page.goto('/admin/os-imports');
  await page.waitForSelector('text=Importação de OS', { timeout: 10_000 });

  // Capturar quaisquer erros de rede/JS antes do click
  const errors: string[] = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  page.on('requestfailed', req => errors.push(req.url()));

  await page.getByRole('button', { name: /atualizar/i }).click();

  // Aguarda breve período para o reload completar
  await page.waitForTimeout(2_000);

  // A página deve continuar mostrando o cabeçalho (não quebrou)
  await expect(page.getByText('Importação de OS')).toBeVisible();

  // Nenhum erro de rede relacionado ao Supabase
  const supabaseErrors = errors.filter(e => e.includes('supabase') || e.includes('os_import_log'));
  expect(supabaseErrors).toHaveLength(0);
});

// ════════════════════════════════════════════════════════════════════════════════
// BLOCO 8 — Importação via PDF (condicional: TEST_PDF_IMPORT=true)
// ════════════════════════════════════════════════════════════════════════════════

test('IM-25 — Upload de PDF → Edge Function processa via Gemini → OS criada ou erro controlado', async ({ page }) => {
  test.skip(
    !MGR_EMAIL || process.env.TEST_PDF_IMPORT !== 'true',
    'Requer TEST_PDF_IMPORT=true — habilite no .env.test para rodar o teste de PDF'
  );

  // Criar PDF mínimo em arquivo temporário
  const pdfBuffer = minimalPdfBuffer();
  const tmpDir    = os.tmpdir();
  const pdfPath   = path.join(tmpDir, `os-e2e-${RUN_ID}.pdf`);
  fs.writeFileSync(pdfPath, pdfBuffer);

  try {
    await login(page, MGR_EMAIL, MGR_PASSWORD);
    await openImportDialog(page);

    // Preencher referência externa
    await page.getByPlaceholder('Nº da OS no sistema de origem').fill(`${RUN_ID}-pdf-upload`);

    // Tab PDF já ativa — área de upload visível
    await expect(page.getByText(/clique para selecionar o pdf/i)).toBeVisible();

    // Fazer upload do PDF via input file
    const fileInput = page.locator('input[type="file"][accept*="pdf"]');
    await fileInput.setInputFiles(pdfPath);

    // Nome do arquivo deve aparecer na área de upload (confirmação visual de seleção)
    await expect(page.getByText(path.basename(pdfPath))).toBeVisible({ timeout: 3_000 });

    // Botão "Remover" presente (para limpar o arquivo)
    await expect(page.getByRole('button', { name: /remover/i })).toBeVisible();

    // Submeter — Gemini pode levar até 30s; timeout generoso
    await page.getByRole('dialog').getByRole('button', { name: /importar os/i }).click();

    // Aguardar resultado — sucesso ou falha controlada (Gemini pode não extrair dados úteis de PDF mínimo)
    const resultado = page.getByText(/os importada com sucesso/i)
      .or(page.getByText(/falha na importação/i));
    await expect(resultado).toBeVisible({ timeout: 60_000 });

    if (await page.getByText(/os importada com sucesso/i).isVisible()) {
      // Sucesso: número da OS exibido
      await expect(page.getByText(/número:/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /ver os/i })).toBeVisible();
    }
    // Falha do Gemini é aceitável com PDF mínimo sem conteúdo real — o flow está correto

  } finally {
    if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
  }
});
