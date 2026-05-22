import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { maintenanceStatus } from '../equipment';
import type { Equipment } from '../equipment';

function makeEquipment(overrides: Partial<Equipment> = {}): Equipment {
  return {
    id: 'test-id',
    client_id: null,
    name: 'Compressor Teste',
    type: null,
    serial_number: null,
    status: 'ativo',
    manufacturer: null,
    model: null,
    installation_date: null,
    warranty_until: null,
    maintenance_interval_days: null,
    last_maintenance_at: null,
    created_at: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('maintenanceStatus', () => {
  beforeEach(() => {
    // Fixar "hoje" = 2026-05-22 para todos os testes
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-22T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retorna sem-dados quando não há intervalo de manutenção', () => {
    const eq = makeEquipment({ maintenance_interval_days: null });
    expect(maintenanceStatus(eq)).toBe('sem-dados');
  });

  it('retorna sem-dados quando há intervalo mas sem data base', () => {
    const eq = makeEquipment({
      maintenance_interval_days: 90,
      last_maintenance_at: null,
      installation_date: null,
    });
    expect(maintenanceStatus(eq)).toBe('sem-dados');
  });

  it('retorna vencida quando preventiva está atrasada', () => {
    // Última manutenção: 2025-12-01, intervalo: 90 dias → vence 2026-03-01 (passou)
    const eq = makeEquipment({
      maintenance_interval_days: 90,
      last_maintenance_at: '2025-12-01',
    });
    expect(maintenanceStatus(eq)).toBe('vencida');
  });

  it('retorna proxima quando faltam ≤ 15 dias para vencer', () => {
    // Intervalo 90d, base 2026-02-22 → vence 2026-05-23 (amanhã = 1 dia restante)
    const eq = makeEquipment({
      maintenance_interval_days: 90,
      last_maintenance_at: '2026-02-22',
    });
    expect(maintenanceStatus(eq)).toBe('proxima');
  });

  it('retorna ok quando faltam mais de 15 dias', () => {
    // Intervalo 90d, base 2026-03-01 → vence 2026-05-30 (8 dias restantes? não, 30-22=8 < 15?)
    // 2026-03-01 + 90d = 2026-05-30 → 8 dias → proxima, ajustar...
    // Usar base recente: 2026-04-01 + 90d = 2026-06-30 → 39 dias → ok
    const eq = makeEquipment({
      maintenance_interval_days: 90,
      last_maintenance_at: '2026-04-01',
    });
    expect(maintenanceStatus(eq)).toBe('ok');
  });

  it('usa last_maintenance_at em vez de installation_date quando ambos existem', () => {
    // installation_date antiga (vencida), last_maintenance_at recente (ok)
    const eq = makeEquipment({
      maintenance_interval_days: 90,
      installation_date: '2025-01-01',   // 90d → venceria em 2025-04-01 (vencida)
      last_maintenance_at: '2026-04-01', // 90d → vence 2026-06-30 (ok)
    });
    expect(maintenanceStatus(eq)).toBe('ok');
  });

  it('usa installation_date como fallback quando last_maintenance_at é null', () => {
    // installation_date: 2025-12-01, intervalo: 90d → vence 2026-03-01 (vencida)
    const eq = makeEquipment({
      maintenance_interval_days: 90,
      installation_date: '2025-12-01',
      last_maintenance_at: null,
    });
    expect(maintenanceStatus(eq)).toBe('vencida');
  });

  it('retorna proxima exatamente no dia do vencimento (0 dias restantes)', () => {
    // Vence exatamente hoje: 2026-05-22
    // base = 2026-02-21, +90d = 2026-05-22
    const eq = makeEquipment({
      maintenance_interval_days: 90,
      last_maintenance_at: '2026-02-21',
    });
    expect(maintenanceStatus(eq)).toBe('proxima');
  });
});
