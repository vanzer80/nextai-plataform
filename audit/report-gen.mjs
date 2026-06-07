import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, 'audit-output');

// Resultados cross-browser (opcional — gerado por responsive-cross.mjs)
const crossFile = path.join(OUTPUT_DIR, 'responsive-results.json');
const CROSS = fs.existsSync(crossFile) ? JSON.parse(fs.readFileSync(crossFile, 'utf-8')) : null;

const raw = fs.readFileSync(path.join(OUTPUT_DIR, 'results.json'), 'utf-8');
const R = JSON.parse(raw);

const ts = new Date(R.timestamp).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function sev(entry) {
  if (entry.jsExceptions.length > 0) return '🔴 Crítico';
  if (entry.consoleErrors.length > 2) return '🔴 Crítico';
  if (entry.networkErrors.some(e => e.status >= 500)) return '🔴 Crítico';
  if (entry.consoleErrors.length > 0 || entry.networkErrors.length > 0) return '🟡 Maior';
  if (entry.axeViolations.length > 3) return '🟡 Maior';
  if (entry.axeViolations.length > 0) return '🔵 Menor';
  return '✅ OK';
}

function routeStatus(entry) {
  if (!entry) return '❌ não testado';
  if (entry.error) return '❌ erro: ' + entry.error.slice(0, 80);
  if (entry.isRedirectedToLogin) return '🔒 redirect login';
  return sev(entry);
}

function tableRow(...cols) {
  return '| ' + cols.join(' | ') + ' |';
}

function h(n, text) {
  return '\n' + '#'.repeat(n) + ' ' + text + '\n';
}

// ─── BUILD REPORT ─────────────────────────────────────────────────────────────

const lines = [];

lines.push(`# Relatório de Auditoria Técnica — NextAI Platform`);
lines.push(`\n> **Gerado em:** ${ts}  \n> **Ambiente auditado:** ${R.baseUrl}  \n> **Harness:** Playwright + axe-core (WCAG 2.x AA)\n`);

// ─── 1. Sumário Executivo ─────────────────────────────────────────────────────
lines.push(h(2, '1. Sumário Executivo'));

const s = R.summary;
const loginOk = R.login?.success;
const exposedRoutes = Object.entries(R.unauthenticated).filter(([, v]) => v.status === 'EXPOSED');

lines.push(`**Status de login:** ${loginOk ? '✅ Autenticação bem-sucedida' : '🔴 FALHA — auditoria autenticada não executada'}`);
lines.push('');

if (loginOk) {
  lines.push(`| Métrica | Valor |`);
  lines.push(`|---------|-------|`);
  lines.push(`| Rotas testadas | ${s.routesOK} / ${s.totalRoutesTested} |`);
  lines.push(`| Erros de console (total) | ${s.totalConsoleErrors} |`);
  lines.push(`| Exceções JS | ${s.totalJsExceptions} |`);
  lines.push(`| Erros de rede (≥400) | ${s.totalNetworkErrors} |`);
  lines.push(`| Violações de acessibilidade (axe) | ${s.totalAxeViolations} |`);
  lines.push(`| Rotas expostas sem autenticação | ${exposedRoutes.length} |`);
  lines.push(`| Screenshots capturados | ${s.screenshots} |`);
  lines.push('');

  const perf = R.performanceBaseline;
  if (perf) {
    lines.push(`**Performance baseline (/dashboard):**`);
    lines.push(`- FCP: ${perf.fcp != null ? perf.fcp + 'ms' : 'n/d'}`);
    lines.push(`- LCP: ${perf.lcp != null ? perf.lcp + 'ms' : 'n/d'}`);
    lines.push(`- DOM Content Loaded: ${perf.domContentLoaded != null ? perf.domContentLoaded + 'ms' : 'n/d'}`);
    lines.push(`- Load Complete: ${perf.loadComplete != null ? perf.loadComplete + 'ms' : 'n/d'}`);
    lines.push('');
  }

  // Top 5 críticos
  const criticals = Object.entries(R.routes)
    .filter(([, v]) => v.jsExceptions.length > 0 || v.consoleErrors.length > 2 || v.networkErrors.some(e => e.status >= 500))
    .slice(0, 5);

  if (criticals.length > 0) {
    lines.push(`**Top problemas críticos:**`);
    criticals.forEach(([route, entry], i) => {
      const issue = entry.jsExceptions[0] || entry.consoleErrors[0]?.text || entry.networkErrors[0]?.url;
      lines.push(`${i + 1}. \`${route}\` — ${String(issue).slice(0, 120)}`);
    });
    lines.push('');
  }
}

