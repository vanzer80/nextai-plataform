import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('@/src/lib/supabase', () => ({
  supabase: { rpc: vi.fn() },
}));

import { supabase } from '@/src/lib/supabase';
import {
  toJsonBlob,
  toCsvBlob,
  downloadBlob,
  getAllReports,
  getAllReimbursements,
  getAllClients,
  getAllOrcamentos,
  getAllEquipments,
  getAllMaterials,
  getAllChecklistItems,
  getAllAttachments,
  getAllStatusHistory,
  getAllSignatures,
  getAllReimbursementHistory,
  getAllClientLocations,
  getAllNotifications,
  fetchAllReportsForExport,
  fetchAllMaterialsForExport,
  fetchAllNotificationsForExport,
  fetchAllReimbursementHistoryForExport,
  fetchAllClientLocationsForExport,
  logExport,
} from '@/src/services/platformIntelligenceService';

const mockRpc = supabase.rpc as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockRpc.mockReset();
  mockRpc.mockResolvedValue({ data: [], error: null });
});

// ── toJsonBlob ────────────────────────────────────────────────────────────────

describe('toJsonBlob', () => {
  it('produz Blob com tipo application/json', () => {
    expect(toJsonBlob([]).type).toBe('application/json');
  });

  it('serializa linhas para JSON válido', async () => {
    const rows = [{ id: '1', status: 'done' }];
    expect(JSON.parse(await toJsonBlob(rows).text())).toEqual(rows);
  });

  it('array vazio vira []', async () => {
    expect(JSON.parse(await toJsonBlob([]).text())).toEqual([]);
  });
});

// ── toCsvBlob ─────────────────────────────────────────────────────────────────

describe('toCsvBlob', () => {
  it('produz Blob com tipo text/csv', () => {
    expect(toCsvBlob([{ a: '1' }]).type).toBe('text/csv');
  });

  it('gera cabeçalho e linha de dados', async () => {
    const [header, row] = (await toCsvBlob([{ id: '1', name: 'Alice' }]).text()).split('\n');
    expect(header).toBe('id,name');
    expect(row).toBe('1,Alice');
  });

  it('escapa campo com vírgula', async () => {
    const lines = (await toCsvBlob([{ v: 'a,b' }]).text()).split('\n');
    expect(lines[1]).toBe('"a,b"');
  });

  it('escapa aspas duplas nos valores', async () => {
    const lines = (await toCsvBlob([{ v: 'say "hi"' }]).text()).split('\n');
    expect(lines[1]).toBe('"say ""hi"""');
  });

  it('null vira string vazia', async () => {
    const lines = (await toCsvBlob([{ id: '1', note: null as unknown as string }]).text()).split('\n');
    expect(lines[1]).toBe('1,');
  });

  it('array vazio retorna string vazia', async () => {
    expect(await toCsvBlob([]).text()).toBe('');
  });
});

// ── downloadBlob ──────────────────────────────────────────────────────────────

describe('downloadBlob', () => {
  it('cria anchor, chama click e revoga URL', () => {
    const fakeUrl = 'blob:fake';
    const click = vi.fn();
    global.URL.createObjectURL = vi.fn().mockReturnValue(fakeUrl);
    global.URL.revokeObjectURL = vi.fn();
    vi.spyOn(document, 'createElement').mockReturnValueOnce(
      { href: '', download: '', click } as unknown as HTMLAnchorElement,
    );

    downloadBlob(new Blob(['x']), 'export.json');

    expect(click).toHaveBeenCalledOnce();
    expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(fakeUrl);
  });
});

// ── RPC wrappers: nome correto e parâmetros ───────────────────────────────────

type RpcFn = (tid: string | null, lim: number, off: number) => Promise<unknown[]>;

const RPC_TABLE: { label: string; fn: RpcFn; rpc: string }[] = [
  { label: 'getAllReports',              fn: getAllReports,              rpc: 'platform_get_all_reports' },
  { label: 'getAllReimbursements',       fn: getAllReimbursements,       rpc: 'platform_get_all_reimbursements' },
  { label: 'getAllClients',              fn: getAllClients,              rpc: 'platform_get_all_clients' },
  { label: 'getAllOrcamentos',           fn: getAllOrcamentos,           rpc: 'platform_get_all_orcamentos' },
  { label: 'getAllEquipments',           fn: getAllEquipments,           rpc: 'platform_get_all_equipments' },
  { label: 'getAllMaterials',            fn: getAllMaterials,            rpc: 'platform_get_all_materials' },
  { label: 'getAllChecklistItems',       fn: getAllChecklistItems,       rpc: 'platform_get_all_checklist_items' },
  { label: 'getAllAttachments',          fn: getAllAttachments,          rpc: 'platform_get_all_attachments' },
  { label: 'getAllStatusHistory',        fn: getAllStatusHistory,        rpc: 'platform_get_all_status_history' },
  { label: 'getAllSignatures',           fn: getAllSignatures,           rpc: 'platform_get_all_signatures' },
  { label: 'getAllReimbursementHistory', fn: getAllReimbursementHistory, rpc: 'platform_get_all_reimbursement_history' },
  { label: 'getAllClientLocations',      fn: getAllClientLocations,      rpc: 'platform_get_all_client_locations' },
  { label: 'getAllNotifications',        fn: getAllNotifications,        rpc: 'platform_get_all_notifications' },
];

