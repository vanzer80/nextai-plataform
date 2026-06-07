import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = (await import('./audit.config.mjs')).default;

const OUTPUT_DIR = path.join(__dirname, 'audit-output');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

const headed = process.argv.includes('--headed');

function log(msg) {
  process.stdout.write(`[${new Date().toISOString().slice(11, 19)}] ${msg}\n`);
}

async function ss(page, name) {
  const fname = name.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80) + '.png';
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, fname), fullPage: true }).catch(() => {});
  return fname;
}

// ─── WAIT FOR APP READY ───────────────────────────────────────────────────────
// Aguarda até o conteúdo real estar visível (sem skeleton/loading).
// minContent: mínimo de caracteres no body para considerar renderizado.
async function waitForAppReady(page, { timeout = CONFIG.appReadyTimeout, minContent = 80 } = {}) {
  await page.waitForFunction((minLen) => {
    const t = (document.body?.innerText || '').trim();
    const isAuthLoading = /autenticando sess|carregando\.\.\.|loading/i.test(t);
    return !isAuthLoading && t.length > minLen;
  }, minContent, { timeout }).catch(() => {
    // Timeout expirou: continuamos de qualquer forma (pode ser página vazia legítima)
  });
  // Aguardar estabilização de rede (máx 5s extra)
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
}

// ─── DISMISS MODALS ───────────────────────────────────────────────────────────
async function dismissModals(page) {
  for (const sel of [
    'button:has-text("Pular")',
    'button:has-text("Fechar")',
    'button:has-text("Skip")',
    '[aria-label="Fechar"]',
    '[aria-label="Close"]',
    'button:has-text("Entendido")',
  ]) {
    const btn = page.locator(sel).first();
    if (await btn.isVisible({ timeout: 500 }).catch(() => false)) {
      await btn.click({ timeout: 500 }).catch(() => {});
    }
  }
}

// ─── CAPTURA DE ERROS DOM (formulários) ──────────────────────────────────────
async function captureFormErrors(page) {
  return page.evaluate(() => {
    const sels = [
      '[role="alert"]',
      '.text-destructive',
      '[class*="FormMessage"]',
      '[class*="form-message"]',
      '[class*="error-message"]',
      '.text-red-500',
    ];
    const IGNORE = /política de privacidade|termos de uso|ao acessar a plataforma/i;
    const found = [];
    for (const sel of sels) {
      document.querySelectorAll(sel).forEach(el => {
        const t = (el.innerText || '').trim();
        if (t.length > 2 && t.length < 300 && !IGNORE.test(t))
          found.push({ selector: sel, text: t });
      });
    }
    // Deduplica por texto
    const seen = new Set();
    return found.filter(e => {
      if (seen.has(e.text)) return false;
      seen.add(e.text);
      return true;
    });
  }).catch(() => []);
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
async function performLogin(page, warmupTimeout = CONFIG.warmupTimeout) {
  await page.goto(CONFIG.baseUrl, { timeout: CONFIG.timeout, waitUntil: 'domcontentloaded' });
  // Aguardar o formulário aparecer (login page pode não ter "content > 80")
  await waitForAppReady(page, { timeout: warmupTimeout, minContent: 20 });
  const initialUrl = page.url();

  const emailSel = 'input[type="email"], input[name="email"], input[placeholder*="mail" i]';
  const passSel  = 'input[type="password"]';
  const submitSel = 'button[type="submit"], button:has-text("Entrar"), button:has-text("Acessar")';

  const emailInput = page.locator(emailSel).first();
  const passInput  = page.locator(passSel).first();
  const submitBtn  = page.locator(submitSel).first();

  const hasEmail = await emailInput.isVisible({ timeout: 8000 }).catch(() => false);
  const hasPass  = await passInput.isVisible({ timeout: 2000 }).catch(() => false);

  if (!hasEmail || !hasPass) {
    return { success: false, error: 'Login form fields not found', initialUrl, finalUrl: page.url(),
      screenshot: await ss(page, 'login-form-not-found') };
  }

  await emailInput.fill(CONFIG.credentials.email);
  await passInput.fill(CONFIG.credentials.password);
  await ss(page, 'login-filled');
  await submitBtn.click();

  try {
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 25000 });
  } catch {
    return { success: false, error: 'Still on login page after 25s',
      bodyText: await page.evaluate(() => document.body?.innerText?.slice(0, 400)).catch(() => ''),
      finalUrl: page.url(), screenshot: await ss(page, 'login-timeout') };
  }

  // WARM-UP: esperar app carregar completamente após login (acorda o Supabase)
  log('  Warm-up: waiting for app content after login...');
  await waitForAppReady(page, { timeout: warmupTimeout, minContent: 80 });
  await dismissModals(page);

  return { success: true, initialUrl, finalUrl: page.url(),
    screenshot: await ss(page, 'post-login') };
}