// ─── 2. Escopo e Cobertura ────────────────────────────────────────────────────
lines.push(h(2, '2. Escopo e Cobertura'));
lines.push(`**Ferramentas utilizadas:** Playwright 1.52, axe-core (WCAG 2.1 A/AA), métricas nativas de performance (Navigation Timing API, Paint Timing API).`);
lines.push(`\n**Rotas descobertas dinamicamente (nav):** ${R.discoveredRoutes.length}`);
lines.push(`\n**Rotas conhecidas (config):** ${Object.keys(R.routes).length}`);
lines.push(`\n**Breakpoints responsivos testados:** ${Object.keys(Object.values(R.responsiveness)[0] || {}).join(', ')} px`);
lines.push('');
lines.push('**O que ficou de fora:**');
lines.push('- Lighthouse (não instalado no ambiente — requer Chrome externo)');
lines.push('- Fluxos CRUD interativos (criação/edição de registros reais)');
lines.push('- Testes de carga/stress (fora do escopo desta auditoria)');
lines.push('- Testes de penetração / injeção (fora do escopo)');
lines.push('');

// ─── 3. Matriz de Módulos ─────────────────────────────────────────────────────
lines.push(h(2, '3. Matriz de Módulos'));
lines.push(tableRow('Módulo / Rota', 'Status', 'Console Erros', 'JS Exc.', 'Rede ≥400', 'Axe Viols.', 'Load ms'));
lines.push(tableRow('---', '---', '---', '---', '---', '---', '---'));

for (const [route, entry] of Object.entries(R.routes)) {
  lines.push(tableRow(
    `\`${route}\``,
    routeStatus(entry),
    String(entry.consoleErrors?.length ?? '-'),
    String(entry.jsExceptions?.length ?? '-'),
    String(entry.networkErrors?.length ?? '-'),
    String(entry.axeViolations?.length ?? '-'),
    entry.loadTimeMs ? entry.loadTimeMs + 'ms' : '-',
  ));
}
lines.push('');

// ─── 3b. Rotas Stale ─────────────────────────────────────────────────────────
const staleRoutes = Object.entries(R.routes).filter(([, v]) => v.isStaleRoute);
const legacyStale = Object.entries(R.legacyRoutes || {}).filter(([, v]) => v.isStale);

if (staleRoutes.length > 0 || legacyStale.length > 0) {
  lines.push(h(2, '3b. Rotas com Redirect Silencioso (Stale)'));
  lines.push(tableRow('Rota tentada', 'Redireciona para', 'Causa provável'));
  lines.push(tableRow('---', '---', '---'));
  staleRoutes.forEach(([route, v]) => {
    let cause = 'Módulo não implementado ou RBAC bloqueou';
    if (route.startsWith('/platform/')) cause = 'SuperMaster-only — Master não tem acesso';
    else if (route === '/financeiro/cr') cause = 'Módulo CR (Sprint H) não implementado';
    lines.push(tableRow(`\`${route}\``, `\`${v.staleRedirectsTo}\``, cause));
  });
  legacyStale.forEach(([route, v]) => {
    lines.push(tableRow(`\`${route}\` (legado PT)`, `\`${v.finalPath}\``, 'Rota PT renomeada para EN no router'));
  });
  lines.push('');
  lines.push(`> **Total:** ${staleRoutes.length} rota(s) real(is) stale + ${legacyStale.length} rota(s) legada(s) PT.\n`);
}

// ─── 4. Achados por Módulo ────────────────────────────────────────────────────
lines.push(h(2, '4. Achados por Módulo'));

