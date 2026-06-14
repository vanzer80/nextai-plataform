import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X, Edit, Award, FileText, History, ClipboardList,
  Plus, Trash2, AlertTriangle, Download, Loader2, ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';
import clsx from 'clsx';
import { format, parseISO, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/src/components/ui/select';

import { useAuth } from '@/src/contexts/AuthContext';
import {
  getEmployeeById, updateEmployeeStatus, addCertification, deleteCertification,
  uploadEmployeeDocument, deleteEmployeeDocument, getDocumentSignedUrl,
  uploadCertificationFile, getEmployeeReports,
} from '@/src/services/employeeService';
import type { EmployeeWithRelations, EmployeeStatus, MotivoDesligamento, CreateCertificationDTO } from '@/src/types/employee';
import { CERT_STATUS_LABEL, CERT_STATUS_CLASS, computeCertStatus } from '@/src/utils/certUtils';

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

interface Props {
  employeeId: string;
  onClose: () => void;
  onUpdated: () => void;
}

type Tab = 'perfil' | 'certs' | 'docs' | 'history' | 'os';

interface DismissalForm {
  motivo: MotivoDesligamento;
  data: string;
  notes: string;
}

export default function EmployeeDetail({ employeeId, onClose, onUpdated }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [emp, setEmp]               = useState<EmployeeWithRelations | null>(null);
  const [loading, setLoading]       = useState(true);
  const [tab, setTab]               = useState<Tab>('perfil');
  const [showDismiss, setShowDismiss] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [dismissForm, setDismissForm] = useState<DismissalForm>({
    motivo: 'sem_justa_causa', data: new Date().toISOString().split('T')[0], notes: '',
  });

  // Cert form
  const [showCertForm, setShowCertForm] = useState(false);
  const [certForm, setCertForm] = useState<Partial<CreateCertificationDTO>>({ certification_name: '' });
  const [savingCert, setSavingCert] = useState(false);
  const [certFile, setCertFile] = useState<File | null>(null);

  // Doc upload
  const [docType, setDocType] = useState('CPF');
  const [docFile, setDocFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getEmployeeById(employeeId);
      setEmp(data);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => { load(); }, [load]);

  const handleDismiss = async () => {
    if (!user || !emp) return;
    setDismissing(true);
    try {
      await updateEmployeeStatus(emp.id, 'desligado', user.id, {
        data_desligamento: dismissForm.data,
        motivo_desligamento: dismissForm.motivo,
        notes: dismissForm.notes || undefined,
      });
      toast.success('Colaborador desligado.');
      setShowDismiss(false);
      onUpdated();
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setDismissing(false);
    }
  };

  const handleAddCert = async () => {
    if (!certForm.certification_name || !emp) return;
    setSavingCert(true);
    try {
      let certUrl: string | undefined;
      if (certFile && user) {
        certUrl = (await uploadCertificationFile(emp.id, certFile)) ?? undefined;
      }
      await addCertification({
        employee_id: emp.id,
        certification_name: certForm.certification_name!,
        issuing_body: certForm.issuing_body,
        issue_date: certForm.issue_date,
        expiry_date: certForm.expiry_date,
        certificate_url: certUrl,
      });
      toast.success('Certificação adicionada!');
      setShowCertForm(false);
      setCertForm({ certification_name: '' });
      setCertFile(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingCert(false);
    }
  };

  const handleDeleteCert = async (id: string) => {
    if (!confirm('Remover esta certificação?')) return;
    try {
      await deleteCertification(id);
      toast.success('Removida.');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleUploadDoc = async () => {
    if (!docFile || !user || !emp) return;
    setUploadingDoc(true);
    try {
      await uploadEmployeeDocument(emp.id, docFile, docType, user.id);
      toast.success('Documento enviado!');
      setDocFile(null);
      await load();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleOpenDoc = async (storagePath: string) => {
    try {
      const url = await getDocumentSignedUrl(storagePath);
      window.open(url, '_blank');
    } catch {
      toast.error('Erro ao abrir documento.');
    }
  };

  const handleDeleteDoc = async (id: string, path: string) => {
    if (!confirm('Remover este documento?')) return;
    try {
      await deleteEmployeeDocument(id, path);
      toast.success('Removido.');
      await load();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading || !emp) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
        <div className="bg-card rounded-2xl p-8"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>
      </div>
    );
  }

  const fmtDate = (d: string | null) => d ? format(parseISO(d), 'dd/MM/yyyy') : '—';
  const fmtCurrency = (v: number | null) => v != null
    ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—';

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'perfil',  label: 'Perfil',          icon: FileText },
    { id: 'certs',   label: 'Certificações',    icon: Award },
    { id: 'docs',    label: 'Documentos',       icon: FileText },
    { id: 'history', label: 'Histórico',        icon: History },
    { id: 'os',      label: 'OS Realizadas',    icon: ClipboardList },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div
        className="bg-card h-full w-full max-w-2xl flex flex-col overflow-hidden shadow-2xl animate-in slide-in-from-right duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center font-bold text-blue-700 text-sm">
              {emp.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <p className="font-bold text-foreground leading-tight">{emp.full_name}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground font-mono">{emp.matricula ?? 'Sem matrícula'}</span>
                <Badge className={clsx('text-xs font-semibold border-0', STATUS_CLASS[emp.status])}>
                  {STATUS_LABEL[emp.status]}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate(`/rh/employees/${emp.id}/edit`)} className="gap-1.5">
              <Edit className="h-3.5 w-3.5" /> Editar
            </Button>
            {emp.status !== 'desligado' && (
              <Button variant="outline" size="sm" onClick={() => setShowDismiss(true)}
                className="gap-1.5 border-rose-200 text-rose-600 hover:bg-rose-50">
                <ShieldAlert className="h-3.5 w-3.5" /> Desligar
              </Button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted transition-colors" aria-label="Fechar">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 px-6 border-b border-border shrink-0 overflow-x-auto">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={clsx(
                  'flex items-center gap-1.5 px-3 py-3 text-xs font-semibold border-b-2 transition-colors whitespace-nowrap',
                  tab === t.id
                    ? 'border-blue-600 text-blue-700'
                    : 'border-transparent text-muted-foreground hover:text-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />{t.label}
                {t.id === 'certs' && (emp.certifications ?? []).some(c => c.cert_status !== 'valido') && (
                  <span className="h-2 w-2 rounded-full bg-amber-500 ml-0.5" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">

          {/* Perfil */}
          {tab === 'perfil' && (
            <div className="space-y-6">
              <Section title="Dados Pessoais">
                <Row label="CPF" value={emp.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')} />
                <Row label="Data Nasc." value={fmtDate(emp.data_nascimento)} />
                {emp.data_nascimento && <Row label="Idade" value={`${differenceInYears(new Date(), parseISO(emp.data_nascimento))} anos`} />}
                <Row label="RG" value={emp.rg ? `${emp.rg} ${emp.rg_orgao_emissor ?? ''} ${emp.rg_uf ?? ''}`.trim() : '—'} />
                <Row label="Estado Civil" value={emp.estado_civil ?? '—'} />
              </Section>

              <Section title="Contato">
                <Row label="E-mail" value={emp.email ?? '—'} />
                <Row label="Celular" value={emp.celular ?? '—'} />
                <Row label="Endereço" value={
                  emp.endereco_logradouro
                    ? `${emp.endereco_logradouro}, ${emp.endereco_numero ?? ''} — ${emp.endereco_cidade ?? ''}/${emp.endereco_uf ?? ''}`
                    : '—'
                } />
              </Section>

              <Section title="Dados Profissionais">
                <Row label="Cargo" value={(emp.position as any)?.title ?? '—'} />
                <Row label="Departamento" value={(emp.department as any)?.name ?? '—'} />
                <Row label="Gestor Direto" value={(emp.manager as any)?.full_name ?? '—'} />
                <Row label="Admissão" value={fmtDate(emp.data_admissao)} />
                <Row label="Tipo Contrato" value={emp.tipo_contrato} />
                <Row label="Regime" value={emp.regime_horario ?? '—'} />
              </Section>

              <Section title="Financeiro">
                <Row label="Salário Base" value={fmtCurrency(emp.salario_base)} />
                <Row label="PIX" value={emp.pix_key ?? '—'} />
                <Row label="Banco" value={emp.banco ? `${emp.banco} Ag ${emp.agencia ?? ''} C/C ${emp.conta ?? ''}` : '—'} />
              </Section>

              <Section title="Benefícios">
                <Row label="Vale Transporte" value={emp.vt_ativo ? `Ativo — R$ ${emp.vt_valor_diario?.toFixed(2) ?? '0,00'}/dia` : 'Não'} />
                <Row label="Vale Refeição" value={emp.vr_valor_diario ? `R$ ${emp.vr_valor_diario.toFixed(2)}/dia` : 'Não'} />
                <Row label="Vale Alimentação" value={emp.va_valor_diario ? `R$ ${emp.va_valor_diario.toFixed(2)}/dia` : 'Não'} />
                <Row label="Plano de Saúde" value={emp.plano_saude_ativo ? `Ativo — ${emp.plano_saude_operadora ?? ''}` : 'Não'} />
                <Row label="Plano Odonto" value={emp.plano_odonto_ativo ? 'Ativo' : 'Não'} />
              </Section>
            </div>
          )}

          {/* Certificações */}
          {tab === 'certs' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-sm font-semibold">Certificações e NRs</p>
                <Button size="sm" onClick={() => setShowCertForm(true)} className="gap-1.5 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  <Plus className="h-3.5 w-3.5" /> Adicionar
                </Button>
              </div>

              {showCertForm && (
                <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                  <p className="text-xs font-semibold text-foreground">Nova Certificação</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="label-sm">Certificação *</label>
                      <Input value={certForm.certification_name ?? ''} onChange={e => setCertForm(p => ({ ...p, certification_name: e.target.value }))} placeholder="Ex: NR-10 SEP, NR-35, PCLD" />
                    </div>
                    <div>
                      <label className="label-sm">Órgão Emissor</label>
                      <Input value={certForm.issuing_body ?? ''} onChange={e => setCertForm(p => ({ ...p, issuing_body: e.target.value }))} placeholder="SENAI, CREA..." />
                    </div>
                    <div>
                      <label className="label-sm">Data Emissão</label>
                      <Input type="date" value={certForm.issue_date ?? ''} onChange={e => setCertForm(p => ({ ...p, issue_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-sm">Validade (deixe vazio se não expira)</label>
                      <Input type="date" value={certForm.expiry_date ?? ''} onChange={e => setCertForm(p => ({ ...p, expiry_date: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label-sm">Arquivo (PDF/JPG, max 10MB)</label>
                      <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setCertFile(e.target.files?.[0] ?? null)} className="text-xs" />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="outline" onClick={() => setShowCertForm(false)} className="h-8 text-xs">Cancelar</Button>
                    <Button size="sm" onClick={handleAddCert} disabled={savingCert || !certForm.certification_name}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1">
                      {savingCert ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Salvar
                    </Button>
                  </div>
                </div>
              )}

              {(emp.certifications ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma certificação registrada.</p>
              ) : (
                <div className="space-y-2">
                  {(emp.certifications ?? []).map(c => {
                    const status = c.cert_status ?? computeCertStatus(c.expiry_date);
                    return (
                      <div key={c.id} className="flex items-start justify-between gap-3 bg-card border border-border rounded-xl p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <p className="font-semibold text-sm text-foreground">{c.certification_name}</p>
                            <Badge className={clsx('text-[10px] font-semibold border-0', CERT_STATUS_CLASS[status])}>
                              {CERT_STATUS_LABEL[status]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {c.issuing_body && <span>{c.issuing_body} · </span>}
                            {c.issue_date && <span>Emitido: {fmtDate(c.issue_date)} · </span>}
                            {c.expiry_date
                              ? <span>Validade: {fmtDate(c.expiry_date)}</span>
                              : <span>Não expira</span>}
                          </p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {c.certificate_url && (
                            <Button size="sm" variant="outline" className="h-8 w-8 p-0"
                              onClick={() => handleOpenDoc(c.certificate_url!)} aria-label="Baixar certificado">
                              <Download className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                            onClick={() => handleDeleteCert(c.id)} aria-label="Excluir certificação">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Documentos */}
          {tab === 'docs' && (
            <div className="space-y-4">
              <div className="bg-muted/30 border border-border rounded-xl p-4 space-y-3">
                <p className="text-xs font-semibold">Enviar Documento</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-sm">Tipo</label>
                    <Select value={docType} onValueChange={setDocType}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['CPF','RG','CTPS','Contrato','Exame Admissional','ASO','Foto 3x4','Comprov. Residência','Diplomas','Outro'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="label-sm">Arquivo (PDF/JPG, max 10MB)</label>
                    <Input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={e => setDocFile(e.target.files?.[0] ?? null)} className="text-xs h-9" />
                  </div>
                </div>
                <Button size="sm" onClick={handleUploadDoc} disabled={!docFile || uploadingDoc}
                  className="gap-1.5 h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                  {uploadingDoc ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />} Enviar
                </Button>
              </div>

              {(emp.documents ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhum documento enviado.</p>
              ) : (
                <div className="space-y-2">
                  {(emp.documents ?? []).map(d => (
                    <div key={d.id} className="flex items-center justify-between gap-3 bg-card border border-border rounded-lg px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold">{d.document_type}</p>
                        <p className="text-xs text-muted-foreground">{d.filename} · {format(parseISO(d.uploaded_at), 'dd/MM/yyyy')}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => handleOpenDoc(d.storage_path)} aria-label="Baixar documento">
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-rose-600 hover:bg-rose-50"
                          onClick={() => handleDeleteDoc(d.id, d.storage_path)} aria-label="Excluir documento">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Histórico */}
          {tab === 'history' && (
            <div className="space-y-2">
              {(emp.history ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhuma alteração registrada.</p>
              ) : (
                (emp.history ?? []).map(h => (
                  <div key={h.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{h.change_type.replace(/_/g, ' ')}</p>
                        <p className="text-xs text-muted-foreground">
                          por {(h.user as any)?.full_name ?? '—'} · {format(parseISO(h.created_at), "dd/MM/yyyy 'às' HH:mm")}
                        </p>
                        {h.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{h.notes}"</p>}
                      </div>
                    </div>
                    {h.old_values && h.new_values && (
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-rose-50 rounded p-2">
                          <p className="font-semibold text-rose-700 mb-1">Antes</p>
                          {Object.entries(h.old_values).map(([k, v]) => (
                            <p key={k} className="text-rose-600">{k}: {String(v)}</p>
                          ))}
                        </div>
                        <div className="bg-emerald-50 rounded p-2">
                          <p className="font-semibold text-emerald-700 mb-1">Depois</p>
                          {Object.entries(h.new_values).map(([k, v]) => (
                            <p key={k} className="text-emerald-600">{k}: {String(v)}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* OS Realizadas */}
          {tab === 'os' && (
            <div>
              {!emp.user_id ? (
                <div className="text-center py-8 text-muted-foreground">
                  <ClipboardList className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                  <p className="text-sm font-semibold">Colaborador sem conta de usuário vinculada.</p>
                  <p className="text-xs mt-1">Vincule um usuário do sistema para ver as OS realizadas.</p>
                </div>
              ) : (
                <OSRealizadas userId={emp.user_id} />
              )}
            </div>
          )}
        </div>

        {/* Modal: Desligamento */}
        {showDismiss && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 p-6">
            <div className="bg-card rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-rose-600" />
                <p className="font-bold text-foreground">Desligar Colaborador</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="label-sm">Motivo do Desligamento</label>
                  <Select value={dismissForm.motivo} onValueChange={v => setDismissForm(p => ({ ...p, motivo: v as MotivoDesligamento }))}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[['pedido_demissao','Pedido de Demissão'],['sem_justa_causa','Sem Justa Causa'],['justa_causa','Com Justa Causa'],['acordo_mutuo','Acordo Mútuo (§484-A CLT)'],['fim_contrato','Fim de Contrato'],['aposentadoria','Aposentadoria']].map(([v,l]) => (
                        <SelectItem key={v} value={v}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="label-sm">Data do Desligamento</label>
                  <Input type="date" value={dismissForm.data} onChange={e => setDismissForm(p => ({ ...p, data: e.target.value }))} />
                </div>
                <div>
                  <label className="label-sm">Observações (opcional)</label>
                  <textarea
                    value={dismissForm.notes}
                    onChange={e => setDismissForm(p => ({ ...p, notes: e.target.value }))}
                    className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-[80px] resize-none"
                    placeholder="Contexto do desligamento..."
                  />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowDismiss(false)}>Cancelar</Button>
                <Button onClick={handleDismiss} disabled={dismissing} className="gap-2 bg-rose-600 hover:bg-rose-700 text-white">
                  {dismissing ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldAlert className="h-4 w-4" />}
                  Confirmar Desligamento
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{title}</p>
      <div className="bg-muted/20 rounded-xl border border-border divide-y divide-border">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4">
      <p className="text-xs font-medium text-muted-foreground shrink-0">{label}</p>
      <p className="text-sm text-right text-foreground truncate">{value}</p>
    </div>
  );
}

function OSRealizadas({ userId }: { userId: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getEmployeeReports(userId).then(rows => {
      setReports(rows);
      setLoading(false);
    });
  }, [userId]);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>;
  if (reports.length === 0) return <p className="text-sm text-muted-foreground text-center py-6">Nenhuma OS encontrada.</p>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{reports.length} OS encontrada{reports.length !== 1 ? 's' : ''}</p>
      {reports.map(r => (
        <div key={r.id} className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-3">
          <div>
            <p className="text-sm font-semibold">{r.os_number ?? `OS ${r.id.slice(0, 8)}`}</p>
            <p className="text-xs text-muted-foreground">{r.service_type ?? '—'} · {r.service_date ? format(parseISO(r.service_date), 'dd/MM/yyyy') : '—'}</p>
          </div>
          <Badge variant="outline" className="text-xs">{r.status}</Badge>
        </div>
      ))}
    </div>
  );
}
