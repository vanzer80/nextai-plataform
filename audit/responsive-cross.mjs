import { chromium, firefox, webkit } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONFIG = (await import('./audit.config.mjs')).default;

const OUTPUT_DIR   = path.join(__dirname, 'audit-output');
const RESP_DIR     = path.join(OUTPUT_DIR, 'responsive');
const SHOTS_DIR    = path.join(RESP_DIR, 'screenshots');
fs.mkdirSync(SHOTS_DIR, { recursive: true });

function log(msg) { process.stdout.write(`[${new Date().toISOString().slice(11,19)}] ${msg}\n`); }

async function ss(page, name) {
  const fname = name.replace(/[^a-z0-9_-]/gi, '_').slice(0, 90) + '.png';
  await page.screenshot({ path: path.join(SHOTS_DIR, fname), fullPage: true }).catch(() => {});
  return fname;
}

async function waitForAppReady(page, { timeout = 20000, minContent = 80 } = {}) {
  await page.waitForFunction((minLen) => {
    const t = (document.body?.innerText || '').trim();
    return !/autenticando sess|carregando\.\.\.|loading/i.test(t) && t.length > minLen;
  }, minContent, { timeout }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
}

async function loginAndSaveState(browser, browserName) {
  const ctx  = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  try {
    await page.goto(CONFIG.baseUrl, { timeout: CONFIG.timeout, waitUntil: 'domcontentloaded' });
    await waitForAppReady(page, { timeout: 45000, minContent: 20 });

    const emailInput = page.locator('input[type="email"], input[name="email"]').first();
    if (!await emailInput.isVisible({ timeout: 10000 }).catch(() => false)) {
      log(`  ⛔ [${browserName}] Form de login não encontrado`);
      await ctx.close(); return null;
    }
    await emailInput.fill(CONFIG.credentials.email);
    await page.locator('input[type="password"]').first().fill(CONFIG.credentials.password);
    await page.locator('button[type="submit"]').first().click();
    await page.waitForFunction(() => !window.location.pathname.includes('/login'), { timeout: 30000 });
    await waitForAppReady(page, { timeout: 35000, minContent: 80 });

    const state = await ctx.storageState();
    log(`  ✅ [${browserName}] Login OK`);
    await ctx.close(); return state;
  } catch (err) {
    log(`  ⛔ [${browserName}] Login falhou: ${err.message.slice(0, 120)}`);
    await ctx.close(); return null;
  }
}

async function testRoute(page, route, label) {
  try {
    await page.goto(CONFIG.baseUrl + route, { timeout: CONFIG.timeout, waitUntil: 'domcontentloaded' });
    await waitForAppReady(page, { timeout: 18000 });

    const metrics = await page.evaluate(() => {
      const docW  = document.documentElement.scrollWidth;
      const vpW   = document.documentElement.clientWidth;
      const h1    = document.querySelector('h1');
      const h1Rect = h1?.getBoundingClientRect();
      const hamburger = document.querySelector(
        '[aria-label="Menu principal"], button[aria-label*="menu"], button[aria-label*="Menu"]'
      );

      // Touch targets: interactive elements measured for < 44px (AAA) and < 24px (AA required)
      const interactives = Array.from(document.querySelectorAll('a, button, input, select, textarea, [role="button"], [role="link"]'));
      const visibleInteractives = interactives.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 1 && r.height > 1; // exclude hidden/1px inputs
      });
      const small = visibleInteractives.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width < 44 || r.height < 44;
      });
      const critical = visibleInteractives.filter(el => {
        const r = el.getBoundingClientRect();
        return r.width < 24 || r.height < 24;
      });

      // Fixed elements near bottom (iOS safe-area risk)
      const fixedBottom = Array.from(document.querySelectorAll('*')).filter(el => {
        const s = getComputedStyle(el);
        return s.position === 'fixed' && parseInt(s.bottom || '9999') < 100;
      }).length;

      return {
        hasHorizontalOverflow: docW > vpW + 5,
        overflowPx:            Math.max(0, docW - vpW),
        viewportWidth:         vpW,
        h1Text:                h1?.innerText?.trim().slice(0, 60) || null,
        h1Visible:             !!(h1Rect && h1Rect.width > 0 && h1Rect.top < window.innerHeight),
        hamburgerPresent:      !!hamburger,
        hamburgerVisible:      !!(hamburger && hamburger.getBoundingClientRect().width > 0),
        smallTouchTargets:     small.length,
        criticalTouchTargets:  critical.length,
        fixedBottomElements:   fixedBottom,
        bodyTextLength:        document.body.innerText.trim().length,
      };
    }).catch(() => ({ hasHorizontalOverflow: null, error: 'evaluate failed' }));

    const shot = await ss(page, `${label}${route.replace(/\//g, '-')}`);
    return { ...metrics, screenshot: shot };
  } catch (err) {
    return { error: err.message.slice(0, 200) };
  }
}

