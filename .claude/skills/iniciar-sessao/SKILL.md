---
description: Retomada de sessão — lê o índice de histórico e o roadmap no repositório + estado do git para saber exatamente onde parou
---

Você está iniciando uma sessão de trabalho no NextAI. **Todo o contexto vive no repositório** — o vault Obsidian foi descontinuado em 2026-06-13. Siga os passos antes de qualquer outra ação.

## Passo 1 — Índice de sessões (WARM)

Leia `docs/HISTORY.md` — índice de uma linha por sessão, mais recente no topo.

Identifique as últimas 2–3 sessões: número, data, resumo (do título) e commit. **Não abra** os arquivos de `docs/sessions/` neste passo — são lidos sob demanda.

## Passo 2 — Detalhe sob demanda (COLD) — só se necessário

Se precisar de contexto profundo sobre uma sessão específica (ex.: a anterior deixou uma pendência que vamos continuar), abra **apenas** o arquivo correspondente `docs/sessions/<arquivo>.md` indicado no índice. Nunca abra todos — é justamente o custo que essa arquitetura evita.

## Passo 3 — Roadmap e sprints

Leia `docs/ROADMAP.md`. Identifique:
- Sprint atual e seu objetivo
- Tarefas concluídas vs pendentes
- Próximas sprints no backlog

(Convenções, arquitetura e armadilhas já vêm do `CLAUDE.md`, carregado automaticamente — não precisa reler.)

## Passo 4 — Verificar estado do repositório

Em `C:\dev\portal-mopar`:
- `git log --oneline -5` — confirme os últimos commits
- `git status` — working tree deve estar limpa
- `npx tsc --noEmit` — reporte se há erros TypeScript abertos

## Passo 5 — Apresentar briefing da sessão

Com base em tudo que leu, apresente ao usuário um briefing conciso:

```
## Sessão [N+1] — NextAI

**Última sessão ([data]):** [o que foi feito]

**Sprint atual:** Sprint [N] — [objetivo]
**Status:** [X de Y tarefas concluídas]

**Pendências desta sessão:**
- [item 1]
- [item 2]

**Estado do repo:** [limpo / X arquivos modificados] | HEAD: [hash]
**TypeScript:** [✅ zero erros / ❌ N erros]

**Sugestão de próximo passo:** [tarefa mais prioritária com base no roadmap]
```

Aguarde instrução do usuário antes de iniciar qualquer implementação.