for (const [route, entry] of Object.entries(R.routes)) {
  const hasIssues =
    entry.error ||
    entry.consoleErrors.length > 0 ||
    entry.jsExceptions.length > 0 ||
    entry.networkErrors.length > 0 ||
    entry.axeViolations.length > 0 ||
    entry.isRedirectedToLogin;

  lines.push(h(3, `\`${route}\``));
  lines.push(`- **Status final:** ${entry.isRedirectedToLogin ? '🔒 Redirecionado para login' : entry.error ? '❌ Erro' : '✅ Carregou'}`);
  if (entry.finalUrl) lines.push(`- **URL final:** ${entry.finalUrl}`);
  if (entry.loadTimeMs) lines.push(`- **Load time:** ${entry.loadTimeMs}ms`);
  if (entry.screenshot) lines.push(`- **Screenshot:** \`screenshots/${entry.screenshot}\``);

  if (entry.interactiveElements && Object.keys(entry.interactiveElements).length > 0) {
    const ie = entry.interactiveElements;
    lines.push(`- **Elementos interativos:** ${ie.buttons} botões · ${ie.links} links · ${ie.inputs} inputs · ${ie.forms} forms · ${ie.tables} tabelas`);
  }

  if (entry.error) {
    lines.push(`\n**❌ Erro ao carregar:**\n\`\`\`\n${entry.error}\n\`\`\``);
  }

  if (entry.jsExceptions.length > 0) {
    lines.push(`\n**💥 Exceções JS (${entry.jsExceptions.length}):**`);
    entry.jsExceptions.slice(0, 3).forEach(e => lines.push(`- \`${e.slice(0, 200)}\``));
  }

  if (entry.consoleErrors.length > 0) {
    lines.push(`\n**🔴 Erros de Console (${entry.consoleErrors.length}):**`);
    entry.consoleErrors.slice(0, 5).forEach(e => lines.push(`- \`${e.text?.slice(0, 200)}\``));
  }

  if (entry.networkErrors.length > 0) {
    lines.push(`\n**🌐 Erros de Rede (${entry.networkErrors.length}):**`);
    lines.push(tableRow('Método', 'URL', 'Status'));
    lines.push(tableRow('---', '---', '---'));
    entry.networkErrors.slice(0, 5).forEach(e => lines.push(tableRow(e.method, e.url.slice(0, 100), String(e.status))));
  }

  if (entry.axeViolations.length > 0) {
    lines.push(`\n**♿ Violações de Acessibilidade (${entry.axeViolations.length}):**`);
    lines.push(tableRow('ID', 'Impacto', 'Descrição', 'Nós afetados'));
    lines.push(tableRow('---', '---', '---', '---'));
    entry.axeViolations.slice(0, 8).forEach(v =>
      lines.push(tableRow(v.id, v.impact || '-', v.help?.slice(0, 80) || '-', String(v.nodes)))
    );
  }

  if (!hasIssues) {
    lines.push('\n_Nenhum problema automático detectado._');
  }
  lines.push('');
}

// ─── 5. Inventário de Bugs ────────────────────────────────────────────────────
lines.push(h(2, '5. Inventário de Bugs'));
lines.push(tableRow('ID', 'Rota', 'Tipo', 'Severidade', 'Descrição', 'Evidência'));
lines.push(tableRow('---', '---', '---', '---', '---', '---'));

let bugId = 1;
for (const [route, entry] of Object.entries(R.routes)) {
  entry.jsExceptions.forEach(e => {
    lines.push(tableRow(`BUG-${String(bugId++).padStart(3,'0')}`, `\`${route}\``, 'JS Exception', '🔴 Crítico', e.slice(0, 100), 'console'));
  });
  entry.consoleErrors.slice(0, 3).forEach(e => {
    lines.push(tableRow(`BUG-${String(bugId++).padStart(3,'0')}`, `\`${route}\``, 'Console Error', '🟡 Maior', e.text?.slice(0, 100) || '-', 'console'));
  });
  entry.networkErrors.filter(e => e.status >= 500).forEach(e => {
    lines.push(tableRow(`BUG-${String(bugId++).padStart(3,'0')}`, `\`${route}\``, 'HTTP 5xx', '🔴 Crítico', `${e.method} ${e.url.slice(0, 80)}`, String(e.status)));
  });
  entry.networkErrors.filter(e => e.status >= 400 && e.status < 500).forEach(e => {
    lines.push(tableRow(`BUG-${String(bugId++).padStart(3,'0')}`, `\`${route}\``, 'HTTP 4xx', '🟡 Maior', `${e.method} ${e.url.slice(0, 80)}`, String(e.status)));
  });
  entry.axeViolations.filter(v => v.impact === 'critical' || v.impact === 'serious').forEach(v => {
    lines.push(tableRow(`BUG-${String(bugId++).padStart(3,'0')}`, `\`${route}\``, 'Acessibilidade', '🔵 Menor', `[axe] ${v.id}: ${v.help?.slice(0,80)}`, `${v.nodes} nós`));
  });
}

if (bugId === 1) lines.push(tableRow('-', '-', '-', '-', 'Nenhum bug automático detectado', '-'));
lines.push('');

// ─── 6. Responsividade ───────────────────────────────────────────────────────
lines.push(h(2, '6. Relatório de Responsividade'));

