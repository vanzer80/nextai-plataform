import { supabase } from '@/src/lib/supabase';
import type {
  Employee, EmployeeWithRelations, EmployeeCertification, EmployeeDocument,
  CreateEmployeeDTO, UpdateEmployeeDTO, EmployeeFilters,
  CreateCertificationDTO, ExpiringCertRow, EmployeeStatus,
} from '@/src/types/employee';
import { computeCertStatus } from '@/src/utils/certUtils';

// ── Queries ───────────────────────────────────────────────────────────────────

const EMPLOYEE_LIST_SELECT = `
  id, team_id, user_id, matricula, full_name, cpf, data_nascimento,
  sexo, estado_civil, email, celular, telefone,
  data_admissao, tipo_contrato, regime_horario, salario_base,
  status, data_desligamento, motivo_desligamento,
  position_id, department_id, manager_id,
  vt_ativo, vr_valor_diario, va_valor_diario,
  plano_saude_ativo, plano_odonto_ativo,
  created_at, updated_at,
  position:position_id(id, title, salary_min, salary_mid, salary_max),
  department:department_id(id, name, code),
  manager:manager_id(id, full_name, matricula)
`;

const EMPLOYEE_DETAIL_SELECT = `
  *,
  position:position_id(id, title, cbo_code, salary_min, salary_mid, salary_max, job_family),
  department:department_id(id, name, code, cost_center),
  manager:manager_id(id, full_name, matricula),
  certifications:employee_certifications(
    id, certification_name, issuing_body, issue_date, expiry_date, certificate_url, created_at
  ),
  documents:employee_documents(
    id, document_type, filename, storage_path, uploaded_at, uploaded_by
  ),
  history:employee_history(
    id, change_type, old_values, new_values, notes, created_at,
    user:changed_by(full_name)
  )
`;

// ── List ──────────────────────────────────────────────────────────────────────

export async function getEmployees(filters: EmployeeFilters = {}): Promise<EmployeeWithRelations[]> {
  let q = supabase.from('employees').select(EMPLOYEE_LIST_SELECT);

  if (filters.status && filters.status !== 'all') q = q.eq('status', filters.status);
  if (filters.department_id) q = q.eq('department_id', filters.department_id);
  if (filters.tipo_contrato) q = q.eq('tipo_contrato', filters.tipo_contrato);
  if (filters.search) {
    q = q.or(
      `full_name.ilike.%${filters.search}%,cpf.ilike.%${filters.search}%,matricula.ilike.%${filters.search}%`,
    );
  }

  const { data, error } = await q.order('full_name');
  if (error) throw new Error(error.message);
  return (data ?? []) as EmployeeWithRelations[];
}

export async function getEmployeeById(id: string): Promise<EmployeeWithRelations> {
  const { data, error } = await supabase
    .from('employees')
    .select(EMPLOYEE_DETAIL_SELECT)
    .eq('id', id)
    .single();
  if (error) throw new Error(error.message);
  const emp = data as EmployeeWithRelations;
  // Compute certification statuses client-side
  emp.certifications = (emp.certifications ?? []).map(c => ({
    ...c,
    cert_status: computeCertStatus(c.expiry_date),
    days_until_expiry: c.expiry_date
      ? Math.floor((new Date(c.expiry_date).getTime() - Date.now()) / 86_400_000)
      : null,
  }));
  return emp;
}

// ── KPIs ──────────────────────────────────────────────────────────────────────

