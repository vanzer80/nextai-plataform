import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { PenLine, ClipboardList } from 'lucide-react';
import SignatureCanvas from '../SignatureCanvas';
import type { ReportFormValues } from '@/src/pages/reports/NewReport';

interface Step7Props {
  form: UseFormReturn<ReportFormValues>;
  technicianSignature: string | null;
  clientSignature: string | null;
  clientSignerName: string;
  onTechnicianSignature: (dataUrl: string | null) => void;
  onClientSignature: (dataUrl: string | null) => void;
  onClientSignerName: (name: string) => void;
}

export default function Step7SignatureSend({
  form,
  technicianSignature,
  clientSignature,
  clientSignerName,
  onTechnicianSignature,
  onClientSignature,
  onClientSignerName,
}: Step7Props) {
  const values = form.getValues();

  return (
    <div className="space-y-4">

      {/* Resumo do relatório */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-600" />
            Resumo do Relatório
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Tipo de serviço</dt>
              <dd className="text-slate-800 font-medium mt-0.5">{values.service_type ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Data</dt>
              <dd className="text-slate-800 font-medium mt-0.5">{values.service_date ?? '—'}</dd>
            </div>
            {values.os_number && (
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Nº OS</dt>
                <dd className="text-slate-800 font-medium mt-0.5">{values.os_number}</dd>
              </div>
            )}
            {values.started_at && (
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Início</dt>
                <dd className="text-slate-800 font-medium mt-0.5">{values.started_at}</dd>
              </div>
            )}
            {values.finished_at && (
              <div>
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Término</dt>
                <dd className="text-slate-800 font-medium mt-0.5">{values.finished_at}</dd>
              </div>
            )}
            {values.site_location && (
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Local</dt>
                <dd className="text-slate-800 font-medium mt-0.5">{values.site_location}</dd>
              </div>
            )}
            {values.final_diagnosis && (
              <div className="col-span-2">
                <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Diagnóstico final</dt>
                <dd className="text-slate-700 mt-0.5 leading-relaxed line-clamp-3">{values.final_diagnosis}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Assinatura do técnico */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
          <CardTitle className="text-base flex items-center gap-2">
            <PenLine className="h-4 w-4 text-blue-600" />
            Assinatura do Técnico
            <span className="ml-auto text-xs font-normal text-rose-500">Obrigatória</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <SignatureCanvas
            onSave={onTechnicianSignature}
            label="Técnico — assine aqui"
          />
          {!technicianSignature && (
            <p className="mt-2 text-xs text-rose-500">A assinatura do técnico é obrigatória para enviar o relatório.</p>
          )}
        </CardContent>
      </Card>

      {/* Assinatura do cliente */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
          <CardTitle className="text-base flex items-center gap-2">
            <PenLine className="h-4 w-4 text-slate-500" />
            Assinatura do Cliente
            <span className="ml-auto text-xs font-normal text-slate-400">Opcional</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700">Nome do responsável</Label>
            <Input
              type="text"
              value={clientSignerName}
              onChange={e => onClientSignerName(e.target.value)}
              placeholder="Nome de quem assina pelo cliente..."
              className="h-12 text-base rounded-xl bg-slate-50 border-slate-300 focus-visible:ring-blue-600"
            />
          </div>
          <SignatureCanvas
            onSave={onClientSignature}
            label="Cliente — assine aqui (opcional)"
          />
        </CardContent>
      </Card>

    </div>
  );
}
