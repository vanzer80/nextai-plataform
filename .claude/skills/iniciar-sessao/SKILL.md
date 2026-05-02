---
description: Retomada de sessão — lê o vault Obsidian e o estado do repo para saber exatamente onde parou
---

Você está iniciando uma sessão de trabalho no Portal Mopar. Leia todos os arquivos abaixo antes de qualquer outra ação. Não resuma antes de terminar de ler tudo.

## Passo 1 — Ler histórico da última sessão

Leia o arquivo:
`C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\06 - Histórico de Sessões.md`

Extraia da entrada mais recente:
- Número e data da última sessão
- O que foi implementado/resolvido
- Pendências registradas para esta sessão

## Passo 2 — Ler roadmap e estado das sprints

Leia o arquivo:
`C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\Roadmap Técnico.md`

Identifique:
- Sprint atual e seu objetivo
- Tarefas concluídas vs pendentes na sprint em curso
- Próximas sprints no backlog

## Passo 3 — Ler referência rápida

Leia o arquivo:
`C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\00 - Quick Reference Portal Mopar.md`

Use como base para decisões arquiteturais e convenções do projeto durante a sessão.

## Passo 4 — Verificar estado do repositório

Em `/c/dev/portal-mopar`:
- `git log --oneline -5` — confirme os últimos commits
- `git status` — working tree deve estar limpa
- `npx tsc --noEmit` — reporte se há erros TypeScript abertos

## Passo 5 — Apresentar briefing da sessão

Com base em tudo que leu, apresente ao usuário um briefing conciso:

```
## Sessão [N+1] — Portal Mopar

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