export async function getEmployeeKPIs(): Promise<{
  ativo: number; ferias: number; afastado: number; desligado_mes: number; total: number;
}> {
  const { data, error } = await supabase
    .from('employees')
    .select('status, data_desligamento');
  if (error) throw new Error(error.message);
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const rows = data ?? [];
  return {
    ativo:          rows.filter(r => r.status === 'ativo').length,
    ferias:         rows.filter(r => r.status === 'ferias').length,
    afastado:       rows.filter(r => r.status === 'afastado').length,
    desligado_mes:  rows.filter(r =>
      r.status === 'desligado' && r.data_desligamento && r.data_desligamento >= startOfMonth
    ).length,
    total:          rows.length,
  };
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createEmployee(dto: CreateEmployeeDTO): Promise<Employee> {
  const teamRes = await supabase.from('users').select('team_id').eq('id', (await supabase.auth.getUser()).data.user!.id).single();
  if (teamRes.error) throw new Error(teamRes.error.message);
  const team_id = teamRes.data.team_id;

  // Generate matricula via RPC
  const { data: mat, error: matErr } = await supabase.rpc('generate_employee_matricula', { p_team_id: team_id });
  if (matErr) throw new Error(matErr.message);

  const { data, error } = await supabase
    .from('employees')
    .insert({ ...dto, team_id, matricula: mat })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Employee;
}

// ── Update ────────────────────────────────────────────────────────────────────

export async function updateEmployee(id: string, dto: UpdateEmployeeDTO, userId: string, notes?: string): Promise<Employee> {
  // Fetch current for history
  const { data: current } = await supabase.from('employees').select('*').eq('id', id).single();

  const { data, error } = await supabase.from('employees').update(dto).eq('id', id).select().single();
  if (error) throw new Error(error.message);

  // Log history for key changes
  const tracked = ['status', 'salario_base', 'position_id', 'department_id', 'motivo_desligamento'];
  const changed = tracked.filter(k => (current as any)?.[k] !== (dto as any)[k] && (dto as any)[k] !== undefined);
  if (changed.length > 0) {
    const changeType = dto.status && dto.status !== current?.status ? `mudanca_status_${dto.status}` : 'atualizacao';
    await supabase.from('employee_history').insert({
      employee_id: id,
      changed_by: userId,
      change_type: changeType,
      old_values: Object.fromEntries(changed.map(k => [k, (current as any)[k]])),
      new_values: Object.fromEntries(changed.map(k => [k, (dto as any)[k]])),
      notes: notes ?? null,
    });
  }
  return data as Employee;
}

export async function updateEmployeeStatus(
  id: string,
  status: EmployeeStatus,
  userId: string,
  meta?: { data_desligamento?: string; motivo_desligamento?: string; notes?: string },
): Promise<Employee> {
  const dto: UpdateEmployeeDTO = { status };
  if (meta?.data_desligamento) dto.data_desligamento = meta.data_desligamento;
  if (meta?.motivo_desligamento) dto.motivo_desligamento = meta.motivo_desligamento as any;
  return updateEmployee(id, dto, userId, meta?.notes);
}

// ── Certifications ────────────────────────────────────────────────────────────

export async function addCertification(dto: CreateCertificationDTO): Promise<EmployeeCertification> {
  const { data, error } = await supabase
    .from('employee_certifications')
    .insert(dto)
    .select()
    .single();
  if (error) throw new Error(error.message);
  const c = data as EmployeeCertification;
  return {
    ...c,
    cert_status: computeCertStatus(c.expiry_date),
    days_until_expiry: c.expiry_date
      ? Math.floor((new Date(c.expiry_date).getTime() - Date.now()) / 86_400_000)
      : null,
  };
}

export async function deleteCertification(id: string): Promise<void> {
  const { error } = await supabase.from('employee_certifications').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getExpiringCerts(days = 30): Promise<ExpiringCertRow[]> {
  const teamRes = await supabase.from('users').select('team_id').eq('id', (await supabase.auth.getUser()).data.user!.id).single();
  if (teamRes.error) return [];
  const { data, error } = await supabase.rpc('get_employees_with_expiring_certs', {
    p_team_id: teamRes.data.team_id,
    p_days: days,
  });
  if (error) return [];
  return data ?? [];
}

// ── Documents ─────────────────────────────────────────────────────────────────

export async function uploadEmployeeDocument(
  employeeId: string, file: File, documentType: string, uploadedBy: string,
): Promise<EmployeeDocument> {
  const ext = file.name.split('.').pop();
  const path = `employees/${employeeId}/${Date.now()}.${ext}`;
  const { error: uploadError } = await supabase.storage.from('employee_documents').upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from('employee_documents')
    .insert({ employee_id: employeeId, document_type: documentType, filename: file.name, storage_path: path, uploaded_by: uploadedBy })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as EmployeeDocument;
}

export async function deleteEmployeeDocument(id: string, storagePath: string): Promise<void> {
  await supabase.storage.from('employee_documents').remove([storagePath]);
  const { error } = await supabase.from('employee_documents').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getDocumentSignedUrl(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage.from('employee_documents').createSignedUrl(storagePath, 3600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}
