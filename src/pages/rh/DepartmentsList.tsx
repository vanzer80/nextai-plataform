import React, { useState, useEffect, useCallback } from 'react';
import { Network, Plus, Edit, Trash2, Users, Loader2, ChevronRight, ChevronDown, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import {
  getDepartmentWithHeadcount, createDepartment, updateDepartment, deleteDepartment,
  getPositions, createPosition, deletePosition,
} from '@/src/services/departmentService';
import type { Department, Position, CreateDepartmentDTO, CreatePositionDTO } from '@/src/types/employee';

// ── Org chart tree node ───────────────────────────────────────────────────────

type DeptWithCount = Department & { employee_count?: number };

interface DeptNodeProps {
  dept: DeptWithCount;
  allDepts: DeptWithCount[];
  depth?: number;
  onEdit: (d: Department) => void;
  onDelete: (d: Department) => void;
}

const DeptNode: React.FC<DeptNodeProps> = ({
  dept,
  allDepts,
  depth = 0,
  onEdit,
  onDelete,
}) => {
  const [expanded, setExpanded] = useState(true);
  const children = allDepts.filter(d => d.parent_id === dept.id);
  const hasChildren = children.length > 0;

  return (
    <div className={clsx('relative', depth > 0 && 'ml-6 before:absolute before:left-0 before:top-6 before:h-px before:w-4 before:bg-border')}>
      <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-4 py-3 hover:border-blue-200 transition-colors">
        {hasChildren ? (
          <button onClick={() => setExpanded(e => !e)} className="text-muted-foreground">
            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        ) : (
          <div className="w-4" />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-foreground">{dept.name}</p>
            {dept.code && <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{dept.code}</span>}
            {dept.cost_center && <span className="text-[10px] text-muted-foreground">CC: {dept.cost_center}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3 w-3" />
              {dept.employee_count ?? 0} / {dept.headcount_target} colaboradores
            </span>
            {(dept.employee_count ?? 0) > dept.headcount_target && dept.headcount_target > 0 && (
              <Badge className="text-[10px] bg-amber-100 text-amber-700 border-0">Acima do headcount</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => onEdit(dept)}>
            <Edit className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50" onClick={() => onDelete(dept)}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {expanded && children.map(child => (
        <DeptNode dept={child} allDepts={allDepts} depth={depth + 1} onEdit={onEdit} onDelete={onDelete} key={child.id} />
      ))}
    </div>
  );
};

// ── Dept form ─────────────────────────────────────────────────────────────────

function DeptForm({
  allDepts,
  editing,
  onSave,
  onCancel,
}: {
  allDepts: Department[];
  editing: Department | null;
  onSave: (dto: CreateDepartmentDTO) => Promise<void>;
  onCancel: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<CreateDepartmentDTO>({
    name: editing?.name ?? '',
    code: editing?.code ?? '',
    parent_id: editing?.parent_id ?? null,
    cost_center: editing?.cost_center ?? '',
    headcount_target: editing?.headcount_target ?? 0,
  });

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Nome obrigatório'); return; }
    setSaving(true);
    try {
      await onSave({ ...form, code: form.code || undefined, cost_center: form.cost_center || undefined });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-muted/30 border border-border rounded-xl p-5 space-y-4">
      <p className="font-semibold text-sm">{editing ? 'Editar Departamento' : 'Novo Departamento'}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className="label-sm">Nome *</label>
          <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Ex: Engenharia de Campo" />
        </div>
        <div>
          <label className="label-sm">Código</label>
          <Input value={form.code ?? ''} onChange={e => setForm(p => ({ ...p, code: e.target.value }))} placeholder="Ex: ENG-01" />
        </div>
        <div>
          <label className="label-sm">Centro de Custo</label>
          <Input value={form.cost_center ?? ''} onChange={e => setForm(p => ({ ...p, cost_center: e.target.value }))} placeholder="Ex: CC-001" />
        </div>
        <div>
          <label className="label-sm">Headcount Alvo</label>
          <Input type="number" min="0" value={form.headcount_target ?? 0} onChange={e => setForm(p => ({ ...p, headcount_target: parseInt(e.target.value) || 0 }))} />
        </div>
        <div>
          <label className="label-sm">Departamento Pai</label>
          <Select value={form.parent_id ?? ''} onValueChange={v => setForm(p => ({ ...p, parent_id: v || null }))}>
            <SelectTrigger className="h-10"><SelectValue placeholder="Nenhum (raiz)" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Nenhum (raiz)</SelectItem>
              {allDepts.filter(d => d.id !== editing?.id).map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <Button variant="outline" size="sm" onClick={onCancel}><X className="h-3.5 w-3.5" /></Button>
        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salvar
        </Button>
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function DepartmentsList() {
  const [departments, setDepartments] = useState<(Department & { employee_count?: number })[]>([]);
  const [positions, setPositions]     = useState<Position[]>([]);
  const [loading, setLoading]         = useState(true);
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [editingDept, setEditingDept]   = useState<Department | null>(null);
  const [showPosForm, setShowPosForm]   = useState(false);
  const [posForm, setPosForm]           = useState<CreatePositionDTO>({ title: '' });
  const [savingPos, setSavingPos]       = useState(false);
  const [tab, setTab]                   = useState<'deps' | 'positions'>('deps');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [deps, pos] = await Promise.all([getDepartmentWithHeadcount(), getPositions()]);
      setDepartments(deps);
      setPositions(pos);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveDept = async (dto: CreateDepartmentDTO) => {
    try {
      if (editingDept) {
        await updateDepartment(editingDept.id, dto);
        toast.success('Departamento atualizado!');
      } else {
        await createDepartment(dto);
        toast.success('Departamento criado!');
      }
      setShowDeptForm(false);
      setEditingDept(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleDeleteDept = async (dept: Department) => {
    if (!confirm(`Remover departamento "${dept.name}"?`)) return;
    try {
      await deleteDepartment(dept.id);
      toast.success('Removido.');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleSavePosition = async () => {
    if (!posForm.title.trim()) { toast.error('Título obrigatório'); return; }
    setSavingPos(true);
    try {
      await createPosition(posForm);
      toast.success('Cargo criado!');
      setPosForm({ title: '' });
      setShowPosForm(false);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingPos(false);
    }
  };

  const handleDeletePosition = async (id: string, title: string) => {
    if (!confirm(`Remover cargo "${title}"?`)) return;
    try {
      await deletePosition(id);
      toast.success('Removido.');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const roots = departments.filter(d => !d.parent_id);

  return (
    <div className="flex flex-col gap-6 pb-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Network className="h-6 w-6 text-blue-600" />
            Estrutura Organizacional
          </h1>
          <p className="text-sm text-slate-500">Departamentos, centros de custo e cargos</p>
        </div>
        <Button data-onboarding="rh-dep-novo" onClick={() => { setEditingDept(null); setShowDeptForm(true); }} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4" /> Novo Departamento
        </Button>
      </div>

      {/* Tabs */}
      <div data-onboarding="rh-dep-tabs" className="flex gap-1 bg-muted rounded-xl p-1 w-fit">
        {[['deps', 'Org Chart'], ['positions', 'Cargos']] .map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id as 'deps' | 'positions')}
            className={clsx('px-4 py-2 rounded-lg text-sm font-semibold transition-all',
              tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : tab === 'deps' ? (
        <div className="space-y-3">
          {(showDeptForm || editingDept) && (
            <DeptForm
              allDepts={departments}
              editing={editingDept}
              onSave={handleSaveDept}
              onCancel={() => { setShowDeptForm(false); setEditingDept(null); }}
            />
          )}
          {departments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Network className="h-12 w-12 mx-auto mb-3 text-slate-300" />
              <p className="font-semibold text-slate-500">Nenhum departamento criado.</p>
              <p className="text-sm mt-1">Crie departamentos para organizar sua equipe.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {roots.map(d => (
                <DeptNode dept={d} allDepts={departments} onEdit={dept => { setEditingDept(dept); setShowDeptForm(false); }} onDelete={handleDeleteDept} key={d.id} />
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowPosForm(true)} className="gap-1.5 h-9 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="h-3.5 w-3.5" /> Novo Cargo
            </Button>
          </div>

          {showPosForm && (
            <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold">Novo Cargo</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="label-sm">Título *</label>
                  <Input value={posForm.title} onChange={e => setPosForm(p => ({ ...p, title: e.target.value }))} placeholder="Ex: Técnico de Manutenção Sr." />
                </div>
                <div>
                  <label className="label-sm">CBO</label>
                  <Input value={posForm.cbo_code ?? ''} onChange={e => setPosForm(p => ({ ...p, cbo_code: e.target.value }))} placeholder="9999-99" />
                </div>
                <div>
                  <label className="label-sm">Família</label>
                  <Input value={posForm.job_family ?? ''} onChange={e => setPosForm(p => ({ ...p, job_family: e.target.value }))} placeholder="Ex: Técnico" />
                </div>
                <div>
                  <label className="label-sm">Sal. Mínimo (R$)</label>
                  <Input type="number" min="0" step="0.01" value={posForm.salary_min ?? ''} onChange={e => setPosForm(p => ({ ...p, salary_min: parseFloat(e.target.value) || null }))} />
                </div>
                <div>
                  <label className="label-sm">Sal. Máximo (R$)</label>
                  <Input type="number" min="0" step="0.01" value={posForm.salary_max ?? ''} onChange={e => setPosForm(p => ({ ...p, salary_max: parseFloat(e.target.value) || null }))} />
                </div>
                <div>
                  <label className="label-sm">Departamento</label>
                  <Select value={posForm.department_id ?? ''} onValueChange={v => setPosForm(p => ({ ...p, department_id: v || null }))}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" size="sm" onClick={() => setShowPosForm(false)}><X className="h-3.5 w-3.5" /></Button>
                <Button size="sm" onClick={handleSavePosition} disabled={savingPos} className="gap-1.5 bg-blue-600 hover:bg-blue-700 text-white">
                  {savingPos ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Criar
                </Button>
              </div>
            </div>
          )}

          {positions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhum cargo cadastrado.</p>
          ) : (
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase">Cargo</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase hidden sm:table-cell">CBO</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase hidden md:table-cell">Família</th>
                    <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase hidden lg:table-cell">Faixa Salarial</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {positions.map(p => (
                    <tr key={p.id}>
                      <td className="px-4 py-3 font-semibold">{p.title}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground hidden sm:table-cell">{p.cbo_code ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{p.job_family ?? '—'}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                        {p.salary_min ? `R$ ${p.salary_min.toLocaleString('pt-BR')}` : '—'} – {p.salary_max ? `R$ ${p.salary_max.toLocaleString('pt-BR')}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50" onClick={() => handleDeletePosition(p.id, p.title)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
