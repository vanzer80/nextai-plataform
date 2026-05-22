import { describe, it, expect, vi, beforeEach } from 'vitest';
import { urlToDataUrl, detectImageFormat } from '../imageUtils';

// ── urlToDataUrl ──────────────────────────────────────────────────────────────

describe('urlToDataUrl', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('retorna null quando fetch lança erro de rede (socket fechado)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('socket connection was closed unexpectedly')));
    const result = await urlToDataUrl('https://example.com/image.jpg');
    expect(result).toBeNull();
  });

  it('retorna null quando resposta não é ok (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    const result = await urlToDataUrl('https://example.com/missing.jpg');
    expect(result).toBeNull();
  });

  it('retorna null quando resposta não é ok (500)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const result = await urlToDataUrl('https://example.com/error.jpg');
    expect(result).toBeNull();
  });

  it('retorna data URL quando fetch e FileReader têm sucesso', async () => {
    const fakeDataUrl = 'data:image/jpeg;base64,/9j/fakebase64';

    const mockBlob = new Blob(['fake'], { type: 'image/jpeg' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockBlob) }));

    // jsdom não implementa FileReader.readAsDataURL — simular
    const mockFileReader = {
      onloadend: null as (() => void) | null,
      onerror: null as ((e: unknown) => void) | null,
      result: fakeDataUrl,
      readAsDataURL: vi.fn().mockImplementation(function(this: typeof mockFileReader) {
        Promise.resolve().then(() => this.onloadend?.());
      }),
    };
    vi.stubGlobal('FileReader', vi.fn(() => mockFileReader));

    const result = await urlToDataUrl('https://example.com/image.jpg');
    expect(result).toBe(fakeDataUrl);
  });

  it('retorna null quando FileReader dispara erro', async () => {
    const mockBlob = new Blob(['fake'], { type: 'image/jpeg' });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: () => Promise.resolve(mockBlob) }));

    const mockFileReader = {
      onloadend: null as (() => void) | null,
      onerror: null as ((e: unknown) => void) | null,
      result: null,
      readAsDataURL: vi.fn().mockImplementation(function(this: typeof mockFileReader) {
        Promise.resolve().then(() => this.onerror?.(new Error('read failed')));
      }),
    };
    vi.stubGlobal('FileReader', vi.fn(() => mockFileReader));

    const result = await urlToDataUrl('https://example.com/image.jpg');
    expect(result).toBeNull();
  });
});

// ── detectImageFormat ─────────────────────────────────────────────────────────

describe('detectImageFormat', () => {
  it('detecta PNG pelo mimeType', () => {
    expect(detectImageFormat('image/png', 'data:image/jpeg;base64,abc')).toBe('PNG');
  });

  it('detecta WEBP pelo mimeType', () => {
    expect(detectImageFormat('image/webp', 'data:image/jpeg;base64,abc')).toBe('WEBP');
  });

  it('detecta PNG pelo dataUrl quando mimeType é null', () => {
    expect(detectImageFormat(null, 'data:image/png;base64,abc')).toBe('PNG');
  });

  it('detecta WEBP pelo dataUrl quando mimeType é null', () => {
    expect(detectImageFormat(null, 'data:image/webp;base64,abc')).toBe('WEBP');
  });

  it('retorna JPEG como fallback', () => {
    expect(detectImageFormat(null, 'data:image/jpeg;base64,abc')).toBe('JPEG');
    expect(detectImageFormat('image/jpeg', 'data:image/jpeg;base64,abc')).toBe('JPEG');
  });

  it('mimeType tem prioridade sobre dataUrl', () => {
    // mimeType diz png mas dataUrl diz webp → mimeType vence
    expect(detectImageFormat('image/png', 'data:image/webp;base64,abc')).toBe('PNG');
  });
});
