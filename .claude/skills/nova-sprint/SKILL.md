---
description: Kickoff de nova sprint — lê roadmap, verifica estado do repositório e propõe entregáveis ordenados
---

Execute o kickoff da nova sprint do Portal Mopar. Leia antes de agir.

## Passo 1 — Ler contexto atual

Leia os arquivos do vault Obsidian em `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\`:

- `Roadmap Técnico.md` — estado das sprints e backlog priorizado
- `00 - Quick Reference Portal Mopar.md` — referência rápida do projeto
- `Problemas e Dívida Técnica.md` — dívida técnica aberta

## Passo 2 — Verificar estado do repositório

Em `/c/dev/portal-mopar`:

- `git log --oneline -5` — confirme o último commit
- `git status` — working tree deve estar limpa
- `npx tsc --noEmit` — deve retornar EXIT 0

## Passo 3 — Propor plano da sprint

Apresente ao usuário:

1. **Identificação da sprint** — qual é a próxima com base no roadmap
2. **Objetivo principal** — em uma frase
3. **Tarefas técnicas** — ordenadas por dependência, com estimativa de complexidade (P, M, G)
4. **Armadilhas críticas relevantes** — quais das 16 armadilhas do projeto podem ser acionadas nessa sprint
5. **Pré-requisitos bloqueantes** — secrets, credenciais externas, decisões arquiteturais que precisam ser resolvidas antes de codar

Aguarde confirmação e ajustes do usuário antes de iniciar qualquer implementação.
