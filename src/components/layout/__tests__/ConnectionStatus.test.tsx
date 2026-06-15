import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ConnectionStatus from '@/src/components/layout/ConnectionStatus';

describe('ConnectionStatus', () => {
  it('online e sem fila → não renderiza nada', () => {
    const { container } = render(<ConnectionStatus isOnline={true} isSyncing={false} pendingCount={0} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('offline → mostra "Offline"', () => {
    render(<ConnectionStatus isOnline={false} isSyncing={false} pendingCount={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Offline');
  });

  it('offline com fila → mostra a contagem pendente', () => {
    render(<ConnectionStatus isOnline={false} isSyncing={false} pendingCount={3} />);
    expect(screen.getByRole('status')).toHaveTextContent('Offline · 3 na fila');
  });

  it('online sincronizando → mostra "Sincronizando"', () => {
    render(<ConnectionStatus isOnline={true} isSyncing={true} pendingCount={2} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Sincronizando/);
  });

  it('online com pendentes (sem sincronizar) → indica pendências', () => {
    render(<ConnectionStatus isOnline={true} isSyncing={false} pendingCount={2} />);
    expect(screen.getByRole('status')).toHaveTextContent('2 pendentes para sincronizar');
  });
});
