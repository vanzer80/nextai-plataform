/**
 * Testes de integração — Step5Execution + AiExecutionAssistant
 *
 * Componente REAL sem mocks de UI. Apenas enhanceExecution é mockado
 * para retornar um resultado determinístico sem chamar o Supabase.
 *
 * Fluxo coberto:
 *   1. Usuário digita relato informal em "Serviços executados"
 *   2. Clica "Melhorar com IA"
 *   3. Painel aparece com sugestão (serviços + recomendação + pendências)
 *   4. Clica "Aplicar sugestão"
 *   5. Painel some E os 3 textareas contêm os textos da IA
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { vi, describe, it, expect, beforeEach } from 'vitest';

import Step5Execution from '../Step5Execution';
import { enhanceExecution } from '@/src/services/aiService';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// vi.hoisted garante que o valor é criado ANTES do hoist de vi.mock,
// resolvendo o "Cannot access before initialization" do ESM hoisting
const MOCK_RESULT = vi.hoisted(() => ({
  services_performed:
    "Foi realizada a substituição da bomba d'água, que apresentava folga no eixo e vazamento pelo selo mecânico.",
  technical_recommendation: 'Recomenda-se inspeção do sistema de arrefecimento em 30 dias.',
  pending_issues: 'Aguardando peça de reposição do selo mecânico.',
}));

vi.mock('@/src/services/aiService', () => ({
  enhanceExecution: vi.fn().mockResolvedValue(MOCK_RESULT),
}));

// ── Placeholders ─────────────────────────────────────────────────────────────

const PH_SERVICOS = 'Descreva os procedimentos realizados durante o atendimento...';
const PH_PENDENCIAS = 'Itens que não puderam ser resolvidos nesta visita...';
const PH_RECOMENDACAO = 'Próximos passos recomendados para o cliente...';

// ── Wrapper ───────────────────────────────────────────────────────────────────

function IntegrationWrapper() {
  const form = useForm<any>({
    defaultValues: {
      service_type: 'manutencao_corretiva',
      services_performed: '',
      pending_issues: '',
      technical_recommendation: '',
      parts_used: '',
      finished_at: '',
      reported_problem: 'Vazamento no sistema de arrefecimento',
      final_diagnosis: '',
    },
  });
  return <Step5Execution form={form} />;
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('Step5Execution + AiExecutionAssistant — integração', () => {
  beforeEach(() => {
    vi.mocked(enhanceExecution).mockClear();
    vi.mocked(enhanceExecution).mockResolvedValue(MOCK_RESULT);
  });

  it('fluxo completo: digitar → melhorar → aplicar → 3 textareas com textos da IA', async () => {
    const user = userEvent.setup();
    render(<IntegrationWrapper />);

    // 1. Digitar relato informal (rawInput do assistente é o próprio campo)
    const servicosTextarea = screen.getByPlaceholderText(PH_SERVICOS);
    await user.type(servicosTextarea, "trocou a bomba d'agua que estava com folga");

    // 2. Botão habilitado agora
    const enhanceBtn = screen.getByRole('button', { name: /melhorar com ia/i });
    expect(enhanceBtn).not.toBeDisabled();
    await user.click(enhanceBtn);

    // 3. Painel de sugestão com as 3 seções
    await waitFor(() => {
      expect(screen.getByText(/sugestão da ia/i)).toBeInTheDocument();
    });
    expect(screen.getByText(MOCK_RESULT.services_performed)).toBeInTheDocument();
    expect(screen.getByText(MOCK_RESULT.technical_recommendation)).toBeInTheDocument();
    expect(screen.getByText(MOCK_RESULT.pending_issues)).toBeInTheDocument();

    // 4. Aplicar
    await user.click(screen.getByRole('button', { name: /aplicar sugestão/i }));

    // 5. Painel some
    await waitFor(() => {
      expect(screen.queryByText(/sugestão da ia/i)).not.toBeInTheDocument();
    });

    // 6. Os 3 textareas contêm os textos da IA
    expect(screen.getByPlaceholderText(PH_SERVICOS)).toHaveValue(MOCK_RESULT.services_performed);
    expect(screen.getByPlaceholderText(PH_RECOMENDACAO)).toHaveValue(
      MOCK_RESULT.technical_recommendation
    );
    expect(screen.getByPlaceholderText(PH_PENDENCIAS)).toHaveValue(MOCK_RESULT.pending_issues);
  });

  it('botão fica desabilitado quando services_performed está vazio', () => {
    render(<IntegrationWrapper />);

    const enhanceBtn = screen.getByRole('button', { name: /melhorar com ia/i });
    expect(enhanceBtn).toBeDisabled();
  });

  it('clicar em Descartar fecha o painel sem alterar nenhum textarea', async () => {
    const user = userEvent.setup();
    render(<IntegrationWrapper />);

    const servicosTextarea = screen.getByPlaceholderText(PH_SERVICOS);
    await user.type(servicosTextarea, 'apertou os parafusos do mancal');

    await user.click(screen.getByRole('button', { name: /melhorar com ia/i }));

    await waitFor(() => {
      expect(screen.getByText(/sugestão da ia/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /descartar/i }));

    await waitFor(() => {
      expect(screen.queryByText(/sugestão da ia/i)).not.toBeInTheDocument();
    });

    // O relato informal digitado permanece intacto; demais campos vazios
    expect(servicosTextarea).toHaveValue('apertou os parafusos do mancal');
    expect(screen.getByPlaceholderText(PH_RECOMENDACAO)).toHaveValue('');
    expect(screen.getByPlaceholderText(PH_PENDENCIAS)).toHaveValue('');
  });

  it('enhanceExecution é chamado com rawInput e contexto corretos', async () => {
    const user = userEvent.setup();
    render(<IntegrationWrapper />);

    await user.type(screen.getByPlaceholderText(PH_SERVICOS), 'limpou o filtro');
    await user.click(screen.getByRole('button', { name: /melhorar com ia/i }));

    await waitFor(() => {
      expect(enhanceExecution).toHaveBeenCalledWith(
        'limpou o filtro',
        expect.objectContaining({
          serviceType: 'manutencao_corretiva',
          reportedProblem: 'Vazamento no sistema de arrefecimento',
        })
      );
    });
  });

  it('falha da IA preserva o texto informal digitado e não mostra painel', async () => {
    vi.mocked(enhanceExecution).mockRejectedValueOnce(new Error('IA fora do ar'));
    const user = userEvent.setup();
    render(<IntegrationWrapper />);

    const servicosTextarea = screen.getByPlaceholderText(PH_SERVICOS);
    await user.type(servicosTextarea, 'soldou a tubulação');

    await user.click(screen.getByRole('button', { name: /melhorar com ia/i }));

    // Botão volta do loading sem painel
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /melhorar com ia/i })).not.toBeDisabled();
    });
    expect(screen.queryByText(/sugestão da ia/i)).not.toBeInTheDocument();
    expect(servicosTextarea).toHaveValue('soldou a tubulação');
  });
});
