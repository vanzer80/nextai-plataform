import { chromium } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BASE = 'http://localhost:3001';
const SCREENSHOTS = path.join(__dirname, 'screenshots', 'onboarding');
fs.mkdirSync(SCREENSHOTS, { recursive: true });

async function shot(page: any, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOTS, `${name}.png`), fullPage: false });
  console.log(`📸 ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: false, slowMo: 600 });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();

  // ── Login como Gestor ───────────────────────────────────────────────────────
  await page.goto(BASE);
  await page.waitForURL(/\/login/, { timeout: 10000 });
  await page.fill('input[type="email"]', 'gestao@gmail.com');
  await page.fill('input[type="password"]', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  console.log('✅ Login OK');

  // ── Resetar onboarding para que o WelcomeModal apareça ─────────────────────
  const uid = await page.evaluate(() => {
    const keys = Object.keys(localStorage).filter(k => k.startsWith('onboarding_v1_done_'));
    keys.forEach(k => localStorage.removeItem(k));
    // Pegar uid do supabase session
    const session = Object.entries(localStorage)
      .find(([k]) => k.includes('auth-token') || k.includes('session'));
    return session ? 'cleared' : 'cleared (no session key found)';
  });
  console.log('🔄 Onboarding resetado:', uid);

  // Recarregar para trigger do modal (auth re-init + 1200ms timer)
  await page.reload();
  await page.waitForURL(/\/dashboard/, { timeout: 15000 });
  // Aguardar auth terminar (sumiu o spinner "Autenticando sessão...")
  await page.waitForSelector('text=Autenticando', { state: 'hidden', timeout: 10000 }).catch(() => {});
  // Aguardar dashboard renderizar (sidebar visível)
  await page.waitForSelector('[data-onboarding="nav-dashboard"]', { timeout: 10000 }).catch(() => {});
  await shot(page, '01-dashboard-carregado');

  // ── Welcome Modal (aparece 1200ms após mount do OnboardingProvider) ──────────
  const modal = page.locator('button:has-text("Fazer tour agora")');
  await modal.waitFor({ timeout: 8000 });
  await shot(page, '02-welcome-modal');
  console.log('✅ WelcomeModal apareceu');

  // ── Iniciar tour ─────────────────────────────────────────────────────────────
  await page.click('text=Fazer tour agora');
  await page.waitForTimeout(800);
  await shot(page, '03-tour-step1-nav-dashboard');

  // Avançar alguns steps para mostrar o tour em ação
  for (let i = 4; i <= 12; i++) {
    const nextBtn = page.locator('.driver-popover-next-btn, [class*="driver-next"]').first();
    if (await nextBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(700);
      await shot(page, `${String(i).padStart(2, '0')}-tour-step${i}`);
    } else {
      console.log(`⚠️  Next button não visível no step ${i}`);
      break;
    }
  }

  // Fechar o browser e mostrar resultado
  console.log('\n✅ Demo concluído. Screenshots em:', SCREENSHOTS);
  await browser.close();
})();
