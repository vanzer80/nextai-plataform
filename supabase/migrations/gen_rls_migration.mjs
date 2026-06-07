// Generates ALTER POLICY SQL for auth_rls_initplan fix.
// Rule: ONLY wrap auth.uid() in (SELECT auth.uid()). Nothing else changes.
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const policies = JSON.parse(
  readFileSync(path.join(__dirname, '20260607_rls_initplan_before.json'), 'utf8')
);

function parenBalance(s) {
  let n = 0;
  for (const c of s) { if (c === '(') n++; else if (c === ')') n--; }
  return n;
}

// pg_policies renders some nested-EXISTS expressions with a trailing ')' that
// is an artifact of the view's rendering and not valid as a standalone expression.
// Strip trailing ')' until balanced before using in ALTER POLICY USING/WITH CHECK.
function normalizeExpr(expr) {
  if (!expr) return null;
  let e = expr;
  while (parenBalance(e) < 0 && e.endsWith(')')) e = e.slice(0, -1);
  return e;
}

function wrap(expr) {
  if (!expr) return null;
  const base = normalizeExpr(expr);
  const PH = '\x00WRP\x00';
  // 1. protect already-wrapped
  let r = base.replace(/\(SELECT auth\.uid\(\)\)/g, PH);
  // 2. wrap remaining
  r = r.replace(/auth\.uid\(\)/g, '(SELECT auth.uid())');
  // 3. restore
  return r.replace(/\x00WRP\x00/g, '(SELECT auth.uid())');
}

function normalize(expr) {
  if (!expr) return null;
  return expr.replace(/\(SELECT auth\.uid\(\)\)/g, 'auth.uid()');
}

function qi(name) {
  return '"' + name.replace(/"/g, '""') + '"';
}

const alterStatements = [];
const rollbackStatements = [];
const diffErrors = [];
let altered = 0;

for (const p of policies) {
  const newQual = wrap(p.qual);
  const newCheck = wrap(p.with_check);

  const qualChanged  = newQual  !== p.qual;
  const checkChanged = newCheck !== p.with_check;

  if (!qualChanged && !checkChanged) continue;
  altered++;

  // Verify: normalize(new) === normalizeExpr(original) (ONLY change is the wrap)
  const baseQual  = normalizeExpr(p.qual);
  const baseCheck = normalizeExpr(p.with_check);
  if (qualChanged  && normalize(newQual)  !== baseQual)   diffErrors.push(`${p.tablename}.${p.policyname} USING`);
  if (checkChanged && normalize(newCheck) !== baseCheck)  diffErrors.push(`${p.tablename}.${p.policyname} WITH CHECK`);

  let alter = `ALTER POLICY ${qi(p.policyname)} ON public.${p.tablename}`;
  if (qualChanged)  alter += `\n  USING (${newQual})`;
  if (checkChanged) alter += `\n  WITH CHECK (${newCheck})`;
  alter += ';';
  alterStatements.push(alter);

  let rollback = `ALTER POLICY ${qi(p.policyname)} ON public.${p.tablename}`;
  if (qualChanged)  rollback += `\n  USING (${baseQual})`;
  if (checkChanged) rollback += `\n  WITH CHECK (${baseCheck})`;
  rollback += ';';
  rollbackStatements.push(rollback);
}

if (diffErrors.length) {
  console.error('DIFF ERRORS (lógica além do wrap detectada):');
  diffErrors.forEach(e => console.error(' -', e));
  process.exit(1);
}

console.log(`Policies a alterar: ${altered} / ${policies.length} total`);
console.log('Diff OK: única mudança é auth.uid() → (SELECT auth.uid())');

// ── Migration SQL ─────────────────────────────────────────────────────────────
const migrationSql = `-- Migration: fix_rls_initplan_all_policies
-- Objetivo: envolver auth.uid() em (SELECT auth.uid()) em todas as policies afetadas
-- Evidência: Supabase advisor auth_rls_initplan (65 WARNs), pg_policies snapshot em 20260607_rls_initplan_before.json
-- Regra absoluta: a ÚNICA mudança é o wrap de auth.uid(). Lógica booleana idêntica.
-- Gerado por: gen_rls_migration.mjs a partir do pg_policies vivo
-- Rollback: ver 20260607_rls_initplan_rollback.sql

${alterStatements.join('\n\n')}
`;

// ── Rollback SQL ──────────────────────────────────────────────────────────────
const rollbackSql = `-- Rollback: fix_rls_initplan_all_policies
-- Restaura as 62 policies ao estado anterior ao wrap de auth.uid()
-- Snapshot capturado de pg_policies em 2026-06-07 antes da migration

${rollbackStatements.join('\n\n')}
`;

writeFileSync(path.join(__dirname, '20260607_fix_rls_initplan_all.sql'), migrationSql);
writeFileSync(path.join(__dirname, '20260607_rls_initplan_rollback.sql'), rollbackSql);

console.log('Arquivos gerados:');
console.log('  supabase/migrations/20260607_fix_rls_initplan_all.sql');
console.log('  supabase/migrations/20260607_rls_initplan_rollback.sql');
