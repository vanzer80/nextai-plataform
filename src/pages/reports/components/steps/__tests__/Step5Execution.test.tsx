/**
 * Testes unitários — Step5Execution
 *
 * AiExecutionAssistant é mockado para um botão simples que chama onApply diretamente.
 * Cobre: AI apply → 3 campos atualizam (serviços sobrescreve; recomendação/pendências
 * só preenchem se vazios); usuário pode editar; valores sincronizam com o form; draft.
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm } from 'react-hook-form';
import { vi, describe, it, expect } from 'vitest';

import Step5Execution from '../Step5Execution';
import type { ExecutionEnhancementResult } from '@/src/services/aiService';

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

const MOCK_AI_RESULT: ExecutionEnhancementResult = {
  services_performed:
    "Foi realizada a substituição da bomba d'água, que apresentava folga no eixo e vazamento pelo selo mecânico.",
  technical_recommendation: 'Recomenda-se inspeção do sistema de arrefecimento em 30 dias.',
  pending_issues: 'Aguardando peça de reposição do selo mecânico.',
};

const MOCK_AI_RESULT_SEM_PENDENCIA: ExecutionEnhancementResult = {
  ...MOCK_AI_RESULT,
  pending_issues: '',
};

// O mock expõe dois botões: um aplica o resultado completo, outro o sem pendência
vi.mock('@/src/pages/reports/components/AiExecutionAssistant', () => ({
  default: ({ onApply }: { onApply: (r: ExecutionEnhancementResult) => void }) => (
    <div>
      <button type="button" data-testid="mock-ai-apply" onClick={() => onApply(MOCK_AI_RESULT)}>
        Aplicar sugestão
      </button>
      <button
        type="button"
        data-testid="mock-ai-apply-sem-pendencia"
        onClick={() => onApply(MOCK_AI_RESULT_SEM_PENDENCIA)}
      >
        Aplicar sem pendência
      </button>
    </div>
  ),
}));

// ── Placeholders (contratos de UI — não alterar sem atualizar o componente) ──

const PH_SERVICOS = 'Descreva os procedimentos realizados durante o atendimento...';
const PH_PENDENCIAS = 'Itens que não puderam ser resolvidos nesta visita...';
const PH_RECOMENDACAO = 'Próximos passos recomendados para o cliente...';

// ── Helpers ───────────────────────────────────────────────────────────────────

interface WrapperProps {
  defaultServices?: string;
  defaultPending?: string;
  defaultRecommendation?: string;
}

function Wrapper({ defaultServices = '', defaultPending = '', defaultRecommendation = '' }: WrapperProps = {}) {
  const form = useForm<any>({
    defaultValues: {
      services_performed: defaultServices,
      pending_issues: defaultPending,
      technical_recommendation: defaultRecommendation,
      parts_used: '',
      finished_at: '',
      service_type: 'manutencao_corretiva',
      reported_problem: '',
      final_diagnosis: '',
    },
  });
  return <Step5Execution form={form} />;
}

function WrapperWithRef({ onFormReady }: { onFormReady: (f: ReturnType<typeof useForm<any>>) => void }) {
  const form = useForm<any>({
    defaultValues: {
      services_performed: '',
      pending_issues: '',
      technical_recommendation: '',
      parts_used: '',
      finished_at: '',
      service_type: 'manutencao_corretiva',
      reported_problem: '',
      final_diagnosis: '',
    },
  });
  onFormReady(form);
  return <Step5Execution form={form} />;
}

// ── Testes ───────────────────────────────────────────────────────────────────

describe('Step5Execution — AI apply', () => {
  it('sobrescreve o campo Serviços executados ao clicar em Aplicar', async () => {
    const user = userEvent.setup();
    render(<Wrapper defaultServices="trocou a bomba" />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(screen.getByPlaceholderText(PH_SERVICOS)).toHaveValue(MOCK_AI_RESULT.services_performed);
  });

  it('preenche technical_recommendation quando está vazio', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(screen.getByPlaceholderText(PH_RECOMENDACAO)).toHaveValue(
      MOCK_AI_RESULT.technical_recommendation
    );
  });

  it('não sobrescreve technical_recommendation se já tem conteúdo', async () => {
    const user = userEvent.setup();
    render(<Wrapper defaultRecommendation="Recomendação digitada pelo técnico" />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(screen.getByPlaceholderText(PH_RECOMENDACAO)).toHaveValue(
      'Recomendação digitada pelo técnico'
    );
  });

  it('preenche pending_issues quando o resultado traz pendência e o campo está vazio', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(screen.getByPlaceholderText(PH_PENDENCIAS)).toHaveValue(MOCK_AI_RESULT.pending_issues);
  });

  it('não preenche pending_issues quando o resultado vem com string vazia', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    await user.click(screen.getByTestId('mock-ai-apply-sem-pendencia'));

    expect(screen.getByPlaceholderText(PH_PENDENCIAS)).toHaveValue('');
  });

  it('não sobrescreve pending_issues existente', async () => {
    const user = userEvent.setup();
    render(<Wrapper defaultPending="Pendência registrada manualmente" />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(screen.getByPlaceholderText(PH_PENDENCIAS)).toHaveValue(
      'Pendência registrada manualmente'
    );
  });
});

describe('Step5Execution — edição após apply', () => {
  it('o usuário pode editar o texto aplicado pela IA', async () => {
    const user = userEvent.setup();
    render(<Wrapper />);

    const textarea = screen.getByPlaceholderText(PH_SERVICOS);

    await user.click(screen.getByTestId('mock-ai-apply'));
    expect(textarea).toHaveValue(MOCK_AI_RESULT.services_performed);

    await user.clear(textarea);
    await user.type(textarea, 'Texto ajustado pelo técnico');
    expect(textarea).toHaveValue('Texto ajustado pelo técnico');
  });

  it('valores digitados manualmente são sincronizados com o form (getValues)', async () => {
    const user = userEvent.setup();
    let capturedForm: ReturnType<typeof useForm<any>> | null = null;

    render(<WrapperWithRef onFormReady={(f) => { capturedForm = f; }} />);

    await user.type(screen.getByPlaceholderText(PH_SERVICOS), 'Serviço manual');
    await user.type(screen.getByPlaceholderText(PH_PENDENCIAS), 'Pendência manual');
    await user.type(screen.getByPlaceholderText(PH_RECOMENDACAO), 'Recomendação manual');

    expect(capturedForm!.getValues('services_performed')).toBe('Serviço manual');
    expect(capturedForm!.getValues('pending_issues')).toBe('Pendência manual');
    expect(capturedForm!.getValues('technical_recommendation')).toBe('Recomendação manual');
  });

  it('valores da IA são sincronizados com o form (getValues)', async () => {
    const user = userEvent.setup();
    let capturedForm: ReturnType<typeof useForm<any>> | null = null;

    render(<WrapperWithRef onFormReady={(f) => { capturedForm = f; }} />);

    await user.click(screen.getByTestId('mock-ai-apply'));

    expect(capturedForm!.getValues('services_performed')).toBe(MOCK_AI_RESULT.services_performed);
    expect(capturedForm!.getValues('technical_recommendation')).toBe(
      MOCK_AI_RESULT.technical_recommendation
    );
    expect(capturedForm!.getValues('pending_issues')).toBe(MOCK_AI_RESULT.pending_issues);
  });
});

describe('Step5Execution — inicialização', () => {
  it('inicializa os campos com valores existentes no form (ex: draft)', () => {
    render(
      <Wrapper
        defaultServices="Serviço salvo no draft"
        defaultPending="Pendência do draft"
        defaultRecommendation="Recomendação do draft"
      />
    );

    expect(screen.getByPlaceholderText(PH_SERVICOS)).toHaveValue('Serviço salvo no draft');
    expect(screen.getByPlaceholderText(PH_PENDENCIAS)).toHaveValue('Pendência do draft');
    expect(screen.getByPlaceholderText(PH_RECOMENDACAO)).toHaveValue('Recomendação do draft');
  });

  it('renderiza todos os cinco campos', () => {
    render(<Wrapper />);
    expect(screen.getByPlaceholderText(PH_SERVICOS)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/peças substituídas ou materiais/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(PH_PENDENCIAS)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(PH_RECOMENDACAO)).toBeInTheDocument();
    // finished_at é input type="time" sem placeholder — verificado pelo label
    expect(screen.getByText('Hora de término')).toBeInTheDocument();
  });
});
