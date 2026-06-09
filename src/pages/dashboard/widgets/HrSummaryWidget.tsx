import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Landmark, Banknote, AlertTriangle, ChevronRight } from 'lucide-react';
import { getEmployeeKPIs } from '@/src/services/employeeService';
import { getPayableKPIs } from '@/src/services/payableService';
import { getExpiringCerts } from '@/src/services/employeeService';

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

interface Card {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  href: string;
  accent: string;
  alert?: boolean;
}

export function HrSummaryWidget() {
  const [cards, setCards] = useState<Card[]>([]);

  useEffect(() => {
    Promise.allSettled([
      getEmployeeKPIs(),
      getPayableKPIs(),
      getExpiringCerts(30),
    ]).then(([empResult, cpResult, certResult]) => {
      const emp  = empResult.status  === 'fulfilled' ? empResult.value  : null;
      const cp   = cpResult.status   === 'fulfilled' ? cpResult.value   : null;
      const certs = certResult.status === 'fulfilled' ? certResult.value : [];

      const built: Card[] = [];

      if (emp) {
        built.push({
          icon: Users, label: 'Colaboradores Ativos', value: String(emp.ativo),
          sub: `${emp.ferias} em férias · ${emp.afastado} afastados`,
          href: '/rh/employees', accent: 'text-emerald-600',
        });
      }

      if (certs.length > 0) {
        built.push({
          icon: AlertTriangle, label: 'Certificações Vencendo', value: String(certs.length),
          sub: 'Nos próximos 30 dias',
          href: '/rh/employees', accent: 'text-amber-600', alert: true,
        });
      }

      if (cp) {
        built.push({
          icon: Banknote, label: 'A Pagar (vencido)', value: BRL.format(cp.vencido),
          sub: `${cp.count_pendente} aguardando aprovação`,
          href: '/cp/payables', accent: cp.vencido > 0 ? 'text-rose-600' : 'text-foreground',
          alert: cp.vencido > 0,
        });
        built.push({
          icon: Landmark, label: 'Aprovado a Pagar', value: BRL.format(cp.total_aprovado),
          sub: `Pago no mês: ${BRL.format(cp.pago_mes)}`,
          href: '/cp/payables', accent: 'text-sky-600',
        });
      }

      setCards(built);
    });
  }, []);

  if (cards.length === 0) return null;

  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-3 uppercase tracking-wide">Gestão de Pessoas & Financeiro</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map(card => (
          <Link
            key={card.label}
            to={card.href}
            className={`group bg-card border rounded-xl p-4 hover:border-blue-300 transition-colors ${card.alert ? 'border-amber-200 bg-amber-50/50' : 'border-border'}`}
          >
            <div className="flex items-start justify-between">
              <div className={`p-1.5 rounded-lg ${card.alert ? 'bg-amber-100' : 'bg-muted'}`}>
                <card.icon className={`h-4 w-4 ${card.alert ? 'text-amber-600' : 'text-muted-foreground'}`} />
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xs text-muted-foreground mt-3">{card.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${card.accent}`}>{card.value}</p>
            {card.sub && <p className="text-[11px] text-muted-foreground mt-0.5">{card.sub}</p>}
          </Link>
        ))}
      </div>
    </div>
  );
}
