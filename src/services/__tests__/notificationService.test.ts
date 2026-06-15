import { describe, it, expect, vi, beforeEach } from 'vitest';

const { eqMock } = vi.hoisted(() => ({ eqMock: vi.fn() }));

vi.mock('@/src/lib/supabase', () => ({
  supabase: { from: () => ({ update: () => ({ eq: eqMock }) }) },
}));

import { markNotificationReadResilient, flushNotificationReadQueue } from '@/src/services/notificationService';

const KEY = 'nextai-notif-read-queue';
const queue = (): string[] => JSON.parse(localStorage.getItem(KEY) || '[]');

beforeEach(() => {
  localStorage.clear();
  eqMock.mockReset();
});

describe('markNotificationReadResilient', () => {
  it('sucesso não enfileira', async () => {
    eqMock.mockResolvedValue({ error: null });
    await markNotificationReadResilient('n1');
    expect(queue()).toEqual([]);
  });

  it('erro do supabase enfileira', async () => {
    eqMock.mockResolvedValue({ error: { message: 'x' } });
    await markNotificationReadResilient('n1');
    expect(queue()).toEqual(['n1']);
  });

  it('exceção (offline) enfileira', async () => {
    eqMock.mockRejectedValue(new Error('network'));
    await markNotificationReadResilient('n2');
    expect(queue()).toEqual(['n2']);
  });

  it('não duplica id na fila', async () => {
    eqMock.mockResolvedValue({ error: { message: 'x' } });
    await markNotificationReadResilient('n1');
    await markNotificationReadResilient('n1');
    expect(queue()).toEqual(['n1']);
  });
});

describe('flushNotificationReadQueue', () => {
  it('remove os que sincronizam e mantém os que falham', async () => {
    localStorage.setItem(KEY, JSON.stringify(['a', 'b']));
    eqMock.mockImplementation((_col: string, id: string) =>
      Promise.resolve({ error: id === 'b' ? { message: 'fail' } : null }));
    await flushNotificationReadQueue();
    expect(queue()).toEqual(['b']);
  });

  it('fila vazia é no-op (não chama o supabase)', async () => {
    await flushNotificationReadQueue();
    expect(eqMock).not.toHaveBeenCalled();
  });
});
