---
description: Kickoff de nova sprint — lê roadmap, verifica estado do repositório e propõe entregáveis ordenados
---

Execute o kickoff da nova sprint do NextAI. **Todo o contexto vive no repositório** — o vault Obsidian foi descontinuado em 2026-06-13. Leia antes de agir.

## Passo 1 — Ler contexto atual

No repositório (`C:\dev\portal-mopar`):

- `docs/ROADMAP.md` — estado das sprints e backlog priorizado (fonte viva)
- `docs/DIVIDA-TECNICA.md` — dívida técnica registrada
- `docs/HISTORY.md` — índice das sessões recentes (abra um `docs/sessions/*.md` só se precisar do detalhe de uma sessão específica)

(Convenções, arquitetura e armadilhas já vêm do `CLAUDE.md`, carregado automaticamente — não precisa reler.)

## Passo 2 — Verificar estado do repositório

Em `C:\dev\portal-mopar`:

- `git log --oneline -5` — confirme o último commit
- `git status` — working tree deve estar limpa
- `npx tsc --noEmit` — deve retornar EXIT 0

## Passo 3 — Propor plano da sprint

Apresente ao usuário:

1. **Identificação da sprint** — qual é a próxima com base no roadmap
2. **Objetivo principal** — em uma frase
3. **Tarefas técnicas** — ordenadas por dependência, com estimativa de complexidade (P, M, G)
4. **Armadilhas críticas relevantes** — quais das armadilhas do `CLAUDE.md` podem ser acionadas nessa sprint
5. **Pré-requisitos bloqueantes** — secrets, credenciais externas, decisões arquiteturais que precisam ser resolvidas antes de codar

Aguarde confirmação e ajustes do usuário antes de iniciar qualquer implementação.
