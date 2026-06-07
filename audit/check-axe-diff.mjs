/**
 * Compara as violações axe do results.json com baseline-axe.json.
 * Falha somente em violações NOVAS de impacto critical ou serious.
 * Exit 0 = nenhuma violação nova → CI passa.
 * Exit 1 = há violações novas → CI falha.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const resultsPath  = path.join(__dirname, 'audit-output', 'results.json');
const baselinePath = path.join(__dirname, 'baseline-axe.json');

if (!fs.existsSync(resultsPath)) {
  console.error('❌ results.json not found — run npm run audit first');
  process.exit(1);
}
if (!fs.existsSync(baselinePath)) {
  console.error('❌ baseline-axe.json not found');
  process.exit(1);
}

const results  = JSON.parse(fs.readFileSync(resultsPath,  'utf-8'));
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf-8'));

// Build baseline set — key: "route::id"
const baselineSet = new Set(
  (baseline.violations || []).map(v => `${v.route}::${v.id}`)
);

// Collect all current violations from every audited route
const routes = Array.isArray(results.routes)
  ? results.routes
  : Object.values(results.routes);

const current = [];
for (const route of routes) {
  for (const v of (route.axeViolations || [])) {
    current.push({ route: route.route, id: v.id, impact: v.impact, help: v.help });
  }
}

// Classify as new or known
const newViolations = current.filter(
  v => !baselineSet.has(`${v.route}::${v.id}`)
);
const newCritical = newViolations.filter(
  v => v.impact === 'critical' || v.impact === 'serious'
);

console.log(`\nAxe diff report`);
console.log(`  Total current violations : ${current.length}`);
console.log(`  Known (baseline)         : ${current.length - newViolations.length}`);
console.log(`  New (not in baseline)    : ${newViolations.length}`);
console.log(`  New critical/serious     : ${newCritical.length}`);

if (newViolations.length > 0) {
  console.log('\nNew violations:');
  for (const v of newViolations) {
    const marker = (v.impact === 'critical' || v.impact === 'serious') ? '❌' : 'ℹ️';
    console.log(`  ${marker} [${v.impact}] ${v.id} — ${v.route}`);
    if (v.help) console.log(`       ${v.help}`);
  }
}

if (newCritical.length > 0) {
  console.log(`\n❌ ${newCritical.length} new critical/serious axe violation(s) — FAIL`);
  process.exit(1);
}

console.log('\n✅ No new critical/serious axe violations — PASS');
process.exit(0);
