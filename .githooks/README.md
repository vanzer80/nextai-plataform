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

## Duas camadas (mesmo script, sem duplicação)

| Camada | Onde roda | Bloqueia? | Cobre |
|--------|-----------|-----------|-------|
| `post-commit` (local) | máquina de quem commita | não (advisory) | commits locais de máquinas com `install.ps1` rodado |
| GitHub Actions `history-integrity.yml` (servidor) | servidores do GitHub, todo push/PR | **sim** (check vermelho) | **qualquer** commit que chegue ao GitHub — inclusive de máquina não configurada ou da web/API |

A camada local dá feedback imediato (<1s) no momento do commit; a camada servidor é a
autoridade — roda `verify-history-hashes.ps1 -Strict` (exit 1 em divergência) independente
de setup local. O git hook **não** roda no GitHub (hooks são sempre client-side); por isso
as duas camadas são complementares, não redundantes.

## O que roda

| Hook | Quando | O que faz |
|------|--------|-----------|
| `pre-commit` | antes de todo commit local | roda `.claude/scripts/security-scan.ps1 -Staged -Strict` — **bloqueia** o commit em `[BLOCK]` (segredo hard-coded, tabela inexistente); `[WARN]` é impresso sem bloquear |
| `post-commit` | após todo commit local | valida `docs/HISTORY.md` via `verify-history-hashes.ps1` (advisory) |

`verify-history-hashes.ps1` checa, nas 5 entradas mais recentes do índice:
1. o hash em `` `...` `` resolve para um commit real (`git rev-parse`);
2. o arquivo `sessions/*.md` linkado existe no disco.

Silencioso em sucesso. Em divergência, imprime um aviso — **não bloqueia** o commit
(post-commit é informativo; o hash só existe depois do commit). Para auditoria completa
(hashes + arquivos + `tsc` + `vitest`), use a skill `/verificar-delegacao` no handoff.

## Governança de segurança (pre-commit + CI)

Segunda preocupação de governança, mesmo padrão de duas camadas, **mesmo script como
fonte única** (`.claude/scripts/security-scan.ps1` — qualquer harness o roda direto):

| Camada | Onde roda | Bloqueia? | Cobre |
|--------|-----------|-----------|-------|
| `pre-commit` (local) | máquina de quem commita | **sim, só em `[BLOCK]`** | impede segredo zero-FP de entrar no histórico git, antes do commit |
| GitHub Actions `security-scan.yml` (servidor) | servidores do GitHub, todo push/PR | **sim** (`-Full -Strict`) | **qualquer** commit que chegue ao GitHub, incluindo web/API e máquina não configurada |

Disciplina de precisão: só `[BLOCK]` (segredo hard-coded, tabela `team_members` inexistente)
reprova — são padrões **zero-falso-positivo**, então bloquear nunca barra trabalho legítimo.
`[WARN]` (heurística: SECURITY DEFINER sem `search_path`/`REVOKE`, `getPublicUrl`, spread de
body, `auth.uid()` cru) é impresso para revisão mas **nunca** bloqueia. A auditoria de domínio
completa (authz, RLS, validação de input) é a skill `/revisar-seguranca`, camada de julgamento
do LLM por cima do mesmo script.

## Por que o HISTORY.md usa post-commit (e a segurança, pre-commit)

O erro alvo do HISTORY.md é um hash **do próprio commit** registrado no índice. Esse hash só
passa a existir *depois* que o commit é criado — logo a verificação é inerentemente
pós-commit. O agente vê o aviso no terminal e faz um commit de correção. Já um segredo
existe **antes** do commit: barrá-lo no `pre-commit` evita que entre no histórico git (de
onde não sai sem reescrever história) — por isso a camada de segurança é pré-commit.
