import { describe, it, expect } from 'vitest';
import {
  WIDGET_ROUTES,
  WIDGET_LABEL,
  WIDGET_DEFINITIONS,
} from '../widgetRegistry';
import { ROUTE_ROLES } from '@/src/config/routeAccess';
import type { WidgetId } from '../widgetRegistry';

const ROUTE_ROLE_VALUES = Object.values(ROUTE_ROLES);
const clickableIds = Object.keys(WIDGET_ROUTES) as WidgetId[];

describe('WIDGET_ROUTES — drill-down dos KPIs', () => {
  it('todo id clicável é um widget definido no registry', () => {
    const known = new Set(WIDGET_DEFINITIONS.map(w => w.id));
    for (const id of clickableIds) {
      expect(known.has(id), `${id} não existe em WIDGET_DEFINITIONS`).toBe(true);
    }
  });

  it('roles de cada rota vêm de ROUTE_ROLES (fonte única — nunca array hardcoded)', () => {
    // Integridade referencial: previne que alguém recrie um array divergente
    // do RoleGuard real em App.tsx, reintroduzindo clique morto.
    for (const id of clickableIds) {
      const roles = WIDGET_ROUTES[id]!.roles;
      const fromSource = ROUTE_ROLE_VALUES.some(v => v === roles);
      expect(fromSource, `${id}.roles não é uma referência de ROUTE_ROLES`).toBe(true);
    }
  });

  it('todo card clicável tem label para o aria-label (sem fallback)', () => {
    for (const id of clickableIds) {
      expect(WIDGET_LABEL.get(id), `${id} sem label`).toBeTruthy();
    }
  });

  it('o card cujo widget só aparece para um role consegue, com esse role, acessar a rota', () => {
    // Se nenhum dos roles que veem o widget puder acessar a rota, o card nunca
    // seria clicável para ninguém — sinal de mapeamento errado.
    for (const id of clickableIds) {
      const def = WIDGET_DEFINITIONS.find(w => w.id === id)!;
      const routeRoles = new Set(WIDGET_ROUTES[id]!.roles);
      const intersects = def.roles.some(r => routeRoles.has(r));
      expect(intersects, `${id}: audiência do widget não intersecta roles da rota`).toBe(true);
    }
  });

  it('CSAT permanece NÃO-clicável por decisão de UX (sem tela que exponha satisfação)', () => {
    expect(WIDGET_ROUTES['csat-avg']).toBeUndefined();
  });
});
