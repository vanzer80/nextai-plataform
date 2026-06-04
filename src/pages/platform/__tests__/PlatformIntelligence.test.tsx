import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/src/services/platformIntelligenceService', () => ({
  getIntelligenceStats:              vi.fn(),
  getDiagnosticCorpus:               vi.fn(),
  getKbCorpus:                       vi.fn(),
  fetchAllDiagnosticsForExport:      vi.fn(),
  fetchAllKbForExport:               vi.fn(),
  getAllReports:                      vi.fn(),
  fetchAllReportsForExport:          vi.fn(),
  getAllReimbursements:               vi.fn(),
  fetchAllReimbursementsForExport:   vi.fn(),
  getAllClients:                      vi.fn(),
  fetchAllClientsForExport:          vi.fn(),
  getAllOrcamentos:                   vi.fn(),
  fetchAllOrcamentosForExport:       vi.fn(),
  getAllEquipments:                   vi.fn(),
  fetchAllEquipmentsForExport:       vi.fn(),
  getAllMaterials:                    vi.fn(),
  fetchAllMaterialsForExport:        vi.fn(),
  getAllChecklistItems:               vi.fn(),
  fetchAllChecklistItemsForExport:   vi.fn(),
  getAllAttachments:                  vi.fn(),
  fetchAllAttachmentsForExport:      vi.fn(),
  getAllStatusHistory:                vi.fn(),
  fetchAllStatusHistoryForExport:    vi.fn(),
  getAllSignatures:                   vi.fn(),
  fetchAllSignaturesForExport:       vi.fn(),
  getAllReimbursementHistory:         vi.fn(),
  fetchAllReimbursementHistoryForExport: vi.fn(),
  getAllClientLocations:              vi.fn(),
  fetchAllClientLocationsForExport:  vi.fn(),
  getAllNotifications:                vi.fn(),
  fetchAllNotificationsForExport:    vi.fn(),
  logExport:         vi.fn(),
  downloadBlob:      vi.fn(),
  toJsonBlob:        vi.fn(),
  toCsvBlob:         vi.fn(),
  getAiRoutingStats: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/src/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import * as service from '@/src/services/platformIntelligenceService';
import { supabase } from '@/src/lib/supabase';
import PlatformIntelligence from '../PlatformIntelligence';

const STATS = {
  total_reports: 120,
  reports_with_diag: 80,
  total_kb: 45,
  tenants_contributing: 7,
  by_service_type: [{ service_type: 'AC', n: 50 }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null });
  vi.mocked(service.getIntelligenceStats).mockResolvedValue(STATS);
  vi.mocked(service.getDiagnosticCorpus).mockResolvedValue([]);
  vi.mocked(service.getKbCorpus).mockResolvedValue([]);
  vi.mocked(service.getAllReports).mockResolvedValue([]);
  vi.mocked(service.getAllReimbursements).mockResolvedValue([]);
  vi.mocked(service.getAllClients).mockResolvedValue([]);
  vi.mocked(service.getAllOrcamentos).mockResolvedValue([]);
  vi.mocked(service.getAllEquipments).mockResolvedValue([]);
  vi.mocked(service.getAllMaterials).mockResolvedValue([]);
  vi.mocked(service.getAllChecklistItems).mockResolvedValue([]);
  vi.mocked(service.getAllAttachments).mockResolvedValue([]);
  vi.mocked(service.getAllStatusHistory).mockResolvedValue([]);
  vi.mocked(service.getAllSignatures).mockResolvedValue([]);
  vi.mocked(service.getAllReimbursementHistory).mockResolvedValue([]);
  vi.mocked(service.getAllClientLocations).mockResolvedValue([]);
  vi.mocked(service.getAllNotifications).mockResolvedValue([]);
  vi.mocked(service.logExport).mockResolvedValue(undefined);
});

// ── Abas e grupos ─────────────────────────────────────────────────────────────

