---
description: Ritual de encerramento de sessão — tsc check, registro do histórico no repo e commit+push
---

Execute o ritual de encerramento de sessão do NextAI na ordem exata abaixo. **O histórico e o roadmap vivem no repositório** — o vault Obsidian foi descontinuado em 2026-06-13, não há mais nada a atualizar fora do repo. Não pule etapas.

## Passo 1 — TypeScript check

Execute `npx tsc --noEmit` em `C:\dev\portal-mopar`.

- EXIT != 0: **PARE**. Liste os erros e aguarde o usuário corrigir antes de continuar.
- EXIT 0: continue.

## Passo 2 — Registrar a sessão no histórico (repo)

Descubra o próximo número de sessão lendo a primeira entrada da lista em `docs/HISTORY.md`.

**a) Crie o arquivo de detalhe (camada COLD)** `docs/sessions/sessao-<N>-<slug-curto>.md` com:
- Primeira linha: `# Sessão <N> — <data> — <título>`
- Commits realizados (`git log --oneline` desde o último commit registrado no histórico)
- O que foi implementado/resolvido
- Pendências para a próxima sessão

Slug: minúsculas, sem acento, palavras separadas por hífen (ex.: `sessao-67-migracao-historico-repo`).

**b) Adicione UMA linha no índice (camada WARM)** `docs/HISTORY.md`, no topo da lista (logo após a linha `**N sessões registradas.**`, antes da entrada mais recente):

```
- [Sessão <N> — <data> — <título>](sessions/<arquivo>.md) — `<commit>`
```

Incremente a contagem em `**N sessões registradas.**`.

## Passo 3 — Atualizar roadmap (repo)

Edite `docs/ROADMAP.md`: marque como concluído o que foi entregue nesta sessão e ajuste o backlog se necessário.

## Passo 4 — Commit e push

No diretório `C:\dev\portal-mopar`:

1. `git status` — revise os arquivos modificados
2. `git add` nos arquivos relevantes (nunca `git add .` sem revisão) — inclua `docs/HISTORY.md`, o novo `docs/sessions/*.md`, `docs/ROADMAP.md` e o código da sessão
3. `git commit` com mensagem no padrão convencional do projeto (`feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, etc.)
4. `git push`

## Passo 5 — Registrar hash de sync

Após o push bem-sucedido, execute em `C:\dev\portal-mopar`:

```
git rev-parse HEAD | Out-File -FilePath .codex\last-vault-sync -Encoding utf8 -NoNewline
```

Isso mantém o hook `Stop` do Codex satisfeito (o histórico no repo está sincronizado com o HEAD). O nome do arquivo `last-vault-sync` é legado — hoje significa apenas "histórico do repo sincronizado com este HEAD"; mantido com esse nome para não precisar editar o hook do Codex.

## Passo 6 — Relatório final

Informe ao usuário:
- Hash do commit gerado
- Arquivo de sessão criado (`docs/sessions/...`) + entrada adicionada no índice
- Roadmap atualizado
- Confirmação do push
- "sync registrado ✅"
