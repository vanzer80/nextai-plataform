// Gera dist/precache-manifest.json após o build (vite build && node este_script).
// Lê dist/index.html e extrai os assets de BOOT (entry JS + CSS + vendors que o
// Vite injeta como <script>/<link>/modulepreload). O sw.js precacheia essa lista
// no install → o app boota offline em device novo. Os chunks lazy de rota seguem
// cacheados sob demanda (cache-first do fetch handler) quando o técnico os visita.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const DIST = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const indexPath = join(DIST, 'index.html');

if (!existsSync(indexPath)) {
  console.error('[precache] dist/index.html não encontrado — rode "vite build" antes.');
  process.exit(1);
}

const html = readFileSync(indexPath, 'utf-8');
const assets = [...new Set([...html.matchAll(/(?:src|href)="(\/assets\/[^"]+)"/g)].map((m) => m[1]))];

writeFileSync(join(DIST, 'precache-manifest.json'), JSON.stringify({ assets }, null, 2));
console.log(`✓ precache-manifest.json — ${assets.length} assets de boot`);
