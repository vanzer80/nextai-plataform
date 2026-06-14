# Governança de commit — agnóstica de harness

Este diretório contém git hooks **versionados** que rodam para **qualquer** ferramenta
que commite no repo: Claude Code, Codex, Gemini CLI ou `git` na mão. Diferente de hooks
de harness (ex.: `.claude/settings.json`, lidos só pelo Claude Code), um git hook é
executado pelo próprio git — então cobre o cenário multi-agente real do projeto.

## Instalação (1× por clone)

`core.hooksPath` é configuração **local** do git e não é versionada. Após clonar:

```powershell
pwsh -File .githooks/install.ps1
```

Verifica: `git config --get core.hooksPath` deve retornar `.githooks`.

## O que roda

| Hook | Quando | O que faz |
|------|--------|-----------|
| `post-commit` | após todo commit | valida `docs/HISTORY.md` via `verify-history-hashes.ps1` |

`verify-history-hashes.ps1` checa, nas 5 entradas mais recentes do índice:
1. o hash em `` `...` `` resolve para um commit real (`git rev-parse`);
2. o arquivo `sessions/*.md` linkado existe no disco.

Silencioso em sucesso. Em divergência, imprime um aviso — **não bloqueia** o commit
(post-commit é informativo; o hash só existe depois do commit). Para auditoria completa
(hashes + arquivos + `tsc` + `vitest`), use a skill `/verificar-delegacao` no handoff.

## Por que post-commit e não pre-commit

O erro alvo é um hash **do próprio commit** registrado no HISTORY.md. Esse hash só
passa a existir *depois* que o commit é criado — logo a verificação é inerentemente
pós-commit. O agente vê o aviso no terminal e faz um commit de correção.
