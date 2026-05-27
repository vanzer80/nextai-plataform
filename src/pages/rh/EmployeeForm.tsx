import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  User, Briefcase, DollarSign, Heart, FileText,
  ChevronLeft, ChevronRight, Save, Loader2, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { format, parseISO } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

import { useAuth } from '@/src/contexts/AuthContext';
import { createEmployee, updateEmployee, getEmployeeById } from '@/src/services/employeeService';
import { getDepartments, getPositions } from '@/src/services/departmentService';
import { validateCPF, formatCPF, formatCEP, formatPhone, fetchAddressByCEP } from '@/src/utils/cpfValidator';
import type { Department, Position, TipoContrato, RegimeHorario } from '@/src/types/employee';

// ── Zod schema ────────────────────────────────────────────────────────────────

const schema = z.object({
  // Pessoal
  full_name: z.string().min(2, 'Nome obrigatório'),
  cpf: z.string().refine(v => validateCPF(v), 'CPF inválido'),
  rg: z.string().optional(),
  rg_orgao_emissor: z.string().optional(),
  rg_uf: z.string().optional(),
  data_nascimento: z.string().optional(),
  sexo: z.enum(['M', 'F', 'O']).optional(),
  estado_civil: z.string().optional(),
  naturalidade: z.string().optional(),
  nome_mae: z.string().optional(),

  // Contato
  email: z.string().email('E-mail inválido').optional().or(z.literal('')),
  celular: z.string().optional(),
  telefone: z.string().optional(),
  endereco_cep: z.string().optional(),
  endereco_logradouro: z.string().optional(),
  endereco_numero: z.string().optional(),
  endereco_complemento: z.string().optional(),
  endereco_bairro: z.string().optional(),
  endereco_cidade: z.string().optional(),
  endereco_uf: z.string().optional(),

  // Profissional
  data_admissao: z.string().min(1, 'Data de admissão obrigatória'),
  tipo_contrato: z.enum(['CLT', 'PJ', 'Estagio', 'Aprendiz', 'Temporario', 'Autonomo']),
  regime_horario: z.string().optional(),
  horario_entrada: z.string().optional(),
  horario_saida: z.string().optional(),
  department_id: z.string().optional().nullable(),
  position_id: z.string().optional().nullable(),
  manager_id: z.string().optional().nullable(),

  // Documentos legais
  pis_pasep: z.string().optional(),
  ctps_numero: z.string().optional(),
  ctps_serie: z.string().optional(),
  ctps_uf: z.string().optional(),
  titulo_eleitor: z.string().optional(),
  cnh_numero: z.string().optional(),
  cnh_categoria: z.string().optional(),
  cnh_validade: z.string().optional(),

  // Financeiro
  salario_base: z.preprocess(v => (v === '' || v == null ? undefined : Number(v)), z.number().min(0.01, 'Salário obrigatório')),
  banco: z.string().optional(),
  agencia: z.string().optional(),
  conta: z.string().optional(),
  tipo_conta: z.enum(['corrente', 'poupanca']).optional(),
  pix_key: z.string().optional(),

  // Benefícios
  vt_ativo: z.boolean().default(false),
  vt_valor_diario: z.coerce.number().optional().nullable(),
  vr_valor_diario: z.coerce.number().optional().nullable(),
  va_valor_diario: z.coerce.number().optional().nullable(),
  plano_saude_ativo: z.boolean().default(false),
  plano_saude_operadora: z.string().optional(),
  plano_saude_tipo: z.string().optional(),
  plano_odonto_ativo: z.boolean().default(false),

  // Status inicial
  status: z.enum(['ativo', 'pre_admissao']).default('ativo'),
});

type FormValues = z.infer<typeof schema>;

// ── Steps config ──────────────────────────────────────────────────────────────