// ─── LOGIN ERROR STATES ───────────────────────────────────────────────────────
async function testLoginErrorStates(browser) {
  log('Phase 1 — Login error states');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const states = [];

  const gotoLogin = async () => {
    await page.goto(CONFIG.baseUrl + '/login', { timeout: CONFIG.timeout, waitUntil: 'domcontentloaded' })
      .catch(() => page.goto(CONFIG.baseUrl, { timeout: CONFIG.timeout, waitUntil: 'domcontentloaded' }));
    await waitForAppReady(page, { timeout: 20000, minContent: 20 });
  };

  const emailSel  = 'input[type="email"], input[name="email"]';
  const passSel   = 'input[type="password"]';
  const submitSel = 'button[type="submit"]';

  // Test 1 — empty submit
  log('  Test 1: empty submit');
  await gotoLogin();
  await page.locator(submitSel).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(2500); // react-hook-form valida sincronamente; aguardar rerender
  states.push({
    test: 'empty_submit',
    screenshot: await ss(page, 'login-empty-submit'),
    formErrors: await captureFormErrors(page),
    rawBodySnippet: await page.evaluate(() => document.body?.innerText?.slice(0, 600)).catch(() => ''),
  });

  // Test 2 — invalid email format
  log('  Test 2: invalid email format');
  await gotoLogin();
  await page.locator(emailSel).first().fill('notanemail').catch(() => {});
  await page.locator(passSel).first().fill('anything').catch(() => {});
  await page.locator(submitSel).first().click().catch(() => {});
  await page.waitForTimeout(2500);
  states.push({
    test: 'invalid_email',
    screenshot: await ss(page, 'login-invalid-email'),
    formErrors: await captureFormErrors(page),
    rawBodySnippet: await page.evaluate(() => document.body?.innerText?.slice(0, 600)).catch(() => ''),
  });

  // Test 3 — wrong credentials (async, espera resposta Supabase)
  log('  Test 3: wrong credentials');
  await gotoLogin();
  await page.locator(emailSel).first().fill('wrong@test.com').catch(() => {});
  await page.locator(passSel).first().fill('wrongpassword').catch(() => {});
  await page.locator(submitSel).first().click().catch(() => {});
  // Aguardar resposta do servidor (pode demorar no cold-start)
  await page.waitForTimeout(10000);
  states.push({
    test: 'wrong_credentials',
    screenshot: await ss(page, 'login-wrong-creds'),
    formErrors: await captureFormErrors(page),
    finalUrl: page.url(),
    rawBodySnippet: await page.evaluate(() => document.body?.innerText?.slice(0, 600)).catch(() => ''),
  });

  await ctx.close();
  return states;
}

