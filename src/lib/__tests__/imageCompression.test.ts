import { describe, it, expect, vi, afterEach } from 'vitest';
import { computeTargetSize, compressImageFile } from '@/src/lib/imageCompression';

describe('computeTargetSize', () => {
  it('não amplia imagens menores que o limite', () => {
    expect(computeTargetSize(800, 600, 1600)).toEqual({ width: 800, height: 600 });
    expect(computeTargetSize(1600, 1600, 1600)).toEqual({ width: 1600, height: 1600 });
  });

  it('reduz o lado maior mantendo o aspect ratio (landscape)', () => {
    expect(computeTargetSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('reduz o lado maior mantendo o aspect ratio (portrait)', () => {
    expect(computeTargetSize(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
  });

  it('quadrado acima do limite vira o limite', () => {
    expect(computeTargetSize(2000, 2000, 1600)).toEqual({ width: 1600, height: 1600 });
  });
});

describe('compressImageFile — guards e best-effort', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('não toca em não-imagens (retorna o mesmo File)', async () => {
    const pdf = new File([new Blob(['%PDF-1.4'])], 'nota.pdf', { type: 'application/pdf' });
    expect(await compressImageFile(pdf)).toBe(pdf);
  });

  it('não comprime GIF (preservaria só o 1º frame)', async () => {
    const gif = new File([new Blob(['GIF89a'])], 'anim.gif', { type: 'image/gif' });
    expect(await compressImageFile(gif)).toBe(gif);
  });

  it('retorna o File original quando o canvas não está disponível (best-effort)', async () => {
    // jsdom não implementa canvas 2d → getContext retorna null. Forçamos o decode
    // a resolver para isolar o caminho "sem canvas".
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 4000, height: 3000, close: vi.fn() })));
    const png = new File([new Blob([new Uint8Array([1, 2, 3])])], 'foto.png', { type: 'image/png' });
    expect(await compressImageFile(png)).toBe(png);
  });
});
