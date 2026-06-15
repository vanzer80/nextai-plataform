// Rasteriza public/icons/icon.svg em PNGs do manifest usando o Chromium do
// Playwright (já presente como devDependency) — evita adicionar sharp/canvas.
// Reproduzível: `node scripts/generate-pwa-icons.mjs`.
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ICONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(ICONS_DIR, { recursive: true });

// Logo "N" do NextAI — mesmas coordenadas de public/icons/icon.svg (fonte única).
const LOGO = (fill) => `
    <polygon points="27.5,21 44.5,21 34.5,141 17.5,141" fill="${fill}"/>
    <polygon points="117.5,21 134.5,21 124.5,141 107.5,141" fill="${fill}"/>
    <polygon points="37,25 52,17 115,137 100,145" fill="${fill}"/>`;

// Ícone completo: fundo sólido arredondado (purpose "any").
const FULL_SVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="#0F172A"/>
  <g transform="translate(96.5,86) scale(2.1)">${LOGO('#2563EB')}</g>
</svg>`;

// Badge da status bar do Android: monocromático — só o alpha é usado pela
// plataforma, então logo branco sobre fundo transparente.
const BADGE_SVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
  <g transform="translate(96.5,86) scale(2.1)">${LOGO('#FFFFFF')}</g>
</svg>`;

const RASTERS = [
  { name: 'icon-192.png', size: 192, svg: FULL_SVG, omitBackground: false },
  { name: 'icon-512.png', size: 512, svg: FULL_SVG, omitBackground: false },
  { name: 'apple-touch-icon-180.png', size: 180, svg: FULL_SVG, omitBackground: false },
  { name: 'badge-72.png', size: 72, svg: BADGE_SVG, omitBackground: true },
];

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const r of RASTERS) {
    await page.setViewportSize({ width: r.size, height: r.size });
    await page.setContent(
      `<!doctype html><meta charset="utf-8">` +
        `<style>*{margin:0;padding:0}html,body{width:${r.size}px;height:${r.size}px}</style>` +
        r.svg(r.size),
      { waitUntil: 'networkidle' }
    );
    const buf = await page.screenshot({
      omitBackground: r.omitBackground,
      clip: { x: 0, y: 0, width: r.size, height: r.size },
    });
    writeFileSync(join(ICONS_DIR, r.name), buf);
    console.log(`✓ ${r.name.padEnd(28)} ${r.size}px  ${buf.length} bytes`);
  }
  await page.close();
} finally {
  await browser.close();
}