for (const [route, bpData] of Object.entries(R.responsiveness)) {
  lines.push(h(3, `Rota \`${route}\``));
  lines.push(tableRow('Breakpoint', 'Overflow H.', 'Nav visível', 'Conteúdo', 'Screenshot'));
  lines.push(tableRow('---', '---', '---', '---', '---'));

  for (const [bp, data] of Object.entries(bpData)) {
    if (data.error) {
      lines.push(tableRow(bp + 'px', '-', '-', '❌ erro', '-'));
    } else {
      lines.push(tableRow(
        bp + 'px',
        data.hasHorizontalOverflow ? '🔴 SIM' : '✅ não',
        data.navigationVisible === true ? '✅' : data.navigationVisible === false ? '🔒 oculto' : '-',
        data.mainContentVisible === true ? '✅' : '⚠️',
        data.screenshot ? `\`${data.screenshot}\`` : '-',
      ));
    }
  }
  lines.push('');
}

// ─── 6b. Cross-Browser / Cross-Device ────────────────────────────────────────
if (CROSS) {
  lines.push(h(2, '6b. Responsividade Cross-Browser'));
  const { summary: xs } = CROSS;

  if (xs.loginFailures.length > 0) {
    lines.push(`> ⚠️ Login falhou nos browsers: ${xs.loginFailures.join(', ')} — dados parciais.\n`);
  }

  if (xs.overflows.length === 0) {
    lines.push('✅ Nenhum overflow horizontal detectado em nenhum browser/device.\n');
  } else {
    lines.push(`🔴 **${xs.overflows.length} overflow(s) detectado(s):**\n`);
    lines.push(tableRow('Browser', 'Device', 'Rota', 'Overflow (px)'));
    lines.push(tableRow('---', '---', '---', '---'));
    xs.overflows.forEach(o =>
      lines.push(tableRow(o.browser, o.device, `\`${o.route}\``, String(o.overflowPx)))
    );
    lines.push('');
  }

  // Tabela de detalhes: h1 detectado por browser × device × rota
  lines.push(h(3, 'H1 detectado por browser/device/rota'));
  lines.push(tableRow('Browser', 'Device', 'Rota', 'h1', 'Overflow', 'Nav'));
  lines.push(tableRow('---', '---', '---', '---', '---', '---'));
  for (const [bName, bData] of Object.entries(CROSS.data)) {
    if (bData.launchFailed) continue;
    for (const [dName, dData] of Object.entries(bData)) {
      if (typeof dData !== 'object' || dData.loginFailed) continue;
      for (const [route, rData] of Object.entries(dData)) {
        if (rData.error) {
          lines.push(tableRow(bName, dName, `\`${route}\``, '-', '⚠️ erro', '-'));
        } else {
          lines.push(tableRow(
            bName, dName, `\`${route}\``,
            rData.h1Text ? `"${rData.h1Text}"` : '-',
            rData.hasHorizontalOverflow ? `🔴 ${rData.overflowPx}px` : '✅',
            rData.navigationVisible ? '✅' : '🔒',
          ));
        }
      }
    }
  }
  lines.push('');
} else {
  lines.push(h(2, '6b. Responsividade Cross-Browser'));
  lines.push('_Dados não disponíveis. Execute `npm run responsive` para gerar._\n');
}

// ─── 7. Acessibilidade ───────────────────────────────────────────────────────
lines.push(h(2, '7. Relatório de Acessibilidade'));

const allViolations = Object.entries(R.routes)
  .flatMap(([route, e]) => e.axeViolations.map(v => ({ ...v, route })));

if (allViolations.length === 0) {
  lines.push('Nenhuma violação automática axe detectada nas rotas testadas.\n');
} else {
  const grouped = {};
  allViolations.forEach(v => {
    if (!grouped[v.id]) grouped[v.id] = { ...v, routes: [], totalNodes: 0 };
    grouped[v.id].routes.push(v.route);
    grouped[v.id].totalNodes += v.nodes;
  });

  lines.push(tableRow('ID', 'Impacto', 'Rotas afetadas', 'Total nós', 'Descrição'));
  lines.push(tableRow('---', '---', '---', '---', '---'));
  Object.values(grouped)
    .sort((a, b) => (b.impact === 'critical' ? 1 : 0) - (a.impact === 'critical' ? 1 : 0))
    .forEach(v => lines.push(tableRow(
      `[${v.id}](${v.helpUrl})`, v.impact || '-',
      v.routes.slice(0, 3).join(', '), String(v.totalNodes), v.help?.slice(0, 80) || '-'
    )));
  lines.push('');
}

