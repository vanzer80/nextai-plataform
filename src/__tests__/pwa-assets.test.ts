import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Trava a integridade dos assets de PWA (Etapa 0). Pega regressões silenciosas:
// remover um ícone, voltar orientation para portrait (trava o gestor desktop),
// quebrar um src do manifest, ou referenciar no SW um ícone que não existe.

interface ManifestIcon {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}
interface ManifestScreenshot {
  src: string;
}
interface Manifest {
  icons: ManifestIcon[];
  screenshots?: ManifestScreenshot[];
  orientation: string;
}

const ROOT = process.cwd();
const pub = (...p: string[]): string => join(ROOT, 'public', ...p);
const fromUrl = (src: string): string => src.replace(/^\//, '');
const purposes = (i: ManifestIcon): string[] => (i.purpose ?? '').split(/\s+/).filter(Boolean);

const manifest = JSON.parse(readFileSync(pub('manifest.json'), 'utf-8')) as Manifest;

describe('PWA manifest — instalabilidade (regressão)', () => {
  it('tem PNG 192 e 512 (requisito de instalabilidade do Chrome)', () => {
    const png = manifest.icons.filter((i) => i.type === 'image/png').map((i) => i.sizes);
    expect(png).toContain('192x192');
    expect(png).toContain('512x512');
  });

  it('tem ao menos um ícone com purpose "any" e um "maskable"', () => {
    expect(manifest.icons.some((i) => purposes(i).includes('any'))).toBe(true);
    expect(manifest.icons.some((i) => purposes(i).includes('maskable'))).toBe(true);
  });

  it('orientation é "any" — não regredir para portrait (persona web/gestor desktop)', () => {
    expect(manifest.orientation).toBe('any');
  });

  it('todo icon.src e screenshot.src existe no disco', () => {
    for (const i of manifest.icons) {
      expect(existsSync(pub(fromUrl(i.src))), `icon ausente: ${i.src}`).toBe(true);
    }
    for (const s of manifest.screenshots ?? []) {
      expect(existsSync(pub(fromUrl(s.src))), `screenshot ausente: ${s.src}`).toBe(true);
    }
  });
});

describe('Service Worker + index.html — ícones referenciados existem', () => {
  const sw = readFileSync(pub('sw.js'), 'utf-8');

  it('o push handler referencia icon-192 e badge-72, e ambos existem', () => {
    for (const f of ['icon-192.png', 'badge-72.png']) {
      expect(sw.includes(`/icons/${f}`), `sw.js não referencia ${f}`).toBe(true);
      expect(existsSync(pub('icons', f)), `${f} ausente em public/icons`).toBe(true);
    }
  });

  it('o apple-touch-icon do index.html aponta para um arquivo existente', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf-8');
    const m = html.match(/rel="apple-touch-icon"\s+href="([^"]+)"/);
    expect(m, 'apple-touch-icon não encontrado no index.html').toBeTruthy();
    expect(existsSync(pub(fromUrl(m![1])))).toBe(true);
  });
});
