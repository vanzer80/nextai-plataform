# Sessão 65 — 03/06/2026 — Testes E2E Playwright para módulos RH, DP e CP

**Repositório:** `nextai-plataform` (portal)
**Commit:** `78ef868`

### Entregas

#### 22 testes Playwright novos — 22/22 passando

**`tests/rh-module.spec.ts`** (7 testes)
- RH-01/02: RBAC — Gestor acessa `/rh/employees`; Tecnico redirecionado para `/dashboard`
- RH-03: KPIs do quadro de pessoal renderizados (Ativos, Em Férias, Afastados, Desligados mês)
- RH-04: REST `/rest/v1/employees` retorna 200 com RLS ativo (body é array)
- RH-05: Botão "Admitir" navega para `/rh/employees/new`
- RH-06: Formulário de admissão renderiza aba padrão + campo `full_name`
- RH-07: Gestor acessa `/rh/departments` — REST `/rest/v1/departments` 200

**`tests/dp-module.spec.ts`** (7 testes)
- DP-01/02: RBAC — Gestor acessa `/dp/payroll`; Tecnico bloqueado
- DP-03: REST `/rest/v1/payroll_periods` retorna 200 (array)
- DP-04: Status badges do domínio válido (Aberta/Calculada/Fechada/Paga)
- DP-05: Botão "Nova Competência" abre dialog com input de competência
- DP-06/07: Subrotas `/dp/vacation` e `/dp/timerecords` acessíveis pelo Gestor

**`tests/cp-module.spec.ts`** (8 testes)
- CP-01/02: RBAC — Gestor acessa `/cp/payables`; Tecnico bloqueado
- CP-03: REST `/rest/v1/payables` retorna 200 com RLS ativo
- CP-04: KPIs financeiros renderizados (A Vencer, Vencido, Pago no Mês, Aprovado, Aguardando)
- CP-05: Status labels do domínio válido (Rascunho/Pendente/Aprovado/Pago/Rejeitado/Cancelado)
- CP-06: Botão "Nova Conta" navega para `/cp/new`
- CP-07: Formulário renderiza seções (Classificação, Valor e Datas) + campo `descricao`
- CP-08: Filtro por status "Pendente" dispara nova requisição REST

#### CLAUDE.md atualizado
- 4 novas armadilhas documentadas (34–37): `getByPlaceholder`, forms tabulados, `Promise.any`, specs em paralelo
