import { describe, it, expect } from 'vitest';
import { initMonitoring, captureException } from '@/src/lib/monitoring';

// Sem VITE_SENTRY_DSN no ambiente de teste → tudo deve ser inerte e seguro.
describe('monitoring — inerte sem DSN', () => {
  it('initMonitoring resolve sem carregar o Sentry', async () => {
    await expect(initMonitoring()).resolves.toBeUndefined();
  });

  it('captureException é no-op seguro quando não inicializado', () => {
    expect(() => captureException(new Error('x'))).not.toThrow();
  });
});
