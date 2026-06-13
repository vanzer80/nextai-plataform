import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users, Plus, AlertTriangle, Search, Download, RefreshCw,
  UserCheck, Umbrella, UserX, AlertCircle, Loader2, ChevronRight,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/src/components/ui/select';

import { getEmployees, getEmployeeKPIs, getExpiringCerts } from '@/src/services/employeeService';
import { getDepartments } from '@/src/services/departmentService';
import type { EmployeeWithRelations, EmployeeFilters, EmployeeStatus, ExpiringCertRow } from '@/src/types/employee';
import type { Department } from '@/src/types/employee';
import EmployeeDetail from './EmployeeDetail';

const STATUS_LABEL: Record<EmployeeStatus, string> = {
  ativo: 'Ativo', ferias: 'Férias', afastado: 'Afastado',
  desligado: 'Desligado', pre_admissao: 'Pré-Admissão',
};

const STATUS_CLASS: Record<EmployeeStatus, string> = {
  ativo: 'bg-emerald-100 text-emerald-800',
  ferias: 'bg-sky-100 text-sky-800',
  afastado: 'bg-amber-100 text-amber-800',
  desligado: 'bg-rose-100 text-rose-800',
  pre_admissao: 'bg-violet-100 text-violet-800',
};

const TIPO_LABEL: Record<string, string> = {
  CLT: 'CLT', PJ: 'PJ', Estagio: 'Estágio', Aprendiz: 'Aprendiz',
  Temporario: 'Temporário', Autonomo: 'Autônomo',
};