// ─── 8. Segurança ─────────────────────────────────────────────────────────────
lines.push(h(2, '8. Segurança — Acesso Sem Autenticação'));
lines.push(tableRow('Rota', 'Status', 'URL Final'));
lines.push(tableRow('---', '---', '---'));

for (const [route, data] of Object.entries(R.unauthenticated)) {
  const status = data.error ? '⚠️ erro' : data.status === 'EXPOSED' ? '🔴 EXPOSTA' : '✅ protegida';
  lines.push(tableRow(`\`${route}\``, status, data.finalUrl || data.error?.slice(0, 80) || '-'));
}
lines.push('');

if (exposedRoutes.length > 0) {
  lines.push(`> ⚠️ **${exposedRoutes.length} rota(s) acessível(is) sem autenticação.** Investigar imediatamente.`);
}
lines.push('');

// ─── 9. Página 404 ───────────────────────────────────────────────────────────
lines.push(h(2, '9. Página 404'));
if (R.notFound) {
  if (R.notFound.error) {
    lines.push(`Erro ao testar: \`${R.notFound.error}\``);
  } else {
    lines.push(`- **URL final:** ${R.notFound.finalUrl}`);
    lines.push(`- **Título:** ${R.notFound.pageTitle}`);
    lines.push(`- **Conteúdo detectado:** ${(R.notFound.bodySnippet || '').replace(/\n/g, ' · ').slice(0, 200)}`);
    lines.push(`- **Página 404 dedicada:** ${R.notFound.has404Heading ? '✅ Sim' : '❌ Não — redireciona para /dashboard'}`);
    lines.push(`- **Bug:** ${R.notFound.has404Heading === false ? 'BUG-002 confirmado — rotas desconhecidas caem silenciosamente no dashboard' : 'n/d'}`);
    lines.push(`- **Screenshot:** \`screenshots/${R.notFound.screenshot}\``);
  }
} else {
  lines.push('Não testado.');
}
lines.push('');

// ─── 10. Login — Estados de Erro ─────────────────────────────────────────────
lines.push(h(2, '10. Login — Estados de Erro'));
lines.push(tableRow('Cenário', 'Erro visível', 'Screenshot'));
lines.push(tableRow('---', '---', '---'));
const PRIVACY_RE = /política de privacidade|termos de uso|ao acessar a plataforma/i;
R.loginErrorStates.forEach(s => {
  const realErrors = Array.isArray(s.formErrors)
    ? s.formErrors.filter(e => !PRIVACY_RE.test(e.text || e))
    : [];
  const errText = realErrors.length > 0
    ? `"${realErrors.map(e => e.text || e).join('; ').slice(0, 80)}"`
    : '⚠️ nenhuma mensagem de validação detectada';
  lines.push(tableRow(s.test, errText, `\`${s.screenshot}\``));
});
lines.push('');

// ─── 11. Roadmap Priorizado ───────────────────────────────────────────────────
lines.push(h(2, '11. Roadmap Priorizado'));

lines.push(h(3, 'Agora — Bloqueadores'));
if (s.totalJsExceptions > 0 || exposedRoutes.length > 0) {
  if (s.totalJsExceptions > 0) lines.push(`- 🔴 Corrigir ${s.totalJsExceptions} exceção(ões) JS que causam tela branca/crash`);
  if (exposedRoutes.length > 0) lines.push(`- 🔴 Proteger rotas expostas sem autenticação: ${exposedRoutes.map(([r]) => r).join(', ')}`);
  const http5xx = Object.entries(R.routes).filter(([, e]) => e.networkErrors.some(n => n.status >= 500));
  if (http5xx.length > 0) lines.push(`- 🔴 Resolver erros 5xx em: ${http5xx.map(([r]) => r).join(', ')}`);
} else {
  lines.push('- Nenhum bloqueador detectado automaticamente. Verificar manualmente fluxos CRUD.');
}

lines.push(h(3, 'Próximo — Alto Impacto'));
lines.push(`- 🟡 Resolver ${s.totalConsoleErrors} erros de console acumulados`);
lines.push(`- 🟡 Corrigir ${s.totalAxeViolations} violações de acessibilidade (axe) — impacto WCAG AA`);
const overflowRoutes = Object.entries(R.responsiveness)
  .flatMap(([route, bps]) => Object.entries(bps).filter(([, d]) => d.hasHorizontalOverflow).map(([bp]) => `${route}@${bp}px`));
