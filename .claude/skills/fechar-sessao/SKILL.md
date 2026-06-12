---
description: Ritual de encerramento de sessão — tsc check, atualização do vault Obsidian e commit+push
---

Execute o ritual de encerramento de sessão do NextAI na ordem exata abaixo. Não pule etapas.

## Passo 1 — TypeScript check

Execute `npx tsc --noEmit` em `C:\dev\portal-mopar`.

- EXIT != 0: **PARE**. Liste os erros e aguarde o usuário corrigir antes de continuar.
- EXIT 0: continue.

## Passo 2 — Atualizar vault Obsidian

Vault: `C:\cerebro\Mopar Engenharia\Projeto App Portal Mopar\`

**`06 - Histórico de Sessões.md`**
Adicione nova entrada no topo com:
- Número da sessão (último registrado + 1)
- Data da sessão
- Commits realizados (`git log --oneline` desde o último commit do histórico)
- O que foi implementado/resolvido
- Pendências para a próxima sessão

**`Roadmap Técnico.md`**
Atualize o estado das sprints: marque como concluído o que foi entregue nessa sessão e ajuste o backlog se necessário.

## Passo 3 — Commit e push

No diretório `C:\dev\portal-mopar`:

1. `git status` — revise os arquivos modificados
2. `git add` nos arquivos relevantes (nunca `git add .` sem revisão)
3. `git commit` com mensagem no padrão convencional do projeto (`feat:`, `fix:`, `perf:`, `refactor:`, etc.)
4. `git push`

## Passo 4 — Registrar hash do vault sync

Após o push bem-sucedido, execute em `C:\dev\portal-mopar`:

```
git rev-parse HEAD | Out-File -FilePath .claude\last-vault-sync -Encoding utf8 -NoNewline
```

Isso registra que o vault está sincronizado com o HEAD atual. O hook `Stop` do Claude Code compara esse arquivo com o HEAD a cada resposta e avisa quando estiver desatualizado.

## Passo 5 — Relatório final

Informe ao usuário:
- Hash do commit gerado
- Arquivos do vault atualizados
- Confirmação do push
- Confirmação: "vault-sync registrado ✅"
