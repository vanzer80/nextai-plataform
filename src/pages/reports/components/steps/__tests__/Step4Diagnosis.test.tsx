/**
 * Testes unitários — Step4Diagnosis
 *
 * AiDiagnosticAssistant é mockado para um botão simples que chama onApply diretamente.
 * Foco: handleAiApply → setValue → Controller atualiza o textarea.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { vi, describe, it, expect } from 'vitest';

import Step4Diagnosis from '../Step4Diagnosis';
import type { DiagnosticEnhancementResult } from '@/src/services/aiService';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const MOCK_AI_RESULT: DiagnosticEnhancementResult = {
  final_diagnosis: 'Falha no compressor de ar-condicionado por desgaste mecânico',
  technical_description: 'Verificação completa do sistema de refrigeração',
  possible_causes: ['Desgaste do compressor'],
  recommendation: 'Substituir compressor',
};

vi.mock('@/src/pages/reports/components/AiDiagnosticAssistant', () => ({
  default: ({ onApply }: { onApply: (r: DiagnosticEnhancementResult) => void }) => (
    <button
      type="button"
      data-testid="mock-ai-apply"
      onClick={() => onApply(MOCK_AI_RESULT)}
    >
      Aplicar sugestão
    </button>
  ),
}));

// ── Wrapper ───────────────────────────────────────────────────────────────────

function Wrapper({ defaultPrelim = '' }: { defaultPrelim?: string } = {}) {
  const form = useForm<any>({
    defaultValues: {
      preliminary_diagnosis: defaultPrelim,
      final_diagnosis: '',
      reported_problem: '',
    },
  });
  return <Step4Diagnosis form={form} />;
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('Step4Diagnosis — unitário', () => {
  it('aplica o texto da IA no campo Diagnóstico final', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(
      screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...')
    ).toHaveValue(MOCK_AI_RESULT.final_diagnosis);
  });

  it('preenche preliminary_diagnosis quando está vazio', async () => {
    const user = userEvent.setup();
    render(<Wrapper defaultPrelim="" />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(
      screen.getByPlaceholderText('Observações iniciais do técnico ao chegar no local...')
    ).toHaveValue(MOCK_AI_RESULT.technical_description);
  });

  it('não sobrescreve preliminary_diagnosis se já tem conteúdo', async () => {
    const user = userEvent.setup();
    render(<Wrapper defaultPrelim="Diagnóstico do técnico no campo" />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(
      screen.getByPlaceholderText('Observações iniciais do técnico ao chegar no local...')
    ).toHaveValue('Diagnóstico do técnico no campo');
  });

  it('atualiza final_diagnosis mesmo quando preliminary_diagnosis já tem conteúdo', async () => {
    const user = userEvent.setup();
    render(<Wrapper defaultPrelim="Texto existente" />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(
      screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...')
    ).toHaveValue(MOCK_AI_RESULT.final_diagnosis);
  });

  it('permite aplicar resultado da IA múltiplas vezes', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const finalDiagnosisTextarea = screen.getByPlaceholderText(
      'Diagnóstico técnico formal após análise completa...'
    );

    await user.click(screen.getByTestId('mock-ai-apply'));
    expect(finalDiagnosisTextarea).toHaveValue(MOCK_AI_RESULT.final_diagnosis);

    await user.clear(finalDiagnosisTextarea);
    await user.click(screen.getByTestId('mock-ai-apply'));
    expect(finalDiagnosisTextarea).toHaveValue(MOCK_AI_RESULT.final_diagnosis);
  });

  it('renderiza todos os quatro campos do formulário', () => {
    render(<Wrapper />);
    expect(screen.getByPlaceholderText(/problema conforme relatado/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/observações iniciais do técnico/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/diagnóstico técnico formal/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/observações internas/i)).toBeInTheDocument();
  });
});

// ── Teste de mecanismo RHF puro: setValue + Controller ───────────────────────

describe('RHF: setValue simultâneo a setState não perde o valor', () => {
  it('setValue e setState em batch mantêm o valor do Controller', async () => {
    const user = userEvent.setup();
    const { useState } = await import('react');
    const { Controller } = await import('react-hook-form');

    function BatchTest() {
      const { control, setValue } = useForm<{ d: string }>({ defaultValues: { d: '' } });
      const [panelVisible, setPanelVisible] = useState(true);

      const handleApply = () => {
        // Replica exatamente o que AiDiagnosticAssistant faz:
        // chama onApply (→ setValue) e depois setResult(null) na mesma closure
        setValue('d', 'Texto da IA', { shouldDirty: true });
        setPanelVisible(false);
      };

      return (
        <div>
          <Controller
            name="d"
            control={control}
            render={({ field }) => (
              <textarea {...field} value={field.value ?? ''} data-testid="ctrl-input" />
            )}
          />
          {panelVisible && <div data-testid="panel">Painel</div>}
          <button type="button" onClick={handleApply}>
            Aplicar
          </button>
        </div>
      );
    }

    render(<BatchTest />);

    expect(screen.getByTestId('panel')).toBeInTheDocument();
    expect(screen.getByTestId('ctrl-input')).toHaveValue('');

    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    // Painel sumiu E textarea tem o valor — ambos no mesmo batch de React 18
    expect(screen.queryByTestId('panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('ctrl-input')).toHaveValue('Texto da IA');
  });
});
