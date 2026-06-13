import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, History, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { listarVersoes } from '@/src/services/orcamentoService';
import type { OrcamentoVersion } from '@/src/types/orcamento';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

interface Props {
  orcamentoId: string;
}

export default function OrcamentoVersionHistory({ orcamentoId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [versions, setVersions] = useState<OrcamentoVersion[]>([]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listarVersoes(orcamentoId)
      .then(setVersions)
      .catch(() => { /* silent */ })
      .finally(() => setLoading(false));
  }, [open, orcamentoId]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center justify-between w-full text-left"
          aria-expanded={open}
        >
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            Histórico de versões
          </CardTitle>
          {open
            ? <ChevronUp className="h-4 w-4 text-slate-400" />
            : <ChevronDown className="h-4 w-4 text-slate-400" />}
        </button>
      </CardHeader>

      {open && (
        <CardContent className="pt-0">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
            </div>
          ) : versions.length === 0 ? (
            <p className="text-sm text-slate-500 py-4 text-center">
              Nenhuma versão anterior registrada.
            </p>
          ) : (
            <div className="flex flex-col gap-4">
              {versions.map(v => (
                <VersionCard key={v.id} version={v} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

interface VersionCardProps {
  version: OrcamentoVersion;
  key?: React.Key;
}

function VersionCard({ version: v }: VersionCardProps) {
  const subtotal = v.itens.reduce((acc, i) => acc + i.quantidade * i.valor_unitario, 0);
  const desconto = subtotal * (v.desconto_pct / 100);
  const total = subtotal - desconto;

  return (
    <div className="border border-slate-200 rounded-xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
            v{v.version}
          </span>
          {v.titulo && (
            <span className="text-sm font-medium text-slate-800">{v.titulo}</span>
          )}
          {v.validade && (
            <span className="text-xs text-slate-500">
              válido até {formatDate(v.validade)}
            </span>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-slate-500">{formatDateTime(v.changed_at)}</p>
          {v.users?.full_name && (
            <p className="text-xs text-slate-400">{v.users.full_name}</p>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-400 border-b border-slate-100">
              <th className="text-left py-1.5 pr-3 font-medium">Descrição</th>
              <th className="text-right py-1.5 pr-3 font-medium w-20">Qtd</th>
              <th className="text-right py-1.5 font-medium w-24">Total</th>
            </tr>
          </thead>
          <tbody>
            {v.itens.map((item, i) => (
              <tr key={i} className="border-b border-slate-50 last:border-0">
                <td className="py-1.5 pr-3 text-slate-700">{item.descricao}</td>
                <td className="py-1.5 pr-3 text-right text-slate-500">
                  {item.quantidade} {item.unidade}
                </td>
                <td className="py-1.5 text-right text-slate-600">
                  {BRL.format(item.quantidade * item.valor_unitario)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-slate-100 pt-2">
        {v.desconto_pct > 0 && (
          <span className="text-xs text-slate-400">Desconto {v.desconto_pct}%</span>
        )}
        <span className="text-xs font-bold text-slate-700 ml-auto">
          Total: {BRL.format(total)}
        </span>
      </div>
    </div>
  );
}
