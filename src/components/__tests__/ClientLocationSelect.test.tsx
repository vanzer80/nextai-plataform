import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import ClientLocationSelect, { formatLocationLabel } from '../ClientLocationSelect';
import type { ClientLocation } from '@/src/types/client';

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockUseClientLocations = vi.hoisted(() =>
  vi.fn<(clientId: string | undefined) => { locations: ClientLocation[]; loading: boolean }>(),
);

vi.mock('@/src/hooks/useClientLocations', () => ({
  useClientLocations: mockUseClientLocations,
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const LOC_PRINCIPAL: ClientLocation = {
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

const LOC_SECUNDARIA: ClientLocation = {
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

function makeProps(overrides: Partial<Parameters<typeof ClientLocationSelect>[0]> = {}) {
  return {
    clientId: 'client-1',
    selectedLocationId: undefined,
    manualText: '',
    onLocationSelect: vi.fn(),
    onManualTextChange: vi.fn(),
    ...overrides,
  };
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('ClientLocationSelect', () => {
  beforeEach(() => {
    mockUseClientLocations.mockReset();
  });

  describe('formatLocationLabel', () => {
    it('formata nome + logradouro + cidade/estado', () => {
      expect(formatLocationLabel(LOC_PRINCIPAL)).toBe(
        'Filial Centro — Rua das Flores, 100 — São Paulo/SP',
      );
    });

    it('usa só o nome quando não há endereço', () => {
      const loc = { ...LOC_PRINCIPAL, logradouro: null, numero: null, cidade: null, estado: null };
      expect(formatLocationLabel(loc)).toBe('Filial Centro');
    });
  });

  describe('sem cliente selecionado', () => {
    it('exibe input desabilitado', () => {
      mockUseClientLocations.mockReturnValue({ locations: [], loading: false });

      render(<ClientLocationSelect {...makeProps({ clientId: undefined })} />);

      const input = screen.getByPlaceholderText(/selecione um cliente/i);
      expect(input).toBeDisabled();
    });
  });

  describe('cliente sem filiais (fallback manual direto)', () => {
    beforeEach(() => {
      mockUseClientLocations.mockReturnValue({ locations: [], loading: false });
    });

    it('exibe input de texto livre diretamente', () => {
      render(<ClientLocationSelect {...makeProps()} />);

      expect(screen.getByPlaceholderText(/planta 2/i)).toBeInTheDocument();
      expect(screen.getByText(/nenhuma filial cadastrada/i)).toBeInTheDocument();
    });

    it('chama onManualTextChange ao digitar', async () => {
      const onManualTextChange = vi.fn();
      const user = userEvent.setup();

      render(<ClientLocationSelect {...makeProps({ onManualTextChange })} />);

      await user.type(screen.getByPlaceholderText(/planta 2/i), 'Setor Norte');

      expect(onManualTextChange).toHaveBeenCalled();
    });
  });

  describe('cliente com filiais — Select', () => {
    beforeEach(() => {
      mockUseClientLocations.mockReturnValue({
        locations: [LOC_PRINCIPAL, LOC_SECUNDARIA],
        loading: false,
      });
    });

    it('renderiza o Select com as filiais e a opção "Digitar manualmente"', async () => {
      render(<ClientLocationSelect {...makeProps()} />);

      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();

      await userEvent.click(trigger);

      expect(screen.getByText('Filial Centro')).toBeInTheDocument();
      expect(screen.getByText('Filial Norte')).toBeInTheDocument();
      expect(screen.getByText(/digitar manualmente/i)).toBeInTheDocument();
    });

    it('chama onLocationSelect e onManualTextChange ao selecionar uma filial', async () => {
      const onLocationSelect = vi.fn();
      const onManualTextChange = vi.fn();
      const user = userEvent.setup();

      render(
        <ClientLocationSelect
          {...makeProps({ onLocationSelect, onManualTextChange })}
        />,
      );

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText('Filial Centro'));

      expect(onLocationSelect).toHaveBeenCalledWith(LOC_PRINCIPAL);
      expect(onManualTextChange).toHaveBeenCalledWith(
        expect.stringContaining('Filial Centro'),
      );
    });

    it('exibe preview read-only ao selecionar filial via FK', () => {
      mockUseClientLocations.mockReturnValue({
        locations: [LOC_PRINCIPAL, LOC_SECUNDARIA],
        loading: false,
      });

      render(
        <ClientLocationSelect
          {...makeProps({ selectedLocationId: 'loc-1' })}
        />,
      );

      expect(screen.getByText('Filial Centro')).toBeInTheDocument();
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /digitar manualmente/i })).toBeInTheDocument();
    });

    it('entra em modo manual ao clicar em "Digitar manualmente" no preview', async () => {
      const onLocationSelect = vi.fn();
      const user = userEvent.setup();

      render(
        <ClientLocationSelect
          {...makeProps({ selectedLocationId: 'loc-1', onLocationSelect })}
        />,
      );

      await user.click(screen.getByRole('button', { name: /digitar manualmente/i }));

      expect(onLocationSelect).toHaveBeenCalledWith(null);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/planta 2/i)).toBeInTheDocument();
      });
    });

    it('inicializa em modo manual quando há texto mas nenhum FK (registro legado)', () => {
      render(
        <ClientLocationSelect
          {...makeProps({
            selectedLocationId: undefined,
            manualText: 'Unidade antiga sem FK',
          })}
        />,
      );

      const input = screen.getByDisplayValue('Unidade antiga sem FK');
      expect(input).toBeInTheDocument();
    });

    it('chama onLocationSelect(null) e onManualTextChange("") ao entrar em modo manual via Select', async () => {
      const onLocationSelect = vi.fn();
      const onManualTextChange = vi.fn();
      const user = userEvent.setup();

      render(
        <ClientLocationSelect
          {...makeProps({ onLocationSelect, onManualTextChange })}
        />,
      );

      await user.click(screen.getByRole('combobox'));
      await user.click(screen.getByText(/digitar manualmente/i));

      expect(onLocationSelect).toHaveBeenCalledWith(null);
      expect(onManualTextChange).toHaveBeenCalledWith('');
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/planta 2/i)).toBeInTheDocument();
      });
    });
  });

  describe('estado de loading', () => {
    it('exibe skeleton durante o carregamento', () => {
      mockUseClientLocations.mockReturnValue({ locations: [], loading: true });

      const { container } = render(<ClientLocationSelect {...makeProps()} />);

      expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    });
  });
});
