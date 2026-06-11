import { renderHook, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useClientLocations } from '../useClientLocations';
import type { ClientLocation } from '@/src/types/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockGetLocationsByClient = vi.hoisted(() => vi.fn<(id: string) => Promise<ClientLocation[]>>());

vi.mock('@/src/services/clientService', () => ({
  getLocationsByClient: mockGetLocationsByClient,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOCATION_A: ClientLocation = {
  id: 'loc-1',
  client_id: 'client-1',
  nome: 'Filial Centro',
  logradouro: 'Rua das Flores',
  numero: '100',
  complemento: null,
  bairro: 'Centro',
  cep: '01310-100',
  cidade: 'São Paulo',
  estado: 'SP',
  contato_nome: 'João Silva',
  contato_telefone: '(11) 99999-0000',
  is_principal: true,
  created_at: '2026-01-01T00:00:00Z',
};

const LOCATION_B: ClientLocation = {
  id: 'loc-2',
  client_id: 'client-1',
  nome: 'Filial Norte',
  logradouro: null,
  numero: null,
  complemento: null,
  bairro: null,
  cep: null,
  cidade: 'Guarulhos',
  estado: 'SP',
  contato_nome: null,
  contato_telefone: null,
  is_principal: false,
  created_at: '2026-01-02T00:00:00Z',
};

// ── Testes ────────────────────────────────────────────────────────────────────

describe('useClientLocations', () => {
  beforeEach(() => {
    mockGetLocationsByClient.mockReset();
  });

  it('retorna lista de filiais quando clientId é fornecido', async () => {
    mockGetLocationsByClient.mockResolvedValue([LOCATION_A, LOCATION_B]);

    const { result } = renderHook(() => useClientLocations('client-1'));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.locations).toHaveLength(2);
    expect(result.current.locations[0].id).toBe('loc-1');
    expect(mockGetLocationsByClient).toHaveBeenCalledWith('client-1');
  });

  it('retorna array vazio quando o cliente não tem filiais', async () => {
    mockGetLocationsByClient.mockResolvedValue([]);

    const { result } = renderHook(() => useClientLocations('client-2'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.locations).toHaveLength(0);
  });

  it('não faz fetch e retorna vazio quando clientId é undefined', () => {
    const { result } = renderHook(() => useClientLocations(undefined));

    expect(result.current.loading).toBe(false);
    expect(result.current.locations).toHaveLength(0);
    expect(mockGetLocationsByClient).not.toHaveBeenCalled();
  });

  it('retorna array vazio e para o loading em caso de erro', async () => {
    mockGetLocationsByClient.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() => useClientLocations('client-3'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.locations).toHaveLength(0);
  });

  it('rebusca quando clientId muda', async () => {
    mockGetLocationsByClient
      .mockResolvedValueOnce([LOCATION_A])
      .mockResolvedValueOnce([LOCATION_B]);

    const { result, rerender } = renderHook(
      ({ cid }: { cid: string }) => useClientLocations(cid),
      { initialProps: { cid: 'client-1' } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.locations[0].id).toBe('loc-1');

    rerender({ cid: 'client-2' });
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.locations[0].id).toBe('loc-2');
    expect(mockGetLocationsByClient).toHaveBeenCalledTimes(2);
  });
});
