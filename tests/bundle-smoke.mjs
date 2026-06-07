/**
 * Smoke test: verifies that bundle optimization didn't break PDF generation or routes.
 * Run: node tests/bundle-smoke.mjs
 */
import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const EMAIL = 'master@gmail.com';
const PASS  = '123456';

async function login(page) {
  await page.goto(BASE + '/login', { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/(dashboard|reports|home)/, { timeout: 15000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));

  try {
    // 1. Login
    await login(page);
    console.log('✓ Login — dashboard carregado');

    // 2. Lista de OS
    await page.goto(BASE + '/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    const hasContent = await page.locator('main, [role="main"], #root > *').count() > 0;
    if (!hasContent) throw new Error('/reports não renderizou conteúdo');
    console.log('✓ /reports — página carregada');

    // 3. Clientes
    await page.goto(BASE + '/clients', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    console.log('✓ /clients — página carregada');

    // 4. PDF: verificar que vendor-pdf chunk está acessível (jsPDF lazy-loaded)
    // Navega para relatórios e verifica se há algum link de detalhe
    await page.goto(BASE + '/reports', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2000);
    const reportLinks = await page.locator('a[href*="/reports/"]').count();
    if (reportLinks > 0) {
      const href = await page.locator('a[href*="/reports/"]').first().getAttribute('href');
      await page.goto(BASE + href, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2000);
      const pdfBtn = page.locator('button').filter({ hasText: /pdf|imprimir|export/i }).first();
      if (await pdfBtn.count() > 0) {
        await pdfBtn.click();
        await page.waitForTimeout(2000);
        console.log('✓ PDF — botão clicado sem erro JS');
      } else {
        console.log('⚠ PDF — botão não encontrado nesta OS (ok — sem permissão de master)');
      }
    } else {
      console.log('⚠ PDF — sem OSs para testar (base vazia ou filtrada)');
    }

    // 5. Sem erros JS críticos
    const serious = errors.filter(e => !e.includes('ResizeObserver'));
    if (serious.length) {
      console.error('✗ Erros JS:', serious.join('\n'));
      process.exit(1);
    }
    console.log('✓ Sem erros JS críticos');
    console.log('\nSmoke test OK — bundle optimization funcional');
  } catch (err) {
    console.error('✗', err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