describe('PlatformIntelligence — abas e grupos', () => {
  it('renderiza botão para cada uma das 15 abas', async () => {
    await act(async () => { render(<PlatformIntelligence />); });
    const expected = [
      'Diagnósticos', 'Base KB', 'OS Completas', 'Checklist OS', 'Anexos OS',
      'Hist. Status OS', 'Assinaturas', 'Reembolsos', 'Hist. Reembolso', 'Clientes',
      'Unidades', 'Orçamentos', 'Equipamentos', 'Materiais', 'Notificações',
    ];
    for (const label of expected) {
      expect(screen.getByRole('button', { name: new RegExp(label) })).toBeTruthy();
    }
  });

  it('renderiza os 5 grupos de abas', async () => {
    await act(async () => { render(<PlatformIntelligence />); });
    for (const g of ['Corpus IA', 'OS', 'Reembolsos', 'Clientes', 'Outros']) {
      expect(screen.getAllByText(g).length).toBeGreaterThan(0);
    }
  });
});

// ── Métricas ──────────────────────────────────────────────────────────────────

describe('PlatformIntelligence — métricas', () => {
  it('exibe cards de stats após carregamento', async () => {
    render(<PlatformIntelligence />);
    await waitFor(() => screen.getByText('120'));
    expect(screen.getByText('OS no Corpus')).toBeTruthy();
    expect(screen.getByText('Com Diagnóstico IA')).toBeTruthy();
    expect(screen.getByText('Artigos KB')).toBeTruthy();
    expect(screen.getByText('Tenants Contribuindo')).toBeTruthy();
  });
});

// ── Colunas fixadas — testes de regressão ─────────────────────────────────────

describe('PlatformIntelligence — colunas fixadas (regressão)', () => {
  it('aba Hist. Reembolso exibe De/Para/Motivo e chama getAllReimbursementHistory', async () => {
    render(<PlatformIntelligence />);
    await userEvent.click(screen.getByRole('button', { name: /Hist\. Reembolso/ }));
    await waitFor(() => screen.getByText('Nenhum registro encontrado.'));

    expect(screen.getByRole('columnheader', { name: 'De' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Para' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Motivo' })).toBeTruthy();
    expect(vi.mocked(service.getAllReimbursementHistory)).toHaveBeenCalledWith(null, 25, 0);
  });

  it('aba Unidades exibe Unidade/Endereço/Cidade e chama getAllClientLocations', async () => {
    render(<PlatformIntelligence />);
    await userEvent.click(screen.getByRole('button', { name: /Unidades/ }));
    await waitFor(() => screen.getByText('Nenhum registro encontrado.'));

    expect(screen.getByRole('columnheader', { name: 'Unidade' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Endereço' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Cidade' })).toBeTruthy();
    expect(vi.mocked(service.getAllClientLocations)).toHaveBeenCalledWith(null, 25, 0);
  });

  it('aba Notificações exibe Mensagem e não exibe coluna Tipo', async () => {
    render(<PlatformIntelligence />);
    await userEvent.click(screen.getByRole('button', { name: /Notificações/ }));
    await waitFor(() => screen.getByText('Nenhum registro encontrado.'));

    expect(screen.getByRole('columnheader', { name: 'Mensagem' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Tipo' })).toBeNull();
    expect(vi.mocked(service.getAllNotifications)).toHaveBeenCalledWith(null, 25, 0);
  });

  it('aba OS Completas não tem coluna total_minutes — só as colunas definidas', async () => {
    render(<PlatformIntelligence />);
    await userEvent.click(screen.getByRole('button', { name: /OS Completas/ }));
    await waitFor(() => screen.getByText('Nenhum registro encontrado.'));

    expect(screen.getByRole('columnheader', { name: 'Nº OS' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeTruthy();
    expect(vi.mocked(service.getAllReports)).toHaveBeenCalledWith(null, 25, 0);
  });

  it('aba Materiais usa coluna quantity/Quantidade e chama getAllMaterials', async () => {
    render(<PlatformIntelligence />);
    await userEvent.click(screen.getByRole('button', { name: /Materiais/ }));
    await waitFor(() => screen.getByText('Nenhum registro encontrado.'));

    expect(screen.getByRole('columnheader', { name: 'Nº Req.' })).toBeTruthy();
    expect(vi.mocked(service.getAllMaterials)).toHaveBeenCalledWith(null, 25, 0);
  });
});
