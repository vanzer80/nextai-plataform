---
description: Verifica integridade do trabalho entregue por agente delegado (Gemini, Codex, outro Claude) — checks mecânicos via script único + reconciliação do relato vs diff real.
---

O usuário delegou uma tarefa a outra IA, recebeu um **relatório em linguagem natural** e quer saber se é verdade. A verificação tem duas naturezas: o que é **mecânico** (determinístico, scriptável) e o que exige **julgamento** (só um LLM faz). Não misture.

## Passo 1 — Checks mecânicos (UMA chamada)

Rode o script único e portável:

```
pwsh -File .claude/scripts/verify-delegation.ps1 -Commit <hash-reportado>
```

- `-Commit` é opcional (default `HEAD`); passe o hash que o agente reportou, se houver.
- `-Fetch` se o agente delegado commitou/pushou em **outra máquina ou clone** — sem isso o hash dele não existe no seu repo local e o check o trataria como "não resolve".
- Adicione `-Build` para incluir o gate de bundle; `-SkipTests` para iteração rápida.

O script imprime `[PASS]/[FAIL]` para: commit alcançável (não dangling), integridade do `docs/HISTORY.md` (delegada a `.githooks/verify-history-hashes.ps1` — fonte única), working tree limpo, HEAD pushado, `tsc`, `vitest` (contagem **dinâmica**, nunca hardcoded) e build (se `-Build`). Exit 1 = algum check falhou.

**Não re-execute esses checks na mão** — o script é a fonte única. Apenas leia a saída.

## Passo 2 — Reconciliação do relato (só o LLM faz)

O script confirma que o repo está são; ele **não** sabe o que o agente *afirmou*. Compare cada alegação do relatório contra a realidade:

```
git show --stat <commit>
```

- Para cada "atualizei X / criei Y / corrigi Z" no relato → existe evidência no diff? Se o agente disse "atualizei o ROADMAP" e o diff não toca `ROADMAP.md`, é divergência.
- Alegou contagem de testes / push? Compare com o que o **script** já reportou — nunca com um número de memória.
- Arquivo alegado como criado → o `[FAIL]` de HISTORY.md ou um `git show --stat` sem ele denuncia.

## Passo 3 — Relatório + auto-correção

Tabela com: cada check do script (✅/❌) **+** cada alegação reconciliada (✅/❌ com a evidência do diff). Veredito final:

- Tudo ✅ → "Trabalho verificado e íntegro."
- Qualquer ❌ → "Trabalho com divergências." e liste-as.

Se o script apontar hash/arquivo divergente no `HISTORY.md`, corrija com o dado **real** (o hash alcançável correto / o arquivo existente) e faça `docs(history): corrige <o que> da Sessao N`.

---

> **Portabilidade:** o trabalho mecânico vive em `.claude/scripts/verify-delegation.ps1` — qualquer harness (Codex, Gemini) roda `pwsh -File .claude/scripts/verify-delegation.ps1` direto, sem precisar desta skill. Esta skill é a camada de julgamento do Claude Code por cima do mesmo script.
