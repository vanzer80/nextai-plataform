/**
 * Testes de integração — Step4Diagnosis + AiDiagnosticAssistant
 *
 * Componente REAL sem mocks de UI. Apenas enhanceDiagnostic é mockado
 * para retornar um resultado determinístico sem chamar o Supabase.
 *
 * Este teste reproduz EXATAMENTE o fluxo que falha em produção:
 *   1. Usuário preenche diagnóstico preliminar
 *   2. Clica "Melhorar diagnóstico com IA"
 *   3. Painel aparece com sugestão
 *   4. Clica "Aplicar sugestão"  ← ponto crítico: setValue + setResult(null) simultâneos
 *   5. Painel some E textarea mostra o texto da IA
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { vi, describe, it, expect } from 'vitest';

import Step4Diagnosis from '../Step4Diagnosis';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

// vi.hoisted garante que o valor é criado ANTES do hoist de vi.mock,
// resolvendo o "Cannot access before initialization" do ESM hoisting
const MOCK_RESULT = vi.hoisted(() => ({
  final_diagnosis: 'Falha no compressor de ar-condicionado por desgaste mecânico',
  technical_description: 'Verificação completa do sistema de refrigeração',
  possible_causes: ['Desgaste do compressor', 'Falta de manutenção preventiva'],
  recommendation: 'Substituir compressor e reabastecer gás',
}));

vi.mock('@/src/services/aiService', () => ({
  enhanceDiagnostic: vi.fn().mockResolvedValue(MOCK_RESULT),
}));

// ── Wrapper ───────────────────────────────────────────────────────────────────

function IntegrationWrapper() {
  const form = useForm<any>({
    defaultValues: {
      service_type: 'manutencao_corretiva',
      preliminary_diagnosis: '',
      final_diagnosis: '',
      reported_problem: '',
    },
  });
  return <Step4Diagnosis form={form} />;
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('Step4Diagnosis + AiDiagnosticAssistant — integração', () => {
  it('fluxo completo: digitar → melhorar → aplicar → textarea com texto da IA', async () => {
    const user = userEvent.setup();
    render(<IntegrationWrapper />);

    // 1. Preencher diagnóstico preliminar (rawInput do assistente)
    const prelimTextarea = screen.getByPlaceholderText(
      'Observações iniciais do técnico ao chegar no local...'
    );
    await user.type(prelimTextarea, 'Motor apresenta ruído ao ligar');

    // 2. Botão de melhoria deve estar habilitado agora
    const enhanceBtn = screen.getByRole('button', { name: /melhorar diagnóstico com ia/i });
    expect(enhanceBtn).not.toBeDisabled();
    await user.click(enhanceBtn);

    // 3. Painel de sugestão deve aparecer
    await waitFor(() => {
      expect(screen.getByText(/sugestão da ia/i)).toBeInTheDocument();
    });
    // E mostrar o diagnóstico final sugerido
    expect(screen.getByText(MOCK_RESULT.final_diagnosis)).toBeInTheDocument();

    // 4. Aplicar sugestão — ponto crítico do bug
    await user.click(screen.getByRole('button', { name: /aplicar sugestão/i }));

    // 5. Painel DEVE ter sumido
    await waitFor(() => {
      expect(screen.queryByText(/sugestão da ia/i)).not.toBeInTheDocument();
    });

    // 6. CRÍTICO: textarea de diagnóstico final DEVE conter o texto completo da IA
    const finalDiagnosisTextarea = screen.getByPlaceholderText(
      'Diagnóstico técnico formal após análise completa...'
    );
    const expectedFinal = [
      MOCK_RESULT.final_diagnosis,
      'Causas possíveis:\n' + MOCK_RESULT.possible_causes.map((c) => `• ${c}`).join('\n'),
      `Recomendação técnica: ${MOCK_RESULT.recommendation}`,
    ].join('\n\n');
    expect(finalDiagnosisTextarea).toHaveValue(expectedFinal);
  });

  it('botão de melhoria fica desabilitado quando preliminary_diagnosis está vazio', () => {
    render(<IntegrationWrapper />);

    const enhanceBtn = screen.getByRole('button', { name: /melhorar diagnóstico com ia/i });
    expect(enhanceBtn).toBeDisabled();
  });

  it('clicar em Descartar fecha o painel sem alterar o textarea', async () => {
    const user = userEvent.setup();
    render(<IntegrationWrapper />);

    const prelimTextarea = screen.getByPlaceholderText(
      'Observações iniciais do técnico ao chegar no local...'
    );
    await user.type(prelimTextarea, 'Vibração excessiva no motor');

    await user.click(screen.getByRole('button', { name: /melhorar diagnóstico com ia/i }));

    await waitFor(() => {
      expect(screen.getByText(/sugestão da ia/i)).toBeInTheDocument();
    });

    // Descartar em vez de aplicar
    await user.click(screen.getByRole('button', { name: /descartar/i }));

    await waitFor(() => {
      expect(screen.queryByText(/sugestão da ia/i)).not.toBeInTheDocument();
    });

    // Textarea deve permanecer vazio (não houve Apply)
    expect(
      screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...')
    ).toHaveValue('');
  });
});
