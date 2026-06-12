/**
 * ai-proxy-contract.spec.ts — Testes de contrato da Edge Function ai-proxy
 *
 * Contexto: a v10 crashava no rate limiter (Deno.openKv fora do try/catch) e o
 * runtime respondia 500 SEM corsHeaders — browser bloqueava por CORS e o client
 * recebia FunctionsFetchError em todos os módulos de IA (armadilha #60).
 *
 * Estes testes garantem que TODA resposta da função carrega os headers CORS,
 * independente do caminho de código — é o invariante que pegaria a regressão.
 *
 *   AI-01  OPTIONS preflight → 200 com Allow-Origin (echo), Allow-Headers e Max-Age
 *   AI-02  POST sem Authorization → 401 (gateway verify_jwt) com CORS
 *   AI-03  POST anon com type desconhecido → 400 "Tipo desconhecido" com CORS
 *   AI-04  POST anon com body não-JSON → 400 "Invalid JSON" com CORS
 *   AI-05  POST receipt_images sem images → 400 de validação com CORS
 *   AI-06  POST receipt_images com 6 imagens → 400 (máx 5) com CORS
 *   AI-07  POST receipt_voice com transcript > 4000 chars → 400 com CORS
 *   AI-08  POST receipt_images com mimeType proibido → 400 com CORS
 *   AI-09  Origin fora do allowlist → resposta SEM Allow-Origin (browser bloquearia)
 *   AI-10  Origin localhost:3001 (dev) → Allow-Origin echo
 *   AI-11  POST execution sem rawInput → 400 de validação com CORS
 *   AI-12  POST execution com rawInput > 4000 chars → 400 com CORS
 *
 * Nenhum teste consome quota de Gemini/OpenAI — todos param na validação.
 */

import { test, expect, type APIResponse } from '@playwright/test';

const SUPABASE_URL = 'https://sksursvmgvxqbbdsztcd.supabase.co';
const ANON_KEY     = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNrc3Vyc3ZtZ3Z4cWJiZHN6dGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYwNDY2NDgsImV4cCI6MjA5MTYyMjY0OH0.0Yux9J3y5eLJ4qVN8VFy7Q-qivFiRwCJqPL4whj_YcE';
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/ai-proxy`;

const APP_ORIGIN = 'https://nextai-plataform.vercel.app';

const AUTH_HEADERS = {
  Authorization:  `Bearer ${ANON_KEY}`,
  apikey:         ANON_KEY,
  'Content-Type': 'application/json',
  Origin:         APP_ORIGIN,
};

// Invariante central (armadilha #60): nenhuma resposta sem CORS, em nenhum status.
// CORS por allowlist (v13): Allow-Origin ecoa a origem permitida, nunca '*'.
function expectCors(res: APIResponse, origin: string = APP_ORIGIN) {
  expect(res.headers()['access-control-allow-origin']).toBe(origin);
}

test.describe('ai-proxy — contrato CORS e validação', () => {
  test('AI-01: OPTIONS preflight retorna CORS completo com Max-Age', async ({ request }) => {
    const res = await request.fetch(FUNCTION_URL, { method: 'OPTIONS', headers: { Origin: APP_ORIGIN } });
    expect(res.status()).toBe(200);
    expectCors(res);
    expect(res.headers()['access-control-allow-headers']).toContain('authorization');
    expect(res.headers()['access-control-max-age']).toBe('86400');
    expect(res.headers()['vary']).toContain('Origin');
  });

  test('AI-02: POST sem Authorization retorna 401 do gateway', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, {
      headers: { 'Content-Type': 'application/json' },
      data: { type: 'ping' },
    });
    expect(res.status()).toBe(401); // verify_jwt do gateway rejeita antes da função
  });

  test('AI-03: type desconhecido retorna 400 com CORS', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, { headers: AUTH_HEADERS, data: { type: 'ping' } });
    expect(res.status()).toBe(400);
    expectCors(res);
    expect((await res.json()).error).toContain('Tipo desconhecido');
  });

  test('AI-04: body não-JSON retorna 400 com CORS', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, {
      headers: { ...AUTH_HEADERS, 'Content-Type': 'text/plain' },
      data: 'isto não é json',
    });
    expect(res.status()).toBe(400);
    expectCors(res);
    expect((await res.json()).error).toBe('Invalid JSON');
  });

  test('AI-05: receipt_images sem images retorna 400 de validação', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, {
      headers: AUTH_HEADERS,
      data: { type: 'receipt_images' },
    });
    expect(res.status()).toBe(400);
    expectCors(res);
    expect((await res.json()).error).toContain("'images'");
  });

  test('AI-06: mais de 5 imagens retorna 400', async ({ request }) => {
    const img = { base64: 'aGVsbG8=', mimeType: 'image/jpeg' };
    const res = await request.post(FUNCTION_URL, {
      headers: AUTH_HEADERS,
      data: { type: 'receipt_images', images: Array(6).fill(img) },
    });
    expect(res.status()).toBe(400);
    expectCors(res);
    expect((await res.json()).error).toContain('Máximo de 5');
  });

  test('AI-07: transcript acima de 4000 chars retorna 400', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, {
      headers: AUTH_HEADERS,
      data: { type: 'receipt_voice', transcript: 'x'.repeat(4001) },
    });
    expect(res.status()).toBe(400);
    expectCors(res);
    expect((await res.json()).error).toContain('4000');
  });

  test('AI-08: mimeType proibido retorna 400', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, {
      headers: AUTH_HEADERS,
      data: { type: 'receipt_images', images: [{ base64: 'aGVsbG8=', mimeType: 'image/gif' }] },
    });
    expect(res.status()).toBe(400);
    expectCors(res);
    expect((await res.json()).error).toContain('mimeType não suportado');
  });

  test('AI-09: Origin fora do allowlist não recebe Allow-Origin', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, {
      headers: { ...AUTH_HEADERS, Origin: 'https://site-malicioso.example.com' },
      data: { type: 'ping' },
    });
    expect(res.status()).toBe(400); // função responde normalmente...
    expect(res.headers()['access-control-allow-origin']).toBeUndefined(); // ...mas browser bloquearia a leitura
  });

  test('AI-10: Origin localhost:3001 (dev) é permitida', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, {
      headers: { ...AUTH_HEADERS, Origin: 'http://localhost:3001' },
      data: { type: 'ping' },
    });
    expect(res.status()).toBe(400);
    expectCors(res, 'http://localhost:3001');
  });

  test('AI-11: execution sem rawInput retorna 400 de validação', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, {
      headers: AUTH_HEADERS,
      data: { type: 'execution' },
    });
    expect(res.status()).toBe(400);
    expectCors(res);
    expect((await res.json()).error).toContain("'rawInput'");
  });

  test('AI-12: execution com rawInput acima de 4000 chars retorna 400', async ({ request }) => {
    const res = await request.post(FUNCTION_URL, {
      headers: AUTH_HEADERS,
      data: { type: 'execution', rawInput: 'x'.repeat(4001) },
    });
    expect(res.status()).toBe(400);
    expectCors(res);
    expect((await res.json()).error).toContain('4000');
  });
});
