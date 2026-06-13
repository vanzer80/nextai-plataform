# Sessão 62 — 30/05/2026 — OS↔Orçamento linkage + Auditoria + E2E

**Commits:** `e918ed7` · `62a2bfd` · `f632645` · `d59e371`
**Branch:** `master` → `nextai-plataform`

### Contexto

Implementação do fluxo SAP SD/PM de vinculação entre Ordens de Serviço e Orçamentos. Após a entrega inicial, foi feita uma auditoria técnica completa que encontrou 16 problemas (4 críticos, 8 altos, 4 médios/menores), todos corrigidos. Em seguida, suite de 33 testes E2E Playwright foi escrita e executada — os testes encontraram 2 bugs adicionais em produção, ambos corrigidos.

---

### Feature — Vincular OS ao Orçamento (`e918ed7`)

**Ponto 1 — ReportDetail.tsx**
- Botão bidirecional: "Orçamento" (criar novo) ↔ "Ver Orçamento" (navegar para existente)
- Verifica se já existe `orcamentos.report_id = report.id` para decidir qual estado exibir
- Visível apenas para `isReviewer` (Gestor, Supervisor, Admin, Master)
- Não aparece quando `report.status === 'draft'`

**Ponto 2 — NovoOrcamento.tsx**
- Seção "Vincular OS" (só em criação) com 2 estados:
  - Estado 1: input de busca GIN (`textSearch websearch`), OS recentes (últimas 5 sem digitar), skeleton loader
  - Estado 2: card de confirmação com os_number, service_type, cliente, data
- `?fromOS=<uuid>`: ao vir do ReportDetail, auto-seleciona a OS ao montar
- Auto-preenchimento: `os_parts` → itens com preços reais; fallback parse `parts_used`
- Observações: bloco estruturado com 6 campos da OS
- Chips "• OS" nos labels rastreiam o que foi auto-preenchido; somem ao editar
- Desvincular: limpa apenas campos que o usuário não editou
- "Pular vinculação" reversível via botão "Vincular uma OS"
- `report_id` adicionado ao schema Zod e passado no `criarOrcamento`

**Ponto 3 — OrcamentoDetail.tsx**
- Card "Ordem de Serviço Vinculada" com os_number (font-mono), service_type, service_date, badge de status
- Link "Ver OS →" navega para `/reports/:id`
- ORCAMENTO_SELECT expandido: `service_reports:report_id(os_number, service_type, service_date, status)`

---

### Auditoria e correções (`62a2bfd`)

**Críticos:**
- C1: `report_id` preservado no `atualizarOrcamento` (estava sendo apagado ao editar)
- C2: `SelectValue` com `children` explícitos via `clients.find()` — fix UUID exibido em vez de nome
- C3: `setIsSearching(false)` no branch de limpeza do debounce — spinner não travava mais
- C4: `isFromOSLoading` + `toast.error()` para `?fromOS` inválido

**Altos:**
- A1: Card OS em OrcamentoDetail com dados ricos + HTML válido (`<Link>` sem `<button>` interno)
- A2: Modo edição exibe card de referência da OS com botão desvincular
- A3: Textarea observações `rows=10` quando auto-preenchida pela OS
- A4: Desvincular seletivo (preserva campos editados)
- A5: "Pular vinculação" reversível
- A6/A7: skeleton loader + empty state adequado
- A8: Botão bidirecional no ReportDetail (verifica se já tem orçamento)

**Médios/Menores:**
- M1: `toast.error()` em todas as queries de OS com falha de rede
- M2: Aviso âmbar "⚠ Preencha o preço" por item quando importado com preço zero
- Q: `removeFromAutoFilled` como `useCallback`, `fmtOSDate` retorna `string`, `OS_SELECT` sem newline espúrio

---

### Bugs encontrados pelos testes E2E (não estavam na auditoria)

**Bug 1 — Role `'Técnico'` com acento (corrigido em `f632645`)**
- O botão usava `'Técnico'` (com acento) mas o `UserRole` canônico é `'Tecnico'` (sem acento)
- O botão nunca aparecia para Técnicos em produção
- Corrigido para `isReviewer` — consistente com o `RoleGuard` de `/orcamentos`

**Bug 2 — `RoleGuard` de `/orcamentos` não inclui Técnico (`f632645`)**
- `RoleGuard` de `/orcamentos/*` = `['Master','Admin','Gestor','Supervisor']`
- Mostrar o botão para Técnico causaria redirect silencioso
- Botão agora usa `isReviewer` (mesma lista do `RoleGuard`)

---

### Testes E2E — `tests/os-orcamento-vinculacao.spec.ts`

33 casos cobrindo V1–V13 + 4 probes:
- V1: botão bidirecional ReportDetail (A→B e B→A)
- V2: `?fromOS` auto-fill, loading, UUID inválido
- V3: busca manual, debounce, spinner fix C3, no-results
- V4: SelectValue mostra nome (não UUID) — fix C2
- V5: chips "• OS" aparecem e somem ao editar
- V6: textarea rows≥8 quando preenchida — fix A3
- V7: desvincular seletivo — fix A4
- V8: pular/restaurar — fix A5
- V9: skeleton + empty state — fix A6/A7
- V10: submit end-to-end — report_id no OrcamentoDetail
- V11: card OS rico (type/date/status/HTML válido) — fix A1
- V12: "Ver OS →" navega corretamente
- V13: modo edição — card, desvincular, fix C1 (A↔B)

**Resultado:** 31 PASS · 1 flaky (timing Supabase cold-start) · 1 PROBE FAIL (dblclick race)

**Pendência aberta:** race condition no duplo-clique de OS — `handleSelectOS` é chamado duas vezes concorrentemente sem guard. Adicionar flag `isSelecting` ou debounce.
