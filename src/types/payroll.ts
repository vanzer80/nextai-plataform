// ── Payroll / Departamento Pessoal types ──────────────────────────────────────

export type PayrollStatus = 'aberta' | 'calculada' | 'fechada' | 'paga';

export interface PayrollPeriod {
  id: string;
  team_id: string;
  competencia: string;          // 'YYYY-MM'
  status: PayrollStatus;
  total_bruto?: number;
  total_descontos?: number;
  total_liquido?: number;
  total_fgts?: number;
  created_by?: string;
  closed_at?: string;
  paid_at?: string;
  created_at: string;
  updated_at: string;
  // computed
  entry_count?: number;
}

export interface PayrollEntry {
  id: string;
  period_id: string;
  employee_id: string;
  team_id: string;

  // Vencimentos
  salario_base: number;
  horas_extras_valor: number;
  adicional_noturno: number;
  comissoes: number;
  outros_vencimentos: number;
  total_bruto: number;

  // INSS
  inss_base: number;
  inss_valor: number;
  inss_aliquota_efetiva: number;

  // IRRF
  irrf_base: number;
  irrf_valor: number;
  irrf_aliquota_efetiva: number;
  irrf_dependentes: number;
  irrf_desconto_dependentes: number;

  // FGTS
  fgts_valor: number;

  // Benefícios
  vt_valor: number;
  vr_valor: number;
  va_valor: number;
  plano_saude_desconto: number;
  plano_odonto_desconto: number;
  outros_descontos: number;

  // Totais
  total_descontos: number;
  total_liquido: number;

  // Flags
  horas_trabalhadas?: number;
  faltas?: number;
  status: 'pendente' | 'calculado' | 'aprovado' | 'pago';
  observacoes?: string;
  calculated_at?: string;
  created_at: string;
  updated_at: string;

  // Joined
  employee?: {
    id: string;
    full_name: string;
    matricula?: string;
    cpf?: string;
    department?: { name: string } | null;
    position?: { title: string } | null;
    banco?: string;
    agencia?: string;
    conta?: string;
    tipo_conta?: string;
    pis_pasep?: string;
  };
}

export interface CreatePayrollPeriodDTO {
  competencia: string;  // 'YYYY-MM'
}

export type TimeRecordType = 'entrada' | 'saida_almoco' | 'retorno_almoco' | 'saida';
export type TimeRecordSource = 'manual' | 'sistema' | 'service_report';

export interface TimeRecord {
  id: string;
  employee_id: string;
  team_id: string;
  record_date: string;
  record_type: TimeRecordType;
  record_time: string;
  source: TimeRecordSource;
  service_report_id?: string;
  notes?: string;
  created_by?: string;
  created_at: string;
  // Joined
  employee?: { full_name: string; matricula?: string };
}

export interface DailyTimeRecord {
  date: string;
  records: TimeRecord[];
  total_hours?: number;
  is_complete: boolean;
}

export type VacationStatus = 'agendada' | 'aprovada' | 'em_gozo' | 'concluida' | 'cancelada';

export interface VacationSchedule {
  id: string;
  employee_id: string;
  team_id: string;
  acquisition_start: string;
  acquisition_end: string;
  dias_direito: number;
  dias_gozados: number;
  dias_vendidos: number;
  vacation_start?: string;
  vacation_end?: string;
  abono_pecuniario: boolean;
  status: VacationStatus;
  approved_by?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  // Joined
  employee?: { full_name: string; matricula?: string; department?: { name: string } | null };
}

export interface CreateVacationDTO {
  employee_id: string;
  acquisition_start: string;
  acquisition_end: string;
  vacation_start: string;
  vacation_end: string;
  dias_direito: number;
  dias_vendidos?: number;
  abono_pecuniario?: boolean;
  notes?: string;
}

// ── Holerite / Payslip ────────────────────────────────────────────────────────

export interface PayslipData {
  period: PayrollPeriod;
  entry: PayrollEntry;
  company: {
    name: string;
    cnpj?: string;
  };
}
