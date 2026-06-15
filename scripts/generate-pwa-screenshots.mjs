// Captura screenshots de /login (rota pública, sem auth) em dois form factors
// para o manifest — habilita a UI de instalação rica do Chrome. Requer o dev
// server rodando. Reproduzível: `node scripts/generate-pwa-screenshots.mjs`.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SHOTS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'screenshots');
mkdirSync(SHOTS_DIR, { recursive: true });

const URL = process.env.SHOT_URL ?? 'http://localhost:3001/login';
const SHOTS = [
  { name: 'mobile-login.png', width: 390, height: 844 },
  { name: 'desktop-login.png', width: 1280, height: 720 },
];

const browser = await chromium.launch();
try {
  for (const s of SHOTS) {
    const page = await browser.newPage({ viewport: { width: s.width, height: s.height } });
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30_000 });
    await page.waitForSelector('input', { timeout: 15_000 }).catch(() => {});
    await page.screenshot({ path: join(SHOTS_DIR, s.name) });
    console.log(`✓ ${s.name.padEnd(22)} ${s.width}x${s.height}`);
    await page.close();
  }
} finally {
  await browser.close();
}
