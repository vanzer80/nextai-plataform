// ── Enums / union types ───────────────────────────────────────────────────────

export type EmployeeStatus =
  | 'ativo'
  | 'ferias'
  | 'afastado'
  | 'desligado'
  | 'pre_admissao';

export type TipoContrato =
  | 'CLT'
  | 'PJ'
  | 'Estagio'
  | 'Aprendiz'
  | 'Temporario'
  | 'Autonomo';

export type RegimeHorario = '44h' | '40h' | '36h' | '30h' | '20h' | 'flexivel';

export type MotivoDesligamento =
  | 'pedido_demissao'
  | 'sem_justa_causa'
  | 'justa_causa'
  | 'acordo_mutuo'
  | 'fim_contrato'
  | 'aposentadoria';

export type CertStatus = 'valido' | 'vence_em_breve' | 'vencido';

// ── Department ────────────────────────────────────────────────────────────────

export interface Department {
  id: string;
  team_id: string;
  name: string;
  code: string | null;
  parent_id: string | null;
  cost_center: string | null;
  headcount_target: number;
  manager_id: string | null;
  created_at: string;
  updated_at: string;
  // joined
  manager?: Pick<Employee, 'id' | 'full_name' | 'matricula'> | null;
  parent?: Pick<Department, 'id' | 'name'> | null;
  employee_count?: number;
}

export interface DepartmentNode extends Department {
  children: DepartmentNode[];
}

export interface CreateDepartmentDTO {
  name: string;
  code?: string;
  parent_id?: string | null;
  cost_center?: string;
  headcount_target?: number;
  manager_id?: string | null;
}

export type UpdateDepartmentDTO = Partial<CreateDepartmentDTO>;

// ── Position ──────────────────────────────────────────────────────────────────

export interface Position {
  id: string;
  team_id: string;
  title: string;
  cbo_code: string | null;
  department_id: string | null;
  salary_min: number | null;
  salary_mid: number | null;
  salary_max: number | null;
  job_family: string | null;
  created_at: string;
}

export interface CreatePositionDTO {
  title: string;
  cbo_code?: string;
  department_id?: string | null;
  salary_min?: number | null;
  salary_mid?: number | null;
  salary_max?: number | null;
  job_family?: string;
}

// ── Employee Certification ────────────────────────────────────────────────────

export interface EmployeeCertification {
  id: string;
  employee_id: string;
  certification_name: string;
  issuing_body: string | null;
  issue_date: string | null;
  expiry_date: string | null;
  certificate_url: string | null;
  created_at: string;
  // computed
  cert_status?: CertStatus;
  days_until_expiry?: number | null;
}

export interface CreateCertificationDTO {
  employee_id: string;
  certification_name: string;
  issuing_body?: string;
  issue_date?: string;
  expiry_date?: string;
  certificate_url?: string;
}

// ── Employee Document ─────────────────────────────────────────────────────────

export interface EmployeeDocument {
  id: string;
  employee_id: string;
  document_type: string;
  filename: string;
  storage_path: string;
  uploaded_at: string;
  uploaded_by: string | null;
}

// ── Employee History ──────────────────────────────────────────────────────────

export interface EmployeeHistory {
  id: string;
  employee_id: string;
  changed_by: string;
  change_type: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  notes: string | null;
  created_at: string;
  // joined
  user?: { full_name: string } | null;
}

// ── Employee ──────────────────────────────────────────────────────────────────

export interface Employee {
  id: string;
  team_id: string;
  user_id: string | null;
  matricula: string | null;

  // Dados pessoais
  full_name: string;
  cpf: string;
  rg: string | null;
  rg_orgao_emissor: string | null;
  rg_uf: string | null;
  data_nascimento: string | null;
  sexo: 'M' | 'F' | 'O' | null;
  estado_civil: string | null;
  naturalidade: string | null;
  nacionalidade: string | null;
  nome_mae: string | null;
  nome_pai: string | null;

  // Contato
  email: string | null;
  telefone: string | null;
  celular: string | null;
  endereco_logradouro: string | null;
  endereco_numero: string | null;
  endereco_complemento: string | null;
  endereco_bairro: string | null;
  endereco_cidade: string | null;
  endereco_uf: string | null;
  endereco_cep: string | null;

  // Dados profissionais
  position_id: string | null;
  department_id: string | null;
  manager_id: string | null;
  data_admissao: string;
  tipo_contrato: TipoContrato;
  regime_horario: RegimeHorario | null;
  horario_entrada: string | null;
  horario_saida: string | null;
  horario_intervalo_minutos: number | null;

  // Dados financeiros
  salario_base: number;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
  tipo_conta: 'corrente' | 'poupanca' | null;
  pix_key: string | null;

  // Documentos legais
  pis_pasep: string | null;
  ctps_numero: string | null;
  ctps_serie: string | null;
  ctps_uf: string | null;
  titulo_eleitor: string | null;
  cnh_numero: string | null;
  cnh_categoria: string | null;
  cnh_validade: string | null;

  // Benefícios
  vt_ativo: boolean;
  vt_valor_diario: number | null;
  vr_valor_diario: number | null;
  va_valor_diario: number | null;
  plano_saude_ativo: boolean;
  plano_saude_operadora: string | null;
  plano_saude_tipo: string | null;
  plano_odonto_ativo: boolean;

  // Status
  status: EmployeeStatus;
  data_desligamento: string | null;
  motivo_desligamento: MotivoDesligamento | null;

  created_at: string;
  updated_at: string;
}

export interface EmployeeWithRelations extends Employee {
  position?: Position | null;
  department?: Department | null;
  manager?: Pick<Employee, 'id' | 'full_name' | 'matricula'> | null;
  certifications?: EmployeeCertification[];
  documents?: EmployeeDocument[];
  history?: EmployeeHistory[];
}

// ── DTO ───────────────────────────────────────────────────────────────────────

export type CreateEmployeeDTO = Omit<Employee,
  'id' | 'team_id' | 'matricula' | 'created_at' | 'updated_at'
>;

export type UpdateEmployeeDTO = Partial<CreateEmployeeDTO>;

export interface EmployeeFilters {
  status?: EmployeeStatus | 'all';
  department_id?: string | null;
  tipo_contrato?: TipoContrato | null;
  search?: string;
}

// ── Expiring certs RPC result ─────────────────────────────────────────────────

export interface ExpiringCertRow {
  employee_id: string;
  employee_name: string;
  matricula: string | null;
  certification_name: string;
  expiry_date: string;
  days_until_expiry: number;
}