export default function EmployeesList() {
  const navigate = useNavigate();
  const [employees, setEmployees]       = useState<EmployeeWithRelations[]>([]);
  const [departments, setDepartments]   = useState<Department[]>([]);
  const [kpis, setKpis]                 = useState({ ativo: 0, ferias: 0, afastado: 0, desligado_mes: 0, total: 0 });
  const [expiring, setExpiring]         = useState<ExpiringCertRow[]>([]);
  const [loading, setLoading]           = useState(true);
  const [selectedId, setSelectedId]     = useState<string | null>(null);
  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<EmployeeFilters['status']>('ativo');
  const [deptFilter, setDeptFilter]     = useState<string>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const filters: EmployeeFilters = {
        status: statusFilter,
        department_id: deptFilter !== 'all' ? deptFilter : undefined,
        search: search.trim() || undefined,
      };
      const [emps, deps, kpisData, certs] = await Promise.all([
        getEmployees(filters),
        getDepartments(),
        getEmployeeKPIs(),
        getExpiringCerts(30),
      ]);
      setEmployees(emps);
      setDepartments(deps);
      setKpis(kpisData);
      setExpiring(certs);
    } catch (err: any) {
      toast.error(`Erro ao carregar colaboradores: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, deptFilter, search]);

  useEffect(() => { load(); }, [load]);

  const handleExportExcel = () => {
    try {
      const rows = employees.map(e => ({
        Matrícula: e.matricula ?? '',
        Nome: e.full_name,
        CPF: e.cpf,
        Cargo: (e.position as any)?.title ?? '',
        Departamento: (e.department as any)?.name ?? '',
        'Tipo Contrato': TIPO_LABEL[e.tipo_contrato] ?? e.tipo_contrato,
        'Data Admissão': e.data_admissao ? format(parseISO(e.data_admissao), 'dd/MM/yyyy') : '',
        'Salário Base': Number(e.salario_base),
        Status: STATUS_LABEL[e.status],
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Colaboradores');
      XLSX.writeFile(wb, `Colaboradores_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
      toast.success('Excel exportado!');
    } catch {
      toast.error('Erro ao exportar.');
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-6 animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Users className="h-6 w-6 text-blue-600" />
            Colaboradores
          </h1>
          <p className="text-sm text-slate-500">Gestão de recursos humanos e quadro de pessoal</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={clsx('h-4 w-4', loading && 'animate-spin')} /> Atualizar
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportExcel} disabled={loading} className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50">
            <Download className="h-4 w-4" /> Excel
          </Button>
          <Button data-onboarding="rh-admitir" onClick={() => navigate('/rh/employees/new')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold">
            <Plus className="h-4 w-4" /> Admitir
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div data-onboarding="rh-kpis" className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Ativos',            value: kpis.ativo,         icon: UserCheck,    bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', num: 'text-emerald-900' },
          { label: 'Em Férias',         value: kpis.ferias,        icon: Umbrella,     bg: 'bg-sky-50 border-sky-200',         text: 'text-sky-700',     num: 'text-sky-900' },
          { label: 'Afastados',         value: kpis.afastado,      icon: AlertCircle,  bg: 'bg-amber-50 border-amber-200',     text: 'text-amber-700',   num: 'text-amber-900' },
          { label: 'Desligados (mês)',  value: kpis.desligado_mes, icon: UserX,        bg: 'bg-rose-50 border-rose-200',       text: 'text-rose-700',    num: 'text-rose-900' },
        ].map(k => {
          const Icon = k.icon;
          return (
            <div key={k.label} className={clsx('rounded-xl border p-4', k.bg)}>
              <div className="flex items-center justify-between mb-1">
                <Icon className={clsx('h-5 w-5', k.text)} />
                <span className={clsx('text-2xl font-extrabold tabular-nums', k.num)}>{k.value}</span>
              </div>
              <p className={clsx('text-xs font-semibold', k.text)}>{k.label}</p>
            </div>
          );
        })}
      </div>

      {/* Alerta de certificações vencendo */}
      {expiring.length > 0 && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {expiring.length} certificação{expiring.length > 1 ? 'ões' : ''} vencendo nos próximos 30 dias
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              {expiring.slice(0, 3).map(c => `${c.employee_name} — ${c.certification_name} (${c.days_until_expiry}d)`).join(' · ')}
              {expiring.length > 3 && ` · +${expiring.length - 3} mais`}
            </p>
          </div>
        </div>
      )}

      {/* Filtros */}
      <div data-onboarding="rh-filtros" className="flex flex-col sm:flex-row gap-3 bg-card border border-border rounded-xl p-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar por nome, CPF ou matrícula..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10 rounded-lg"
          />
        </div>
        <Select value={statusFilter ?? 'all'} onValueChange={v => setStatusFilter(v === 'all' ? 'all' : v as EmployeeStatus)}>
          <SelectTrigger className="h-10 w-40 rounded-lg"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {(Object.entries(STATUS_LABEL) as [EmployeeStatus, string][]).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={deptFilter} onValueChange={setDeptFilter}>
          <SelectTrigger className="h-10 w-44 rounded-lg"><SelectValue placeholder="Departamento" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            {departments.map(d => (
              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      ) : employees.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
          <p className="font-semibold text-slate-500">Nenhum colaborador encontrado.</p>
          <p className="text-sm mt-1">Ajuste os filtros ou admita um novo colaborador.</p>
        </div>
      ) : (
        <div data-onboarding="rh-tabela" className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase">Matrícula</th>
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase">Nome</th>
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase hidden sm:table-cell">Cargo</th>
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase hidden lg:table-cell">Departamento</th>
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase hidden md:table-cell">Contrato</th>
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase hidden lg:table-cell">Admissão</th>
                  <th className="text-left font-semibold text-muted-foreground px-4 py-3 text-xs uppercase">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {employees.map(emp => (
                  <tr
                    key={emp.id}
                    onClick={() => setSelectedId(emp.id)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{emp.matricula ?? '—'}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-foreground">{emp.full_name}</p>
                      <p className="text-xs text-muted-foreground">{emp.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                      {(emp.position as any)?.title ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">
                      {(emp.department as any)?.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <Badge variant="outline" className="text-xs font-normal">
                        {TIPO_LABEL[emp.tipo_contrato] ?? emp.tipo_contrato}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {emp.data_admissao ? format(parseISO(emp.data_admissao), 'dd/MM/yyyy') : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={clsx('text-xs font-semibold border-0', STATUS_CLASS[emp.status])}>
                        {STATUS_LABEL[emp.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            {employees.length} colaborador{employees.length !== 1 ? 'es' : ''} encontrado{employees.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {/* Detail drawer */}
      {selectedId && (
        <EmployeeDetail
          employeeId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