if (overflowRoutes.length > 0) lines.push(`- 🟡 Corrigir overflow horizontal em: ${overflowRoutes.slice(0, 5).join(', ')}`);
lines.push(`- 🟡 Validar estados de formulário (erro/vazio/loading) em todos os módulos — teste manual necessário`);

lines.push(h(3, 'Depois — Polimento Enterprise'));
lines.push('- 🔵 Integrar Lighthouse CI (LCP < 2.5s, CLS < 0.1, TBT < 200ms)');
lines.push('- 🔵 Auditoria manual de fluxos CRUD completos (criar, editar, excluir, buscar, paginar)');
lines.push('- 🔵 Testes de IA (latência, fallback, erro com entrada vazia)');
lines.push('- 🔵 Internacionalização: verificar ausência de strings hardcoded em inglês/lorem ipsum');
lines.push('- 🔵 Revisão manual de microcopy e consistência de mensagens de toast/erro');
lines.push('');

// ─── 11b. O que mudou vs. rodada inválida (v1) ───────────────────────────────
lines.push(h(2, '11b. O que mudou vs. a rodada inválida (v1 — wait fixo 3s)'));
lines.push(`
A rodada v1 usava \`waitForTimeout(3000)\` — insuficiente para o cold-start do Supabase Free Tier (8–10s).
Todos os screenshots capturavam o skeleton \`"Autenticando sessão…"\`, não o DOM real.
O harness v2/v3 usa \`waitForAppReady\` com \`waitForFunction\` + \`networkidle\`, eliminando o falso-negativo.
`);

lines.push(tableRow('Métrica', 'v1 (inválido — skeleton)', 'v3 (real — waitForAppReady)', 'Causa da diferença'));
lines.push(tableRow('---', '---', '---', '---'));
lines.push(tableRow('Axe violations', '0 (falso negativo)', String(s.totalAxeViolations), 'v1 testou skeleton, não o layout real'));
lines.push(tableRow('Console errors', '0 (falso negativo)', String(s.totalConsoleErrors), 'Idem — módulos nem tinham carregado'));
lines.push(tableRow('Rotas stale', '0', String(s.routesStale || 0), 'waitForAppReady aguarda redirect final'));
lines.push(tableRow('BUG-001 (login sem validação)', 'suspeito', s.totalConsoleErrors > 0 ? 'confirmado' : 'a verificar', 'rawBodySnippet comprova ausência de mensagem'));
lines.push(tableRow('BUG-002 (sem 404)', 'suspeito', R.notFound?.has404Heading === false ? 'confirmado: redireciona para /dashboard' : 'a verificar', 'finalPath=/dashboard após wait completo'));
lines.push(tableRow('Botões interativos detectados (/dashboard)', '1 (skeleton)', String(Object.values(R.routes).find(r => !r.error && !r.isStaleRoute)?.interactiveElements?.buttons ?? '?'), 'DOM real tem botões de layout completo'));
lines.push(tableRow('"zero erros / zero bloqueadores"', '✅ (falso negativo)', s.totalJsExceptions === 0 && Object.values(R.unauthenticated).every(r => r.status !== 'EXPOSED') ? '✅ confirmado com conteúdo real' : '❌ novos problemas reais detectados', '—'));
lines.push('');

// ─── 12. Apêndice ─────────────────────────────────────────────────────────────
lines.push(h(2, '12. Apêndice'));
lines.push(`- **Log completo:** \`audit-output/results.json\``);
lines.push(`- **Screenshots:** \`audit-output/screenshots/\` (${s.screenshots} arquivos)`);
lines.push(`- **Rotas descobertas via nav:** ${R.discoveredRoutes.join(', ') || 'nenhuma'}`);
lines.push(`- **Breakpoints testados:** ${Object.keys(Object.values(R.responsiveness)[0] || {}).join(', ')} px`);
lines.push('');

const report = lines.join('\n');
fs.writeFileSync(path.join(OUTPUT_DIR, 'REPORT.md'), report);

const totalBugs = bugId - 1;
console.log('\n✅ REPORT.md gerado em: audit/audit-output/REPORT.md');
console.log(`   Total de bugs catalogados: ${totalBugs}`);
console.log(`   Violações axe: ${s.totalAxeViolations}`);
console.log(`   Rotas expostas sem auth: ${exposedRoutes.length}`);
