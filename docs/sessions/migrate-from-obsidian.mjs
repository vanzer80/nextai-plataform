// Migração 1× do histórico de sessões do vault Obsidian para o repositório.
//
// Fatia o monólito `06 - Histórico de Sessões.md` em um arquivo Markdown por
// sessão (camada COLD, lida sob demanda) e gera `docs/HISTORY.md` (camada WARM,
// índice de uma linha por sessão, lido na retomada de sessão).
//
// Determinístico e idempotente: rodar de novo regenera os mesmos arquivos.
// Uso: node docs/sessions/migrate-from-obsidian.mjs

import fs from 'node:fs';
import path from 'node:path';

const SRC = 'C:\\cerebro\\Mopar Engenharia\\Projeto App Portal Mopar\\06 - Histórico de Sessões.md';
const REPO = 'C:\\dev\\portal-mopar';
const SESSIONS_DIR = path.join(REPO, 'docs', 'sessions');
const HISTORY = path.join(REPO, 'docs', 'HISTORY.md');

const deaccent = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function slugify(s) {
  return deaccent(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
}

// DD/MM/YYYY -> YYYY-MM-DD (primeira data encontrada no header)
function isoDate(header) {
  const m = header.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!m) return '';
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Remove a(s) data(s) DD/MM/YYYY do header para compor o nome do arquivo.
function headerForSlug(header) {
  return header.replace(/\d{1,2}\/\d{1,2}\/\d{4}/g, ' ');
}

// Extrai o primeiro hash de commit (7–40 hex) anunciado como "Commit(s):".
function findCommit(body) {
  const m = body.match(/[Cc]ommits?\s*:?\*{0,2}\s*`?([0-9a-f]{7,40})`?/);
  return m ? m[1] : '';
}

const raw = fs.readFileSync(SRC, 'utf8');

const firstIdx = raw.indexOf('\n## ');
if (firstIdx === -1) {
  console.error('Nenhum header "## " encontrado — abortando.');
  process.exit(1);
}
const body = raw.slice(firstIdx + 1);
const parts = body.split(/\n(?=## )/);

fs.mkdirSync(SESSIONS_DIR, { recursive: true });

const used = new Set();
const index = [];
let written = 0;

for (const part of parts) {
  const nl = part.indexOf('\n');
  const headerLine = (nl === -1 ? part : part.slice(0, nl)).replace(/^##\s*/, '').trim();
  if (!headerLine) continue;

  const rest = nl === -1 ? '' : part.slice(nl + 1);

  // Conteúdo do arquivo: header promovido a # e separador "---" final removido.
  let content = `# ${headerLine}\n${rest}`;
  content = content.replace(/\s*\n-{3,}\s*$/, '').trimEnd() + '\n';

  // Nome único derivado do header (sem a data).
  let base = slugify(headerForSlug(headerLine));
  if (!base) base = 'sessao';
  let file = `${base}.md`;
  let n = 2;
  while (used.has(file)) file = `${base}-${n++}.md`;
  used.add(file);

  fs.writeFileSync(path.join(SESSIONS_DIR, file), content, 'utf8');
  written++;

  index.push({ headerLine, file, date: isoDate(headerLine), commit: findCommit(part) });
}

// Índice WARM — preserva a ordem do arquivo origem (mais recente primeiro).
const lines = [];
lines.push('# Histórico de Sessões — Índice');
lines.push('');
lines.push('> Índice WARM da memória do projeto. Uma linha por sessão; o detalhe completo');
lines.push('> vive em `docs/sessions/<arquivo>.md` (camada COLD) e é lido **sob demanda**.');
lines.push('> A retomada de sessão lê este índice + `CLAUDE.md` + `git log` — não o detalhe inteiro.');
lines.push('>');
lines.push('> Migrado 1× do vault Obsidian em 2026-06-13. Daqui em diante o histórico é mantido aqui no repo.');
lines.push('');
lines.push(`**${index.length} sessões registradas.**`);
lines.push('');
for (const it of index) {
  const commit = it.commit ? ` — \`${it.commit}\`` : '';
  lines.push(`- [${it.headerLine}](sessions/${it.file})${commit}`);
}
lines.push('');
fs.writeFileSync(HISTORY, lines.join('\n'), 'utf8');

// Relatório para o log de execução (sem despejar conteúdo).
const noCommit = index.filter((i) => !i.commit).length;
console.log(`Sessões processadas: ${parts.length}`);
console.log(`Arquivos COLD escritos: ${written}`);
console.log(`Entradas no índice: ${index.length}`);
console.log(`Sessões sem commit detectado: ${noCommit}`);
console.log(`Índice: ${HISTORY}`);
console.log(`Diretório COLD: ${SESSIONS_DIR}`);
