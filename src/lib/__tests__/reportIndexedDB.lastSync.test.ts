import { describe, it, expect, beforeEach } from 'vitest';
import { setLastFullSync, getLastFullSync } from '@/src/lib/reportIndexedDB';

describe('last full sync', () => {
  beforeEach(() => localStorage.clear());

  it('round-trip: grava e lê o timestamp', () => {
    setLastFullSync(1_700_000_000_000);
    expect(getLastFullSync()).toBe(1_700_000_000_000);
  });

  it('retorna 0 quando ausente', () => {
    expect(getLastFullSync()).toBe(0);
  });
});
