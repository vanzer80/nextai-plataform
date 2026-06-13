# Sessão 59 — 26/05/2026 — Módulos Empresariais RH + DP + CP (qualidade SAP/TOTVS)

**Commit:** (ver push abaixo) | Deploy: Vercel auto-deploy via `master`

### Contexto

Implementação enterprise completa de 3 novos módulos: **RH** (Recursos Humanos), **DP** (Departamento Pessoal / Folha de Pagamento) e **CP** (Contas a Pagar). Objetivo declarado: "atingir 99% da qualidade do SaaS comparado ao SAP / líderes de mercado".

### DB aplicado (3 migrations via MCP Supabase — projeto `sksursvmgvxqbbdsztcd`)

| Migration | Tabelas criadas | RPCs / Funções |
|-----------|----------------|----------------|
| `20260526_rh_module` | `employees`, `departments`, `employee_certifications`, `employee_documents`, `employee_events` | `get_expiring_certs(days)`, `get_employee_kpis()` |
| `20260526_dp_module` | `payroll_periods`, `payroll_entries`, `time_records`, `vacation_schedules` | `calculate_payroll_period(period_id)`, `calculate_payroll_entry(entry_id)` — INSS 2024 progressivo + IRRF + FGTS + VT |
| `20260526_cp_module` | `payables`, `payable_installments`, `payable_comments`, `payable_approvals` | `submit_payable`, `approve_payable`, `reject_payable`, `pay_payable` — aprovação multinível |

Todas as tabelas: RLS `team_isolation` RESTRICTIVE + `REFERENCES public.tenants(id)`.

### Frontend implementado

**Tipos:**
- `src/types/employee.ts` — `Employee`, `Department`, `EmployeeCertification`, `EmployeeDocument`
- `src/types/payroll.ts` — `PayrollPeriod`, `PayrollEntry`, `TimeRecord`, `VacationSchedule`, `CreateVacationDTO`
- `src/types/payable.ts` — `Payable`, `PayableInstallment`, `PayableComment`, `PayableStatus`, `PayableTipo`

**Serviços:**
- `src/services/employeeService.ts` — CRUD colaboradores, departamentos, certificações + `getEmployeeKPIs()`, `getExpiringCerts(days)`
- `src/services/departmentService.ts` — CRUD departamentos
- `src/services/payrollService.ts` — períodos, entradas, `calculatePeriod()` / `calculateEntry()`, ponto, férias
- `src/services/payableService.ts` — CRUD contas, workflow submit/approve/reject/pay, `getPayableKPIs()`

**Utilitários:**
- `src/utils/cpfValidator.ts` — validação CPF com dígito verificador
- `src/utils/certUtils.ts` — `isExpiringSoon()`, `isExpired()`, `daysUntilExpiry()`
- `src/utils/gerarHolerite.ts` — PDF holerite completo (jsPDF + autoTable) — vencimentos/descontos lado a lado

**Páginas RH (`/rh`):**
- `src/pages/rh/EmployeesList.tsx` — busca, filtro por departamento/status, badges de férias/afastamento
- `src/pages/rh/EmployeeForm.tsx` — cadastro/edição com CPF validado, dados CLT, contato, endereço
- `src/pages/rh/EmployeeDetail.tsx` — perfil, documentos, certificações, eventos (timeline de admissão/férias/demissão)
- `src/pages/rh/DepartmentsPage.tsx` — CRUD departamentos com contagem de colaboradores
- Rotas: `/rh/employees`, `/rh/employees/:id`, `/rh/employees/new`, `/rh/employees/:id/edit`, `/rh/departments`

**Páginas DP (`/dp`):**
- `src/pages/dp/PayrollList.tsx` — KPI cards + tabela de competências com status + botão "Calcular"
- `src/pages/dp/PayrollDetail.tsx` — detalhes por colaborador, `EditEntryModal`, download holerite PDF (`useTenant()` para nome empresa)
- `src/pages/dp/VacationSchedule.tsx` — agendamento/aprovação de férias (workflow agendada→aprovada→em_gozo→concluida)
- `src/pages/dp/TimeRecordsPage.tsx` — registro de ponto eletrônico por colaborador/mês, cálculo de horas trabalhadas
- Rotas: `/dp/payroll`, `/dp/payroll/:id`, `/dp/vacation`, `/dp/timerecords`

**Páginas CP (`/cp`):**
- `src/pages/cp/PayablesList.tsx` — lista com alertas de vencidos e vencendo, filtro por status
- `src/pages/cp/PayableForm.tsx` — formulário completo: tipo, fornecedor, parcelas (preview cronograma), NF, dados bancários. Ações: "Salvar Rascunho" + "Enviar para Aprovação"
- `src/pages/cp/PayableDetail.tsx` — detalhes, linha do tempo de aprovação, pagamento por parcela, `RejectDialog`
- Rotas: `/cp/payables`, `/cp/new`, `/cp/:id`, `/cp/:id/edit`

**Dashboard:**
- `src/pages/dashboard/widgets/HrSummaryWidget.tsx` — cards: Colaboradores Ativos, Certificações Vencendo (amber alert), A Pagar vencido (rose alert), Aprovado a Pagar

**Navegação lateral (AppLayout):**
- Colaboradores → `/rh/employees` | Departamentos → `/rh/departments`
- Folha de Pagamento → `/dp/payroll` | Férias → `/dp/vacation` | Registro de Ponto → `/dp/timerecords`
- Contas a Pagar → `/cp/payables` (roles: Financeiro/Gestor/Admin/Master)

**SW:** `nextai-v5` → `nextai-v6`

### Testes

- `src/services/__tests__/payrollCalculations.test.ts` — 20 testes cobrindo INSS 2024 progressivo (teto real 908,86), IRRF 2024, VT com cap 6%, FGTS 8%, folha CLT completa
- **Suite completa: 117/117 ✅ | TypeScript: 0 erros ✅ | Build prod: OK ✅**
