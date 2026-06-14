---
description: Verifica integridade do trabalho entregue por agente delegado (Gemini, Codex, outro Claude). Checa hashes, arquivos e gates técnicos.
---

Você recebeu o relatório de um agente delegado. Verifique se o que ele afirmou ter feito é verdade.
Execute os passos abaixo na ordem. **Não resuma sem ter executado cada verificação.**

O hash/commit reportado pelo agente pode vir nos `args` da skill ou no contexto da conversa. Se não vier, use `HEAD`.

---

## Passo 1 — Hash existe no repositório?

```
git log --oneline | grep <hash>
```

- **Não encontrou:** ❌ HASH FABRICADO. Informe o usuário imediatamente e pare.
- **Encontrou:** ✅ continue.

---

## Passo 2 — Hashes no HISTORY.md conferem com o git log real?

Leia `docs/HISTORY.md`. Para cada linha que contenha um hash no formato `` `<7chars>` ``:

```
git log --oneline | grep <hash>
```

Liste todos os que **não forem encontrados** no git log. Esse foi o erro clássico de agentes delegados: registrar um hash inventado no índice de histórico.

- **Sem divergência:** ✅ continue.
- **Hash(es) ausente(s):** ❌ liste quais estão errados e qual é o hash real do commit mais próximo por data/mensagem.

---

## Passo 3 — Arquivos referenciados no HISTORY.md existem no disco?

Para cada entrada em `docs/HISTORY.md` no formato `[Sessão N — ...](sessions/<arquivo>.md)`, verifique se o arquivo existe:

```
ls docs/sessions/<arquivo>.md
```

Basta checar as 3 entradas mais recentes (topo do índice) — o histórico antigo já foi validado em sessões anteriores.

- **Todos existem:** ✅ continue.
- **Arquivo ausente:** ❌ o agente afirmou ter criado um arquivo que não existe.

---

## Passo 4 — TypeScript check

```
npx tsc --noEmit
```

- **EXIT 0, sem output:** ✅ continue.
- **EXIT != 0:** ❌ liste os erros. O agente entregou código quebrado.

---

## Passo 5 — Suite de testes

```
npx vitest run
```

- **163+ testes passando:** ✅ continue.
- **Falhas:** ❌ liste os testes quebrados.

---

## Passo 6 — Relatório final

Apresente uma tabela com os resultados:

| Verificação | Status | Detalhe |
|---|---|---|
| Hash `<hash>` existe no git log | ✅/❌ | — |
| Hashes no HISTORY.md conferem | ✅/❌ | Ex: `de5fab0` não existe, deveria ser `100884a` |
| Arquivos de sessão existem | ✅/❌ | — |
| TypeScript (`tsc --noEmit`) | ✅/❌ | — |
| Vitest (N/163 passando) | ✅/❌ | — |

**Veredito final:**
- Tudo ✅ → "Trabalho verificado e íntegro."
- Qualquer ❌ → "Trabalho com divergências. Veja os itens marcados acima."

Se houver divergência em hashes do HISTORY.md, corrija automaticamente com o hash real e faça um commit de correção com mensagem `docs(history): corrige hash fabricado da Sessao N (<errado> → <correto>)`.