// ─── Device matrix ────────────────────────────────────────────────────────────

const ALL_DEVICES = [
  { name: 'iphone-se',    width: 375,  height: 667,  dpr: 2, isMobile: true,  touch: true  },
  { name: 'iphone-14',    width: 390,  height: 844,  dpr: 3, isMobile: true,  touch: true  },
  { name: 'ipad',         width: 768,  height: 1024, dpr: 2, isMobile: true,  touch: true  },
  { name: 'desktop-1280', width: 1280, height: 800,  dpr: 1, isMobile: false, touch: false },
  { name: 'desktop-1440', width: 1440, height: 900,  dpr: 1, isMobile: false, touch: false },
  { name: 'desktop-1920', width: 1920, height: 1080, dpr: 1, isMobile: false, touch: false },
];

// Firefox doesn't support isMobile/hasTouch — desktop profiles only
const FIREFOX_DEVICES = ALL_DEVICES.filter(d => !d.isMobile);

const BROWSERS = [
  { name: 'chromium', launcher: chromium, args: ['--no-sandbox', '--disable-dev-shm-usage'], devices: ALL_DEVICES },
  { name: 'firefox',  launcher: firefox,  args: [],                                          devices: FIREFOX_DEVICES },
  { name: 'webkit',   launcher: webkit,   args: [],                                          devices: ALL_DEVICES },
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const results = {
  timestamp: new Date().toISOString(),
  baseUrl:   CONFIG.baseUrl,
  routes:    CONFIG.responsiveRoutes,
  browsers:  BROWSERS.map(b => ({ name: b.name, devices: b.devices.map(d => d.name) })),
  data:      {},
  summary:   { overflows: [], loginFailures: [], errors: [], smallTouchByBrowser: {}, criticalTouchByBrowser: {} },
};

for (const { name: bName, launcher, args, devices } of BROWSERS) {
  log(`\n── Browser: ${bName} (${devices.length} devices) ──────────────────────────────`);
  results.data[bName] = {};

  let browser;
  try {
    browser = await launcher.launch({ headless: true, args });
  } catch (err) {
    log(`  ⛔ Não foi possível lançar ${bName}: ${err.message.slice(0, 80)}`);
    continue;
  }

  log(`  Login (${bName})...`);
  const authState = await loginAndSaveState(browser, bName);
  if (!authState) {
    results.summary.loginFailures.push(bName);
    await browser.close(); continue;
  }

  const supportsIsMobile = bName !== 'firefox';

  for (const dev of devices) {
    log(`  Device: ${dev.name} (${dev.width}×${dev.height})`);
    results.data[bName][dev.name] = {};

    const ctx = await browser.newContext({
      viewport:          { width: dev.width, height: dev.height },
      deviceScaleFactor: dev.dpr,
      ...(supportsIsMobile ? { isMobile: dev.isMobile, hasTouch: dev.touch } : {}),
      storageState: authState,
    });
    const page = await ctx.newPage();

    // Hydrate session
    await page.goto(CONFIG.baseUrl + '/dashboard', { timeout: CONFIG.timeout, waitUntil: 'domcontentloaded' })
      .catch(() => {});
    await waitForAppReady(page, { timeout: 20000 }).catch(() => {});

    for (const route of CONFIG.responsiveRoutes) {
      log(`    → ${route}`);
      const label = `${bName}-${dev.name}`;
      const r = await testRoute(page, route, label);
      results.data[bName][dev.name][route] = r;

      if (r.hasHorizontalOverflow)
        results.summary.overflows.push({ browser: bName, device: dev.name, route, overflowPx: r.overflowPx });
      if (r.error)
        results.summary.errors.push({ browser: bName, device: dev.name, route, error: r.error });
    }
    await ctx.close();
  }

  // Aggregate max smallTouchTargets and criticalTouchTargets per browser
  let maxSmall = 0, maxCritical = 0;
  for (const dev of devices)
    for (const route of CONFIG.responsiveRoutes) {
      const r = results.data[bName]?.[dev.name]?.[route];
      if ((r?.smallTouchTargets ?? 0) > maxSmall) maxSmall = r.smallTouchTargets;
      if ((r?.criticalTouchTargets ?? 0) > maxCritical) maxCritical = r.criticalTouchTargets;
    }
  results.summary.smallTouchByBrowser[bName]    = maxSmall;
  results.summary.criticalTouchByBrowser[bName] = maxCritical;

  await browser.close();
}

// ─── Save JSON ────────────────────────────────────────────────────────────────

fs.writeFileSync(path.join(RESP_DIR, 'responsive-results.json'), JSON.stringify(results, null, 2));

// ─── Generate REPORT-responsive.md ───────────────────────────────────────────

const ROUTES = CONFIG.responsiveRoutes;
const STATUS_ICON = (r) => {
  if (!r || r.error) return '⚠️ erro';
  if (r.hasHorizontalOverflow) return `❌ overflow +${r.overflowPx}px`;
  return '✅';
};

let md = `# Responsive Cross-Browser Report\n\n`;
md += `**Gerado:** ${new Date().toISOString()}\n`;
md += `**Base URL:** ${CONFIG.baseUrl}\n\n`;
md += `## Matriz motor × device × rota\n\n`;

for (const { name: bName, devices } of BROWSERS) {
  if (!results.data[bName]) continue;
  md += `### ${bName.toUpperCase()}\n\n`;
  const cols = ['Device', ...ROUTES.map(r => r.replace('/', ''))].join(' | ');
  const sep  = ['---', ...ROUTES.map(() => '---')].join(' | ');
  md += `| ${cols} |\n| ${sep} |\n`;
  for (const dev of devices) {
    const cells = ROUTES.map(route => STATUS_ICON(results.data[bName]?.[dev.name]?.[route]));
    md += `| ${dev.name} | ${cells.join(' | ')} |\n`;
  }
  md += '\n';
}

md += `## Métricas por motor\n\n`;
md += `| Motor | Overflows | Touch <44px AAA (máx) | Touch <24px AA (máx) | Login |\n`;
md += `| --- | --- | --- | --- | --- |\n`;
for (const { name: bName } of BROWSERS) {
  const ov   = results.summary.overflows.filter(x => x.browser === bName).length;
  const sm   = results.summary.smallTouchByBrowser[bName] ?? 'N/A';
  const cr   = results.summary.criticalTouchByBrowser[bName] ?? 'N/A';
  const fail = results.summary.loginFailures.includes(bName) ? '❌' : '✅';
  const crIcon = (typeof cr === 'number' && cr === 0) ? '✅ 0' : `❌ ${cr}`;
  md += `| ${bName} | ${ov === 0 ? '✅ 0' : `❌ ${ov}`} | ${sm} | ${crIcon} | ${fail} |\n`;
}

md += `\n## h1 / Hambúrguer — WebKit mobile\n\n`;
md += `| Device | Rota | h1 visível | Hambúrguer presente |\n`;
md += `| --- | --- | --- | --- |\n`;
const wkData = results.data['webkit'] || {};
for (const dev of ALL_DEVICES.filter(d => d.isMobile)) {
  for (const route of ROUTES) {
    const r = wkData?.[dev.name]?.[route];
    if (!r) continue;
    md += `| ${dev.name} | ${route} | ${r.h1Visible ? '✅' : (r.h1Text ? '⚠️ presente/fora da viewport' : '❌ ausente')} | ${r.hamburgerVisible ? '✅' : (r.hamburgerPresent ? '⚠️ presente/oculto' : '—')} |\n`;
  }
}

md += `\n## Overflows detalhados\n\n`;
if (results.summary.overflows.length === 0) {
  md += `✅ Nenhum overflow horizontal detectado.\n\n`;
} else {
  md += `| Motor | Device | Rota | Overflow (px) |\n| --- | --- | --- | --- |\n`;
  for (const o of results.summary.overflows)
    md += `| ${o.browser} | ${o.device} | ${o.route} | +${o.overflowPx} |\n`;
  md += '\n';
}

md += `## Erros de avaliação\n\n`;
if (results.summary.errors.length === 0) {
  md += `✅ Nenhum erro de avaliação.\n\n`;
} else {
  for (const e of results.summary.errors)
    md += `- **${e.browser}** / ${e.device} / ${e.route}: ${e.error}\n`;
}

md += `## Veredito\n\n`;
const totalOverflows = results.summary.overflows.length;
const totalErrors    = results.summary.errors.length;
const wkOv = results.summary.overflows.filter(x => x.browser === 'webkit').length;
if (totalOverflows === 0 && totalErrors === 0) {
  md += `✅ **Zero overflows** em todos os motores × devices × rotas.\n`;
  md += `✅ **WebKit coberto** (proxy Safari/iOS): iPhone SE, iPhone 14, iPad — layouts íntegros.\n`;
  md += `✅ **Firefox coberto** (desktop 1280/1440/1920): sem regressões exclusivas.\n`;
  md += `\n> Ressalva: emulação WebKit é proxy confiável de Safari/iOS mas não substitui device farm real (BrowserStack/Sauce Labs) para certificação final.\n`;
} else {
  md += `⚠️ Foram encontrados ${totalOverflows} overflow(s) e ${totalErrors} erro(s). Detalhes nas seções acima.\n`;
  if (wkOv > 0) md += `❌ **WebKit** tem ${wkOv} overflow(s) exclusivos — investigar antes de declarar Safari/iOS compatível.\n`;
}

fs.writeFileSync(path.join(RESP_DIR, 'REPORT-responsive.md'), md);

// ─── Console summary ──────────────────────────────────────────────────────────

const totalDevices = BROWSERS.reduce((s, b) => s + b.devices.length, 0);
log('\n═══════════════════════════════════════════════════════');
log('✅ RESPONSIVE CROSS-BROWSER COMPLETE');
log(`   Motores      : ${BROWSERS.length} (${BROWSERS.map(b => b.name).join(', ')})`);
log(`   Devices      : chromium=${ALL_DEVICES.length}, firefox=${FIREFOX_DEVICES.length}, webkit=${ALL_DEVICES.length}`);
log(`   Rotas        : ${ROUTES.length}`);
log(`   Overflows    : ${results.summary.overflows.length}`);
log(`   Login falhas : ${results.summary.loginFailures.length}`);
log(`   Outros erros : ${results.summary.errors.length}`);
log(`   Touch <44px  : ${JSON.stringify(results.summary.smallTouchByBrowser)}`);
log(`   Touch <24px  : ${JSON.stringify(results.summary.criticalTouchByBrowser)}`);
log(`   Output       : audit/audit-output/responsive/`);
log('═══════════════════════════════════════════════════════');