const STEPS = [
  { id: 0, label: 'Dados Pessoais',     icon: User },
  { id: 1, label: 'Dados Profissionais', icon: Briefcase },
  { id: 2, label: 'Dados Financeiros',  icon: DollarSign },
  { id: 3, label: 'Benefícios',         icon: Heart },
  { id: 4, label: 'Documentos Legais',  icon: FileText },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmployeeForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [step, setStep]               = useState(0);
  const [saving, setSaving]           = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [positions, setPositions]     = useState<Position[]>([]);
  const [loadingCEP, setLoadingCEP]   = useState(false);

  const { register, control, handleSubmit, watch, setValue, reset,
          formState: { errors } } = useForm<FormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(schema) as any,
    defaultValues: {
      tipo_contrato: 'CLT',
      status: 'ativo',
      vt_ativo: false,
      plano_saude_ativo: false,
      plano_odonto_ativo: false,
    },
  });

  useEffect(() => {
    Promise.all([getDepartments(), getPositions()]).then(([deps, pos]) => {
      setDepartments(deps);
      setPositions(pos);
    });
    if (isEdit && id) {
      getEmployeeById(id).then(emp => {
        reset({
          ...emp,
          salario_base: emp.salario_base,
          status: emp.status === 'pre_admissao' ? 'pre_admissao' : 'ativo',
          tipo_contrato: emp.tipo_contrato as TipoContrato,
          sexo: emp.sexo ?? undefined,
          department_id: emp.department_id ?? undefined,
          position_id: emp.position_id ?? undefined,
          manager_id: emp.manager_id ?? undefined,
        } as any);
      });
    }
  }, [id, isEdit, reset]);

  const cpfValue = watch('cpf');
  const cepValue = watch('endereco_cep');
  const vtAtivo  = watch('vt_ativo');
  const psAtivo  = watch('plano_saude_ativo');

  const handleCEPBlur = async () => {
    const cep = cepValue?.replace(/\D/g, '') ?? '';
    if (cep.length !== 8) return;
    setLoadingCEP(true);
    const addr = await fetchAddressByCEP(cep);
    if (addr) {
      setValue('endereco_logradouro', addr.logradouro);
      setValue('endereco_bairro', addr.bairro);
      setValue('endereco_cidade', addr.cidade);
      setValue('endereco_uf', addr.uf);
    }
    setLoadingCEP(false);
  };

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    setSaving(true);
    try {
      const payload = {
        ...values,
        cpf: values.cpf.replace(/\D/g, ''),
        endereco_cep: values.endereco_cep?.replace(/\D/g, '') ?? null,
        celular: values.celular?.replace(/\D/g, '') ?? null,
        telefone: values.telefone?.replace(/\D/g, '') ?? null,
      } as any;

      if (isEdit && id) {
        await updateEmployee(id, payload, user.id);
        toast.success('Colaborador atualizado com sucesso!');
      } else {
        await createEmployee(payload);
        toast.success('Colaborador admitido com sucesso!');
      }
      navigate('/rh/employees');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const saveAsDraft = async () => {
    setValue('status', 'pre_admissao');
    await handleSubmit(onSubmit)();
  };

  const nextStep = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prevStep = () => setStep(s => Math.max(s - 1, 0));

  const fmtSalary = (v: number) =>
    v ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '';

  const selectedPosition = positions.find(p => p.id === watch('position_id'));

  return (
    <div className="flex flex-col gap-6 pb-8 max-w-3xl mx-auto animate-in fade-in duration-300">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate('/rh/employees')} className="gap-1 text-muted-foreground">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {isEdit ? 'Editar Colaborador' : 'Admitir Colaborador'}
          </h1>
          <p className="text-sm text-slate-500">Preencha os dados em todas as abas antes de confirmar</p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-0 bg-muted rounded-xl p-1 overflow-x-auto">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const active = step === i;
          const done = step > i;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStep(i)}
              className={clsx(
                'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap flex-1 justify-center transition-all',
                active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {done ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Icon className="h-3.5 w-3.5" />}
              <span className="hidden sm:inline">{s.label}</span>
              <span className="sm:hidden">{i + 1}</span>
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="bg-card border border-border rounded-xl p-6 space-y-5">

        {/* ── Step 0: Dados Pessoais ── */}
        {step === 0 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground border-b border-border pb-2">Dados Pessoais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label-sm">Nome Completo *</label>
                <Input {...register('full_name')} placeholder="Nome completo" className={clsx(errors.full_name && 'border-destructive')} />
                {errors.full_name && <p className="text-xs text-destructive mt-1">{errors.full_name.message}</p>}
              </div>
              <div>
                <label className="label-sm">CPF *</label>
                <Controller
                  name="cpf"
                  control={control}
                  render={({ field }) => (
                    <Input
                      {...field}
                      placeholder="000.000.000-00"
                      onChange={e => field.onChange(formatCPF(e.target.value))}
                      className={clsx(errors.cpf && 'border-destructive')}
                    />
                  )}
                />
                {errors.cpf && <p className="text-xs text-destructive mt-1">{errors.cpf.message}</p>}
              </div>
              <div>
                <label className="label-sm">Data de Nascimento</label>
                <Input {...register('data_nascimento')} type="date" />
              </div>
              <div>
                <label className="label-sm">RG</label>
                <Input {...register('rg')} placeholder="RG" />
              </div>
              <div>
                <label className="label-sm">Órgão / UF</label>
                <div className="flex gap-2">
                  <Input {...register('rg_orgao_emissor')} placeholder="SSP" className="flex-1" />
                  <Input {...register('rg_uf')} placeholder="SP" className="w-16" maxLength={2} />
                </div>
              </div>
              <div>
                <label className="label-sm">Sexo</label>
                <Controller
                  name="sexo"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="M">Masculino</SelectItem>
                        <SelectItem value="F">Feminino</SelectItem>
                        <SelectItem value="O">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <label className="label-sm">Estado Civil</label>
                <Controller
                  name="estado_civil"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {[['solteiro','Solteiro'],['casado','Casado'],['divorciado','Divorciado'],['viuvo','Viúvo'],['uniao_estavel','União Estável']].map(([v,l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <label className="label-sm">Naturalidade</label>
                <Input {...register('naturalidade')} placeholder="Cidade de nascimento" />
              </div>
              <div>
                <label className="label-sm">Nome da Mãe</label>
                <Input {...register('nome_mae')} placeholder="Nome completo da mãe" />
              </div>
            </div>

            <h3 className="font-semibold text-foreground border-b border-border pb-2 pt-2">Contato e Endereço</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-sm">E-mail</label>
                <Input {...register('email')} type="email" placeholder="email@empresa.com" className={clsx(errors.email && 'border-destructive')} />
                {errors.email && <p className="text-xs text-destructive mt-1">{errors.email.message}</p>}
              </div>
              <div>
                <label className="label-sm">Celular</label>
                <Controller
                  name="celular"
                  control={control}
                  render={({ field }) => (
                    <Input {...field} placeholder="(11) 99999-9999" onChange={e => field.onChange(formatPhone(e.target.value))} />
                  )}
                />
              </div>
              <div>
                <label className="label-sm">CEP</label>
                <div className="relative">
                  <Controller
                    name="endereco_cep"
                    control={control}
                    render={({ field }) => (
                      <Input
                        {...field}
                        placeholder="00000-000"
                        onChange={e => field.onChange(formatCEP(e.target.value))}
                        onBlur={handleCEPBlur}
                      />
                    )}
                  />
                  {loadingCEP && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
              </div>
              <div>
                <label className="label-sm">UF</label>
                <Input {...register('endereco_uf')} placeholder="SP" maxLength={2} className="uppercase" />
              </div>
              <div className="sm:col-span-2">
                <label className="label-sm">Logradouro</label>
                <Input {...register('endereco_logradouro')} placeholder="Rua, Avenida..." />
              </div>
              <div>
                <label className="label-sm">Número</label>
                <Input {...register('endereco_numero')} placeholder="123" />
              </div>
              <div>
                <label className="label-sm">Bairro</label>
                <Input {...register('endereco_bairro')} placeholder="Bairro" />
              </div>
              <div>
                <label className="label-sm">Cidade</label>
                <Input {...register('endereco_cidade')} placeholder="Cidade" />
              </div>
              <div>
                <label className="label-sm">Complemento</label>
                <Input {...register('endereco_complemento')} placeholder="Apto, Bloco..." />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 1: Dados Profissionais ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground border-b border-border pb-2">Dados Profissionais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-sm">Data de Admissão *</label>
                <Input {...register('data_admissao')} type="date" className={clsx(errors.data_admissao && 'border-destructive')} />
                {errors.data_admissao && <p className="text-xs text-destructive mt-1">{errors.data_admissao.message}</p>}
              </div>
              <div>
                <label className="label-sm">Tipo de Contrato *</label>
                <Controller
                  name="tipo_contrato"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[['CLT','CLT'],['PJ','PJ'],['Estagio','Estágio'],['Aprendiz','Aprendiz'],['Temporario','Temporário'],['Autonomo','Autônomo']].map(([v,l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <label className="label-sm">Departamento</label>
                <Controller
                  name="department_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={v => field.onChange(v || null)}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <label className="label-sm">Cargo</label>
                <Controller
                  name="position_id"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={v => field.onChange(v || null)}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {positions.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              {selectedPosition && (selectedPosition.salary_min || selectedPosition.salary_max) && (
                <div className="sm:col-span-2">
                  <div className="rounded-lg bg-blue-50 border border-blue-100 p-3 text-xs text-blue-700">
                    <span className="font-semibold">Faixa salarial do cargo:</span>{' '}
                    {selectedPosition.salary_min ? fmtSalary(selectedPosition.salary_min) : '—'}
                    {' '}→{' '}
                    {selectedPosition.salary_max ? fmtSalary(selectedPosition.salary_max) : '—'}
                    {selectedPosition.cbo_code && <span className="ml-2 font-mono">CBO: {selectedPosition.cbo_code}</span>}
                  </div>
                </div>
              )}
              <div>
                <label className="label-sm">Regime de Horário</label>
                <Controller
                  name="regime_horario"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {[['44h','44h semanais'],['40h','40h semanais'],['36h','36h semanais'],['30h','30h semanais'],['20h','20h semanais'],['flexivel','Flexível']].map(([v,l]) => (
                          <SelectItem key={v} value={v}>{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="label-sm">Entrada</label>
                  <Input {...register('horario_entrada')} type="time" />
                </div>
                <div className="flex-1">
                  <label className="label-sm">Saída</label>
                  <Input {...register('horario_saida')} type="time" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Dados Financeiros ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground border-b border-border pb-2">Dados Financeiros</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label-sm">Salário Base *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                  <Input
                    {...register('salario_base')}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0,00"
                    className={clsx('pl-9', errors.salario_base && 'border-destructive')}
                  />
                </div>
                {errors.salario_base && <p className="text-xs text-destructive mt-1">{errors.salario_base.message}</p>}
              </div>
              <div>
                <label className="label-sm">Banco</label>
                <Input {...register('banco')} placeholder="Ex: Bradesco, Itaú, Nubank" />
              </div>
              <div>
                <label className="label-sm">Agência</label>
                <Input {...register('agencia')} placeholder="0000-0" />
              </div>
              <div>
                <label className="label-sm">Conta</label>
                <Input {...register('conta')} placeholder="00000-0" />
              </div>
              <div>
                <label className="label-sm">Tipo de Conta</label>
                <Controller
                  name="tipo_conta"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value ?? ''} onValueChange={field.onChange}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="corrente">Corrente</SelectItem>
                        <SelectItem value="poupanca">Poupança</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label-sm">Chave PIX</label>
                <Input {...register('pix_key')} placeholder="CPF, e-mail, telefone ou chave aleatória" />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Benefícios ── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground border-b border-border pb-2">Benefícios</h2>

            {/* VT */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Vale Transporte</p>
                <Controller
                  name="vt_ativo"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      className={clsx('h-6 w-11 rounded-full transition-colors relative', field.value ? 'bg-blue-600' : 'bg-muted')}
                    >
                      <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', field.value ? 'translate-x-5' : 'translate-x-0.5')} />
                    </button>
                  )}
                />
              </div>
              {vtAtivo && (
                <div>
                  <label className="label-sm">Valor diário (R$)</label>
                  <Input {...register('vt_valor_diario')} type="number" step="0.01" min="0" placeholder="0,00" />
                  <p className="text-xs text-muted-foreground mt-1">O desconto em folha será de 6% do salário ou o custo real, o menor.</p>
                </div>
              )}
            </div>

            {/* VR / VA */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <p className="font-semibold text-sm">Vale Refeição / Alimentação</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label-sm">VR — Valor diário (R$)</label>
                  <Input {...register('vr_valor_diario')} type="number" step="0.01" min="0" placeholder="0,00" />
                </div>
                <div>
                  <label className="label-sm">VA — Valor diário (R$)</label>
                  <Input {...register('va_valor_diario')} type="number" step="0.01" min="0" placeholder="0,00" />
                </div>
              </div>
            </div>

            {/* Plano de Saúde */}
            <div className="rounded-xl border border-border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Plano de Saúde</p>
                <Controller
                  name="plano_saude_ativo"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      className={clsx('h-6 w-11 rounded-full transition-colors relative', field.value ? 'bg-blue-600' : 'bg-muted')}
                    >
                      <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', field.value ? 'translate-x-5' : 'translate-x-0.5')} />
                    </button>
                  )}
                />
              </div>
              {psAtivo && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-sm">Operadora</label>
                    <Input {...register('plano_saude_operadora')} placeholder="Ex: Unimed, Amil" />
                  </div>
                  <div>
                    <label className="label-sm">Tipo</label>
                    <Controller
                      name="plano_saude_tipo"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value ?? ''} onValueChange={field.onChange}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="individual">Individual</SelectItem>
                            <SelectItem value="familiar">Familiar</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Plano Odonto */}
            <div className="rounded-xl border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">Plano Odontológico</p>
                <Controller
                  name="plano_odonto_ativo"
                  control={control}
                  render={({ field }) => (
                    <button
                      type="button"
                      onClick={() => field.onChange(!field.value)}
                      className={clsx('h-6 w-11 rounded-full transition-colors relative', field.value ? 'bg-blue-600' : 'bg-muted')}
                    >
                      <span className={clsx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', field.value ? 'translate-x-5' : 'translate-x-0.5')} />
                    </button>
                  )}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Step 4: Documentos Legais ── */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-semibold text-foreground border-b border-border pb-2">Documentos Legais</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label-sm">PIS/PASEP</label>
                <Input {...register('pis_pasep')} placeholder="000.00000.00-0" />
              </div>
              <div>
                <label className="label-sm">Título de Eleitor</label>
                <Input {...register('titulo_eleitor')} placeholder="000 0000 0000" />
              </div>
              <div>
                <label className="label-sm">CTPS — Número</label>
                <Input {...register('ctps_numero')} placeholder="0000000" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="label-sm">CTPS — Série</label>
                  <Input {...register('ctps_serie')} placeholder="000" />
                </div>
                <div className="w-20">
                  <label className="label-sm">UF</label>
                  <Input {...register('ctps_uf')} placeholder="SP" maxLength={2} className="uppercase" />
                </div>
              </div>
              <div>
                <label className="label-sm">CNH — Número</label>
                <Input {...register('cnh_numero')} placeholder="00000000000" />
              </div>
              <div>
                <label className="label-sm">CNH — Categoria</label>
                <Input {...register('cnh_categoria')} placeholder="B, AB, C..." maxLength={3} className="uppercase" />
              </div>
              <div>
                <label className="label-sm">CNH — Validade</label>
                <Input {...register('cnh_validade')} type="date" />
              </div>
            </div>
          </div>
        )}

        {/* Navegação */}
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button type="button" variant="outline" onClick={prevStep} disabled={step === 0} className="gap-2">
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <div className="flex gap-2">
            {!isEdit && (
              <Button type="button" variant="outline" onClick={saveAsDraft} disabled={saving} className="text-muted-foreground">
                Salvar Rascunho
              </Button>
            )}
            {step < STEPS.length - 1 ? (
              <Button type="button" onClick={nextStep} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                Próximo <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={saving} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white min-w-[140px]">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isEdit ? 'Salvar' : 'Confirmar Admissão'}
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