// ─── ROUTE AUDITOR ────────────────────────────────────────────────────────────
async function auditRoute(page, route) {
  const entry = {
    route,
    url: CONFIG.baseUrl + route,
    finalUrl: null,
    finalPath: null,
    pageTitle: null,
    loadTimeMs: null,
    isRedirectedToLogin: false,
    isStaleRoute: false,          // rota redireciona para destino diferente (stale/não mapeada)
    staleRedirectsTo: null,
    consoleErrors: [],
    jsExceptions: [],
    networkErrors: [],
    axeViolations: [],
    axeError: null,
    interactiveElements: {},
    pageHeadings: [],
    performanceMetrics: null,
    screenshot: null,
    bodySnippet: null,
    error: null,
  };

  const consoleErrors = [], jsExceptions = [], networkErrors = [];
  const onConsole = m => { if (m.type() === 'error') consoleErrors.push({ text: m.text(), loc: m.location()?.url }); };
  const onException = e => jsExceptions.push(e.message);
  const onResponse = r => {
    if (r.status() >= 400 && !r.url().includes('favicon') && !r.url().includes('analytics')) {
      networkErrors.push({ url: r.url(), status: r.status(), method: r.request().method() });
    }
  };

  page.on('console', onConsole);
  page.on('pageerror', onException);
  page.on('response', onResponse);

  try {
    const t0 = Date.now();
    await page.goto(CONFIG.baseUrl + route, { timeout: CONFIG.timeout, waitUntil: 'domcontentloaded' });

    // Esperar conteúdo real (não skeleton)
    await waitForAppReady(page, { timeout: CONFIG.appReadyTimeout });
    entry.loadTimeMs = Date.now() - t0;

    entry.finalUrl  = page.url();
    entry.pageTitle = await page.title().catch(() => null);
    entry.finalPath = new URL(entry.finalUrl).pathname;

    // Classificar redirect
    entry.isRedirectedToLogin = entry.finalPath.includes('/login');
    const targetedPath = new URL(CONFIG.baseUrl + route).pathname;
    if (!entry.isRedirectedToLogin && !entry.finalPath.startsWith(targetedPath)) {
      entry.isStaleRoute = true;
      entry.staleRedirectsTo = entry.finalPath;
    }

    await dismissModals(page);

    // Snippet do conteúdo principal
    entry.bodySnippet = await page.evaluate(() => {
      const main = document.querySelector('main, [role="main"]');
      return (main?.innerText || document.body?.innerText || '').trim().slice(0, 500);
    }).catch(() => '');

    // Headings (estrutura semântica)
    entry.pageHeadings = await page.evaluate(() =>
      [...document.querySelectorAll('h1, h2, h3')].map(h => ({ tag: h.tagName, text: h.innerText.trim().slice(0, 80) }))
    ).catch(() => []);

    // Interactive elements
    entry.interactiveElements = await page.evaluate(() => ({
      buttons: document.querySelectorAll('button').length,
      links: document.querySelectorAll('a[href]').length,
      inputs: document.querySelectorAll('input, select, textarea').length,
      forms: document.querySelectorAll('form').length,
      tables: document.querySelectorAll('table, [role="table"], [role="grid"]').length,
      badges: document.querySelectorAll('[class*="badge"], [class*="Badge"]').length,
      toasts: document.querySelectorAll('[class*="toast"], [class*="sonner"]').length,
    })).catch(() => ({}));

    // Performance
    entry.performanceMetrics = await page.evaluate(() => {
      try {
        const nav = performance.getEntriesByType('navigation')[0];
        const paint = performance.getEntriesByType('paint');
        const fcp = paint.find(p => p.name === 'first-contentful-paint');
        const lcp = performance.getEntriesByType('largest-contentful-paint')?.slice(-1)[0];
        return {
          domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
          loadComplete: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
          fcp: fcp ? Math.round(fcp.startTime) : null,
          lcp: lcp ? Math.round(lcp.startTime) : null,
        };
      } catch { return null; }
    }).catch(() => null);

    // Screenshot
    entry.screenshot = await ss(page, 'route' + route.replace(/\//g, '-'));

    // Axe — só rodar se não for rota stale ou redirect
    if (!entry.isStaleRoute && !entry.isRedirectedToLogin) {
      try {
        const axeResult = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa'])
          .disableRules(['color-contrast'])
          .analyze();
        entry.axeViolations = axeResult.violations.map(v => ({
          id: v.id,
          impact: v.impact,
          help: v.help,
          helpUrl: v.helpUrl,
          nodes: v.nodes.length,
          nodeHtml: v.nodes.slice(0, 2).map(n => n.html),
        }));
      } catch (axeErr) {
        entry.axeError = axeErr.message.slice(0, 300);
      }
    }

  } catch (err) {
    entry.error = err.message.slice(0, 400);
    await ss(page, 'error-route' + route.replace(/\//g, '-')).catch(() => null);
  }

  page.off('console', onConsole);
  page.off('pageerror', onException);
  page.off('response', onResponse);

  entry.consoleErrors = consoleErrors;
  entry.jsExceptions  = jsExceptions;
  entry.networkErrors = networkErrors;
  return entry;
}

// ─── LEGACY ROUTES (stale check) ─────────────────────────────────────────────
async function auditLegacyRoutes(page) {
  log('Phase 4b — Legacy route staleness check');
  const results = {};
  for (const route of CONFIG.legacyRoutes) {
    log(`  legacy → ${route}`);
    await page.goto(CONFIG.baseUrl + route, { timeout: CONFIG.timeout, waitUntil: 'domcontentloaded' });
    await waitForAppReady(page, { timeout: 12000 });
    const finalUrl  = page.url();
    const finalPath = new URL(finalUrl).pathname;
    const targeted  = new URL(CONFIG.baseUrl + route).pathname;
    results[route] = {
      finalUrl,
      finalPath,
      isStale: !finalPath.startsWith(targeted),
      redirectsTo: finalPath !== targeted ? finalPath : null,
      screenshot: await ss(page, 'legacy' + route.replace(/\//g, '-')),
    };
  }
  return results;
}

// ─── NAV DISCOVERY ────────────────────────────────────────────────────────────
async function discoverNavRoutes(page) {
  // Garantir que o app está renderizado antes de inspecionar a nav
  await waitForAppReady(page, { timeout: CONFIG.appReadyTimeout });
  const routes = await page.evaluate(() => {
    const sels = ['nav a[href]', 'aside a[href]', '[role="navigation"] a[href]', '[data-sidebar] a[href]', '[class*="sidebar"] a[href]'];
    const links = sels.flatMap(s => [...document.querySelectorAll(s)]);
    return [...new Set(
      links.map(a => a.getAttribute('href'))
        .filter(h => h && h.startsWith('/') && !h.startsWith('//') && !h.includes('#'))
    )];
  }).catch(() => []);
  log(`  Discovered ${routes.length} nav routes: ${routes.slice(0, 8).join(', ')}...`);
  return routes;
}

// ─── RESPONSIVENESS ───────────────────────────────────────────────────────────
async function testResponsiveness(page) {
  log('Phase 5 — Responsiveness');
  const results = {};

  for (const route of CONFIG.responsiveRoutes) {
    results[route] = {};
    for (const width of CONFIG.breakpoints) {
      const height = Math.round(Math.max(width * 0.75, 600));
      await page.setViewportSize({ width, height });
      try {
        await page.goto(CONFIG.baseUrl + route, { timeout: CONFIG.timeout, waitUntil: 'domcontentloaded' });
        await waitForAppReady(page, { timeout: 15000 });
        await dismissModals(page);

        const metrics = await page.evaluate(() => {
          const docW = document.documentElement.scrollWidth;
          const vpW  = document.documentElement.clientWidth;
          // Detectar nav: sidebar pode ser [data-sidebar] ou aside ou nav
          const nav  = document.querySelector('[data-sidebar], aside, nav');
          const main = document.querySelector('main, [role="main"]');
          const h1   = document.querySelector('h1');
          return {
            hasHorizontalOverflow: docW > vpW + 5,
            navigationElement: nav?.tagName?.toLowerCase() || null,
            navigationDisplay: nav ? getComputedStyle(nav).display : null,
            mainContentPresent: !!main && main.innerText.trim().length > 30,
            h1Text: h1?.innerText?.trim().slice(0, 60) || null,
            bodyTextLength: document.body.innerText.trim().length,
          };
        }).catch(() => ({ hasHorizontalOverflow: null }));

        results[route][width] = {
          screenshot: await ss(page, `resp-${route.replace(/\//g, '-')}-w${width}`),
          ...metrics,
        };
      } catch (err) {
        results[route][width] = { error: err.message.slice(0, 200) };
      }
    }
    log(`  ✓ Responsiveness done: ${route}`);
  }

  await page.setViewportSize({ width: 1280, height: 800 });
  return results;
}

// ─── UNAUTHENTICATED ACCESS ───────────────────────────────────────────────────
async function testUnauthAccess(browser) {
  log('Phase 6 — Unauthenticated access');
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const results = {};

  const routesToTest = [
    '/dashboard', '/reports', '/clients', '/rh/employees', '/admin/usuarios',
    '/cp/payables', '/platform/tenants', '/admin/api-keys',
  ];

  for (const route of routesToTest) {
    try {
      await page.goto(CONFIG.baseUrl + route, { timeout: 25000, waitUntil: 'domcontentloaded' });
      // Não usar waitForAppReady aqui: queremos pegar o redirect imediato, não esperar conteúdo
      await page.waitForTimeout(3000);
      const finalUrl  = page.url();
      const finalPath = new URL(finalUrl).pathname;
      const redirected = finalPath.includes('login');
      results[route] = {
        finalUrl, redirectedToLogin: redirected,
        status: redirected ? 'protected' : 'EXPOSED',
        screenshot: await ss(page, `unauth${route.replace(/\//g, '-')}`),
      };
    } catch (err) {
      results[route] = { error: err.message.slice(0, 200) };
    }
  }

  await ctx.close();
  return results;
}

// ─── 404 PAGE ─────────────────────────────────────────────────────────────────
async function test404(page) {
  log('Phase 7 — 404 page');
  try {
    await page.goto(CONFIG.baseUrl + '/rota-que-nao-existe-xyz-9999', {
      timeout: CONFIG.timeout, waitUntil: 'domcontentloaded',
    });
    // Aguardar resolução total (para ver se tem 404 real ou redireciona para dashboard)
    await waitForAppReady(page, { timeout: 15000 });
    return {
      finalUrl: page.url(),
      finalPath: new URL(page.url()).pathname,
      pageTitle: await page.title().catch(() => null),
      bodySnippet: await page.evaluate(() => document.body?.innerText?.slice(0, 500)).catch(() => ''),
      has404Heading: await page.locator('h1:has-text("404"), h1:has-text("não encontrada"), h1:has-text("not found")').first().waitFor({ state: 'visible', timeout: 5000 }).then(() => true).catch(() => false),
      screenshot: await ss(page, '404-page'),
    };
  } catch (err) {
    return { error: err.message.slice(0, 200) };
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
log('Launching Chromium...');
const browser = await chromium.launch({
  headless: !headed,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const results = {
  timestamp: new Date().toISOString(),
  baseUrl: CONFIG.baseUrl,
  login: null,
  loginErrorStates: [],
  discoveredRoutes: [],
  legacyRoutes: {},
  routes: {},
  responsiveness: {},
  unauthenticated: {},
  notFound: null,
  performanceBaseline: null,
  summary: {},
};

// Phase 1 — Login error states (cold, contexto separado)
results.loginErrorStates = await testLoginErrorStates(browser);

// Phase 2 — Authenticated session
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();

log('Phase 2 — Login (warm-up incluído)');
results.login = await performLogin(page);

if (!results.login.success) {
  log('⛔ Login failed — skipping authenticated phases');
  log('   Error: ' + results.login.error);
} else {
  log('✅ Login OK — ' + results.login.finalUrl);
  log('   App content is ready (warm-up complete)');

  // Phase 3 — Discover routes (app já está renderizado pelo warm-up do login)
  log('Phase 3 — Route discovery');
  results.discoveredRoutes = await discoverNavRoutes(page);

  // Phase 4 — Audit all real routes
  log('Phase 4 — Route audit (real routes)');
  const allRoutes = [...new Set([...CONFIG.knownRoutes, ...results.discoveredRoutes])];
  log(`  Total routes to audit: ${allRoutes.length}`);

  for (const route of allRoutes) {
    log(`  → ${route}`);
    results.routes[route] = await auditRoute(page, route);
    const r = results.routes[route];

    if (r.isRedirectedToLogin) {
      log(`    ⚠ Kicked to login — re-authenticating`);
      const reLogin = await performLogin(page);
      if (!reLogin.success) { log('    ⛔ Re-login failed'); break; }
    } else if (r.isStaleRoute) {
      log(`    ↩ Stale: redirected to ${r.staleRedirectsTo}`);
    }
  }

  // Phase 4b — Legacy routes (PT names)
  results.legacyRoutes = await auditLegacyRoutes(page);

  // Phase 5 — Responsiveness
  results.responsiveness = await testResponsiveness(page);

  // Performance baseline
  log('Phase 5b — Performance baseline');
  await page.goto(CONFIG.baseUrl + '/dashboard', { timeout: CONFIG.timeout, waitUntil: 'load' });
  await waitForAppReady(page, { timeout: CONFIG.appReadyTimeout });
  results.performanceBaseline = await page.evaluate(() => {
    try {
      const nav  = performance.getEntriesByType('navigation')[0];
      const paint = performance.getEntriesByType('paint');
      const fcp  = paint.find(p => p.name === 'first-contentful-paint');
      const lcp  = performance.getEntriesByType('largest-contentful-paint')?.slice(-1)[0];
      return {
        domContentLoaded: nav ? Math.round(nav.domContentLoadedEventEnd - nav.startTime) : null,
        loadComplete: nav ? Math.round(nav.loadEventEnd - nav.startTime) : null,
        fcp: fcp ? Math.round(fcp.startTime) : null,
        lcp: lcp ? Math.round(lcp.startTime) : null,
        transferSize: nav ? nav.transferSize : null,
      };
    } catch { return null; }
  }).catch(() => null);
}

// Phase 6 — Unauthenticated
results.unauthenticated = await testUnauthAccess(browser);

// Phase 7 — 404
if (results.login.success) {
  results.notFound = await test404(page);
}

// Summary
const routeEntries = Object.values(results.routes);
const staleCount   = routeEntries.filter(r => r.isStaleRoute).length;
results.summary = {
  totalRoutesTested:      routeEntries.length,
  routesOK:               routeEntries.filter(r => !r.error && !r.isRedirectedToLogin && !r.isStaleRoute).length,
  routesStale:            staleCount,
  routesRedirectedToLogin: routeEntries.filter(r => r.isRedirectedToLogin).length,
  routesWithError:        routeEntries.filter(r => r.error).length,
  totalConsoleErrors:     routeEntries.reduce((a, r) => a + r.consoleErrors.length, 0),
  totalJsExceptions:      routeEntries.reduce((a, r) => a + r.jsExceptions.length, 0),
  totalNetworkErrors:     routeEntries.reduce((a, r) => a + r.networkErrors.length, 0),
  totalAxeViolations:     routeEntries.reduce((a, r) => a + r.axeViolations.length, 0),
  unauthExposed:          Object.values(results.unauthenticated).filter(r => r.status === 'EXPOSED').length,
  legacyRoutesStale:      Object.values(results.legacyRoutes).filter(r => r.isStale).length,
  screenshots:            fs.readdirSync(SCREENSHOTS_DIR).length,
};

await ctx.close();
await browser.close();

fs.writeFileSync(path.join(OUTPUT_DIR, 'results.json'), JSON.stringify(results, null, 2));

log('\n─────────────────────────────────────────────────────');
log('✅ AUDIT COMPLETE (v2 — real content)');
log(`   Routes OK        : ${results.summary.routesOK}/${results.summary.totalRoutesTested}`);
log(`   Routes stale     : ${results.summary.routesStale}`);
log(`   Console errors   : ${results.summary.totalConsoleErrors}`);
log(`   JS exceptions    : ${results.summary.totalJsExceptions}`);
log(`   Network errors   : ${results.summary.totalNetworkErrors}`);
log(`   Axe violations   : ${results.summary.totalAxeViolations}`);
log(`   Unauth exposed   : ${results.summary.unauthExposed}`);
log(`   Legacy stale     : ${results.summary.legacyRoutesStale}/${CONFIG.legacyRoutes.length}`);
log(`   Screenshots      : ${results.summary.screenshots}`);
log(`   Output           : audit/audit-output/results.json`);
log('─────────────────────────────────────────────────────\n');
log('Run "npm run report" to generate REPORT.md');
