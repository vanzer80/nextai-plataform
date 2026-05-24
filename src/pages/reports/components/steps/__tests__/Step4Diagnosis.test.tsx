/**
 * Testes unitários — Step4Diagnosis
 *
 * AiDiagnosticAssistant é mockado para um botão simples que chama onApply diretamente.
 * Cobre: AI apply → textarea atualiza; usuário pode editar; valor sincroniza com o form.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { vi, describe, it, expect } from 'vitest';

import Step4Diagnosis, { buildAppliedText } from '../Step4Diagnosis';
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

// Texto completo que deve aparecer no campo "Diagnóstico final" após Apply
const EXPECTED_FINAL = buildAppliedText(MOCK_AI_RESULT);

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

// ── Helper ────────────────────────────────────────────────────────────────────

function Wrapper({ defaultPrelim = '', defaultFinal = '' }: { defaultPrelim?: string; defaultFinal?: string } = {}) {
  const form = useForm<any>({
    defaultValues: {
      preliminary_diagnosis: defaultPrelim,
      final_diagnosis: defaultFinal,
      reported_problem: '',
    },
  });
  return <Step4Diagnosis form={form} />;
}

function WrapperWithRef({ onFormReady }: { onFormReady: (f: ReturnType<typeof useForm<any>>) => void }) {
  const form = useForm<any>({
    defaultValues: {
      preliminary_diagnosis: '',
      final_diagnosis: '',
      reported_problem: '',
    },
  });
  onFormReady(form);
  return <Step4Diagnosis form={form} />;
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('Step4Diagnosis — AI apply', () => {
  it('preenche o campo Diagnóstico final ao clicar em Aplicar', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(
      screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...')
    ).toHaveValue(EXPECTED_FINAL);
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
    ).toHaveValue(EXPECTED_FINAL);
  });

  it('permite aplicar IA múltiplas vezes consecutivas', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const textarea = screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...');

    await user.click(screen.getByTestId('mock-ai-apply'));
    expect(textarea).toHaveValue(EXPECTED_FINAL);

    await user.clear(textarea);
    await user.click(screen.getByTestId('mock-ai-apply'));
    expect(textarea).toHaveValue(EXPECTED_FINAL);
  });
});

describe('Step4Diagnosis — edição após apply', () => {
  it('o usuário pode editar o texto aplicado pela IA', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const textarea = screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...');

    // Aplica IA
    await user.click(screen.getByTestId('mock-ai-apply'));
    expect(textarea).toHaveValue(EXPECTED_FINAL);

    // Edita manualmente
    await user.clear(textarea);
    await user.type(textarea, 'Texto ajustado pelo técnico');
    expect(textarea).toHaveValue('Texto ajustado pelo técnico');
  });

  it('o texto digitado manualmente persiste sem ser sobrescrito', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const textarea = screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...');

    await user.type(textarea, 'Diagnóstico manual');
    expect(textarea).toHaveValue('Diagnóstico manual');

    // Garante que o valor não some após algum re-render
    expect(textarea).toHaveValue('Diagnóstico manual');
  });

  it('valor digitado manualmente é sincronizado com o form (getValues)', async () => {
    const user = userEvent.setup();
    let capturedForm: ReturnType<typeof useForm<any>> | null = null;

    render(<WrapperWithRef onFormReady={(f) => { capturedForm = f; }} />);

    const textarea = screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...');
    await user.type(textarea, 'Diagnóstico para submissão');

    expect(capturedForm!.getValues('final_diagnosis')).toBe('Diagnóstico para submissão');
  });

  it('valor da IA é sincronizado com o form (getValues)', async () => {
    const user = userEvent.setup();
    let capturedForm: ReturnType<typeof useForm<any>> | null = null;

    render(<WrapperWithRef onFormReady={(f) => { capturedForm = f; }} />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(capturedForm!.getValues('final_diagnosis')).toBe(EXPECTED_FINAL);
    expect(
      screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...')
    ).toHaveValue(EXPECTED_FINAL);
  });
});

describe('Step4Diagnosis — inicialização', () => {
  it('inicializa o campo com valor existente no form (ex: draft)', () => {
    render(<Wrapper defaultFinal="Diagnóstico salvo no draft" />);

    expect(
      screen.getByPlaceholderText('Diagnóstico técnico formal após análise completa...')
    ).toHaveValue('Diagnóstico salvo no draft');
  });

  it('renderiza todos os quatro campos', () => {
    render(<Wrapper />);
    expect(screen.getByPlaceholderText(/problema conforme relatado/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/observações iniciais do técnico/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/diagnóstico técnico formal/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/observações internas/i)).toBeInTheDocument();
  });
});