describe('RPC wrappers — nome correto', () => {
  for (const { label, fn, rpc } of RPC_TABLE) {
    it(`${label} chama "${rpc}" com p_tenant_id / p_limit / p_offset`, async () => {
      await fn(null, 25, 0);
      expect(mockRpc).toHaveBeenCalledWith(rpc, { p_tenant_id: null, p_limit: 25, p_offset: 0 });
    });
  }
});

describe('RPC wrappers — tenant_id repassado', () => {
  for (const { label, fn, rpc } of RPC_TABLE) {
    it(`${label} passa tenant_id quando fornecido`, async () => {
      await fn('uuid-abc', 10, 50);
      expect(mockRpc).toHaveBeenCalledWith(rpc, { p_tenant_id: 'uuid-abc', p_limit: 10, p_offset: 50 });
    });
  }
});

describe('RPC wrappers — tratamento de erro', () => {
  it('lança Error quando RPC retorna error.message', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'Acesso negado' } });
    await expect(getAllReports(null, 25, 0)).rejects.toThrow('Acesso negado');
  });

  it('retorna [] quando data é null sem error', async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await getAllMaterials(null, 25, 0)).toEqual([]);
  });

  it('retorna dados quando RPC tem sucesso', async () => {
    const row = { id: 'r1', status: 'done' };
    mockRpc.mockResolvedValueOnce({ data: [row], error: null });
    expect(await getAllReports(null, 25, 0)).toEqual([row]);
  });
});

// ── Paginação ────────────────────────────────────────────────────────────────

describe('fetchAll paginação', () => {
  it('fetchAllReportsForExport encadeia páginas até < 1000 itens', async () => {
    const full = Array(1000).fill({ id: 'a' });
    const last = Array(3).fill({ id: 'b' });
    mockRpc
      .mockResolvedValueOnce({ data: full, error: null })
      .mockResolvedValueOnce({ data: last, error: null });

    const result = await fetchAllReportsForExport(null);
    expect(mockRpc).toHaveBeenCalledTimes(2);
    expect(result).toHaveLength(1003);
  });

  it('fetchAllReportsForExport para na primeira página quando < 1000', async () => {
    mockRpc.mockResolvedValueOnce({ data: Array(5).fill({ id: 'x' }), error: null });
    const result = await fetchAllReportsForExport(null);
    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(result).toHaveLength(5);
  });

  it('fetchAllMaterialsForExport chama platform_get_all_materials', async () => {
    await fetchAllMaterialsForExport(null);
    expect(mockRpc).toHaveBeenCalledWith('platform_get_all_materials',
      expect.objectContaining({ p_tenant_id: null }));
  });

  it('fetchAllNotificationsForExport chama platform_get_all_notifications', async () => {
    await fetchAllNotificationsForExport(null);
    expect(mockRpc).toHaveBeenCalledWith('platform_get_all_notifications',
      expect.objectContaining({ p_tenant_id: null }));
  });

  it('fetchAllReimbursementHistoryForExport chama platform_get_all_reimbursement_history', async () => {
    await fetchAllReimbursementHistoryForExport(null);
    expect(mockRpc).toHaveBeenCalledWith('platform_get_all_reimbursement_history',
      expect.objectContaining({ p_tenant_id: null }));
  });

  it('fetchAllClientLocationsForExport chama platform_get_all_client_locations', async () => {
    await fetchAllClientLocationsForExport(null);
    expect(mockRpc).toHaveBeenCalledWith('platform_get_all_client_locations',
      expect.objectContaining({ p_tenant_id: null }));
  });
});

// ── logExport ────────────────────────────────────────────────────────────────

describe('logExport', () => {
  it('chama platform_log_export com resource, tenant_filter e row_count', async () => {
    await logExport('reports', 'tenant-uuid', 42);
    expect(mockRpc).toHaveBeenCalledWith('platform_log_export', {
      p_resource: 'reports',
      p_tenant_filter: 'tenant-uuid',
      p_row_count: 42,
    });
  });

  it('passa null quando tenantFilter é null', async () => {
    await logExport('notifications', null, 0);
    expect(mockRpc).toHaveBeenCalledWith('platform_log_export', {
      p_resource: 'notifications',
      p_tenant_filter: null,
      p_row_count: 0,
    });
  });

  it('aceita todos os ExportResource válidos sem erro de tipo', async () => {
    const resources = [
      'diagnostics', 'kb', 'reports', 'reimbursements', 'clients',
      'orcamentos', 'equipments', 'materials', 'checklist_items',
      'attachments', 'status_history', 'signatures',
      'reimbursement_history', 'client_locations', 'notifications',
    ] as const;
    for (const res of resources) {
      await logExport(res, null, 0);
    }
    expect(mockRpc).toHaveBeenCalledTimes(resources.length);
  });
});
