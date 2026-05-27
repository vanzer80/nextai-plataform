import { supabase } from '@/src/lib/supabase';
import type {
  Department, DepartmentNode, Position,
  CreateDepartmentDTO, UpdateDepartmentDTO, CreatePositionDTO,
} from '@/src/types/employee';

// ── Departments ───────────────────────────────────────────────────────────────

export async function getDepartments(): Promise<Department[]> {
  const { data, error } = await supabase
    .from('departments')
    .select(`
      *,
      manager:manager_id(id, full_name, matricula),
      parent:parent_id(id, name)
    `)
    .order('name');
  if (error) throw new Error(error.message);
  return (data ?? []) as Department[];
}

export async function getDepartmentTree(): Promise<DepartmentNode[]> {
  const departments = await getDepartments();
  const map = new Map<string, DepartmentNode>();
  const roots: DepartmentNode[] = [];

  departments.forEach(d => map.set(d.id, { ...d, children: [] }));
  departments.forEach(d => {
    const node = map.get(d.id)!;
    if (d.parent_id && map.has(d.parent_id)) {
      map.get(d.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

export async function getDepartmentWithHeadcount(): Promise<(Department & { employee_count: number })[]> {
  const { data, error } = await supabase
    .from('departments')
    .select(`
      *,
      manager:manager_id(id, full_name, matricula),
      employee_count:employees!employees_department_id_fkey(count)
    `);
  if (error) throw new Error(error.message);
  return (data ?? []).map((d: any) => ({
    ...d,
    employee_count: d.employee_count?.[0]?.count ?? 0,
  }));
}

export async function createDepartment(dto: CreateDepartmentDTO): Promise<Department> {
  const { data, error } = await supabase
    .from('departments')
    .insert(dto)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Department;
}

export async function updateDepartment(id: string, dto: UpdateDepartmentDTO): Promise<Department> {
  const { data, error } = await supabase
    .from('departments')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Department;
}

export async function deleteDepartment(id: string): Promise<void> {
  const { count } = await supabase
    .from('employees')
    .select('id', { count: 'exact', head: true })
    .eq('department_id', id)
    .eq('status', 'ativo');
  if ((count ?? 0) > 0) throw new Error('Departamento possui colaboradores ativos.');
  const { error } = await supabase.from('departments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ── Positions ─────────────────────────────────────────────────────────────────

export async function getPositions(): Promise<Position[]> {
  const { data, error } = await supabase
    .from('positions')
    .select('*')
    .order('title');
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createPosition(dto: CreatePositionDTO): Promise<Position> {
  const { data, error } = await supabase
    .from('positions')
    .insert(dto)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Position;
}

export async function updatePosition(id: string, dto: Partial<CreatePositionDTO>): Promise<Position> {
  const { data, error } = await supabase
    .from('positions')
    .update(dto)
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Position;
}

export async function deletePosition(id: string): Promise<void> {
  const { error } = await supabase.from('positions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
