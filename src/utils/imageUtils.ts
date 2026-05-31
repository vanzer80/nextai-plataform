/**
 * Mede as dimensões naturais (px) de uma imagem a partir de uma data URL.
 * Usa a API nativa do browser (HTMLImageElement.naturalWidth/Height) — garantidamente
 * correta para qualquer formato (JPEG, PNG, WebP, SVG…), sem depender de internals do jsPDF.
 * Retorna null se o decode falhar (PDF é gerado mesmo assim, sem logo).
 */
export function measureImage(dataUrl: string): Promise<{ width: number; height: number } | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload  = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}

/**
 * Calcula as dimensões renderizadas de uma imagem dentro de um box (maxW × maxH),
 * preservando o aspect ratio sem distorção.
 */
export function fitInBox(
  srcW: number,
  srcH: number,
  maxW: number,
  maxH: number,
): { w: number; h: number } {
  if (srcW <= 0 || srcH <= 0) return { w: maxW, h: maxH };
  const aspect = srcW / srcH;
  let h = maxH;
  let w = h * aspect;
  if (w > maxW) {
    w = maxW;
    h = w / aspect;
  }
  return { w, h };
}

export async function urlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function detectImageFormat(mimeType: string | null, dataUrl: string): string {
  if (mimeType?.includes('png'))  return 'PNG';
  if (mimeType?.includes('webp')) return 'WEBP';
  if (dataUrl.startsWith('data:image/png'))  return 'PNG';
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP';
  return 'JPEG';
}
