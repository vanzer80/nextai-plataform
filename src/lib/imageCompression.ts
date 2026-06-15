// Compressão de imagem client-side (canvas) para o fluxo offline-first do técnico
// de campo: fotos de câmera de celular (3–8 MB) viram JPEG de ~200–500 KB antes de
// irem para o IndexedDB (pendingBlobs) e para o upload. Best-effort: qualquer falha
// retorna o File original — comprimir nunca pode bloquear a captura/envio de uma OS.

export interface CompressOptions {
  maxDimension?: number; // lado maior, em px (default 1600)
  quality?: number; // 0–1 (default 0.72)
  mimeType?: string; // default 'image/jpeg'
}

const DEFAULTS = { maxDimension: 1600, quality: 0.72, mimeType: 'image/jpeg' } as const;

/** Dimensões alvo mantendo o aspect ratio, sem ampliar. Função pura (testável). */
export function computeTargetSize(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  if (width <= max && height <= max) return { width, height };
  if (width >= height) {
    return { width: max, height: Math.round((height * max) / width) };
  }
  return { width: Math.round((width * max) / height), height: max };
}

/**
 * Comprime uma imagem para JPEG via canvas. Não toca em não-imagens (ex.: PDF) nem
 * GIF (preservaria só o 1º frame). Retorna o File original se a compressão falhar,
 * não for suportada (canvas indisponível) ou não reduzir o tamanho.
 */
export async function compressImageFile(file: File, opts: CompressOptions = {}): Promise<File> {
  const { maxDimension, quality, mimeType } = { ...DEFAULTS, ...opts };

  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file;

  try {
    const source = await loadImage(file);
    if (!source) return file;

    const srcW = 'naturalWidth' in source ? source.naturalWidth || source.width : source.width;
    const srcH = 'naturalHeight' in source ? source.naturalHeight || source.height : source.height;
    if (!srcW || !srcH) {
      closeIfBitmap(source);
      return file;
    }

    const { width, height } = computeTargetSize(srcW, srcH, maxDimension);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      closeIfBitmap(source);
      return file;
    }
    ctx.drawImage(source as CanvasImageSource, 0, 0, width, height);
    closeIfBitmap(source);

    const blob = await canvasToBlob(canvas, mimeType, quality);
    if (!blob || blob.size >= file.size) return file; // nunca piorar o tamanho

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: mimeType, lastModified: file.lastModified });
  } catch {
    return file; // best-effort
  }
}

type ImageSource = ImageBitmap | HTMLImageElement;

async function loadImage(file: File): Promise<ImageSource | null> {
  // createImageBitmap aplica a orientação EXIF (from-image) — evita foto deitada.
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* cai para <img> */
    }
  }
  if (typeof Image !== 'function' || typeof URL?.createObjectURL !== 'function') return null;
  return await new Promise<ImageSource | null>((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}

function closeIfBitmap(source: ImageSource): void {
  if ('close' in source && typeof source.close === 'function') source.close();
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof canvas.toBlob === 'function') canvas.toBlob((b) => resolve(b), type, quality);
    else resolve(null);
  });
}
