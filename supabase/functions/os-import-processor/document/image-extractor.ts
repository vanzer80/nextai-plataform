/**
 * Extração de fotos embutidas em PDFs de OS (zero dependências).
 *
 * Varre os bytes do PDF procurando XObjects de imagem com filtro DCTDecode
 * (JPEG) — o formato usado por todos os sistemas reais observados (fotos de
 * campo embutidas por CMMS/Print-to-PDF são sempre JPEG). Imagens FlateDecode
 * (bitmaps tipo PNG) exigiriam re-encode com canvas, indisponível no Edge
 * Runtime — são contadas e ignoradas.
 *
 * Filtros anti-ruído: dimensão mínima e aspect ratio descartam logos e
 * banners de cabeçalho; dedupe por hash descarta logos repetidos por página.
 */

export interface ExtractedPdfImage {
  bytes: Uint8Array;
  width: number;
  height: number;
}

export interface ImageExtractionOptions {
  /** Largura E altura mínimas — descarta ícones e logos (default 200px) */
  minDimension?: number;
  /** Aspect ratio máximo (maior/menor lado) — descarta banners (default 4) */
  maxAspectRatio?: number;
  /** Tamanho mínimo do JPEG em bytes — descarta thumbnails (default 8 KB) */
  minBytes?: number;
  /** Máximo de fotos retornadas (default 20) */
  maxImages?: number;
  /** Teto da soma de bytes das fotos retornadas (default 30 MB) */
  maxTotalBytes?: number;
}

const DEFAULTS: Required<ImageExtractionOptions> = {
  minDimension: 200,
  maxAspectRatio: 4,
  minBytes: 8 * 1024,
  maxImages: 20,
  maxTotalBytes: 30 * 1024 * 1024,
};

const latin1 = new TextDecoder("latin1");

function findBytes(haystack: Uint8Array, needle: string, from: number): number {
  const n = needle.length;
  const limit = haystack.length - n;
  outer: for (let i = from; i <= limit; i++) {
    for (let j = 0; j < n; j++) {
      if (haystack[i + j] !== needle.charCodeAt(j)) continue outer;
    }
    return i;
  }
  return -1;
}

function isPdfWhitespace(byte: number): boolean {
  return byte === 0x20 || byte === 0x0a || byte === 0x0d || byte === 0x09 || byte === 0x0c || byte === 0x00;
}

/**
 * Dado o offset do keyword "stream", retorna o dicionário << ... >> que o
 * precede, ou null se a estrutura não bater (nesting contado de trás pra frente).
 */
function dictBefore(pdf: Uint8Array, streamPos: number): string | null {
  let i = streamPos - 1;
  while (i > 0 && isPdfWhitespace(pdf[i])) i--;
  if (i < 1 || pdf[i] !== 0x3e || pdf[i - 1] !== 0x3e) return null; // espera ">>"
  const dictEnd = i + 1;
  let depth = 1;
  i -= 2;
  while (i > 0) {
    if (pdf[i] === 0x3e && pdf[i - 1] === 0x3e) { depth++; i -= 2; continue; }
    if (pdf[i] === 0x3c && pdf[i - 1] === 0x3c) {
      depth--;
      if (depth === 0) return latin1.decode(pdf.subarray(i - 1, dictEnd));
      i -= 2;
      continue;
    }
    i--;
  }
  return null;
}

// FNV-1a 32-bit — suficiente para dedupe de poucas dezenas de imagens
function fnv1a(bytes: Uint8Array): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export interface ImageExtractionResult {
  images: ExtractedPdfImage[];
  /** Imagens descartadas por filtro (logo/thumbnail/duplicada/não-JPEG) */
  skipped: number;
}

export function extractJpegImagesFromPdf(
  pdf: Uint8Array,
  options?: ImageExtractionOptions,
): ImageExtractionResult {
  const opts = { ...DEFAULTS, ...options };
  const images: ExtractedPdfImage[] = [];
  const seen = new Set<string>();
  let skipped = 0;
  let totalBytes = 0;

  let pos = 0;
  while (images.length < opts.maxImages) {
    const streamPos = findBytes(pdf, "stream", pos);
    if (streamPos === -1) break;
    pos = streamPos + 6;

    // "endstream" também contém "stream" — descarta esses matches
    if (streamPos >= 3 && latin1.decode(pdf.subarray(streamPos - 3, streamPos)) === "end") continue;

    const dict = dictBefore(pdf, streamPos);
    if (!dict) continue;
    if (!/\/Subtype\s*\/Image\b/.test(dict)) continue;

    if (!dict.includes("/DCTDecode")) {
      skipped++; // imagem em formato não-JPEG (FlateDecode etc.) — sem re-encode no Edge
      continue;
    }

    const width = Number(/\/Width\s+(\d+)/.exec(dict)?.[1] ?? 0);
    const height = Number(/\/Height\s+(\d+)/.exec(dict)?.[1] ?? 0);

    // Início dos dados: após "stream" + EOL (\r\n ou \n)
    let dataStart = streamPos + 6;
    if (pdf[dataStart] === 0x0d) dataStart++;
    if (pdf[dataStart] === 0x0a) dataStart++;

    // /Length direto quando disponível; indireto ("N 0 R") → busca endstream.
    // O teste de indireção é feito ANTES e separado — um único regex com lookahead
    // negativo falha por backtracking: em "/Length 12 0 R", (\d+) casa só o "1".
    let dataEnd: number;
    const isIndirectLength = /\/Length\s+\d+\s+\d+\s+R/.test(dict);
    const lenMatch = isIndirectLength ? null : /\/Length\s+(\d+)/.exec(dict);
    if (lenMatch) {
      dataEnd = dataStart + Number(lenMatch[1]);
    } else {
      const endPos = findBytes(pdf, "endstream", dataStart);
      if (endPos === -1) continue;
      dataEnd = endPos;
      while (dataEnd > dataStart && (pdf[dataEnd - 1] === 0x0a || pdf[dataEnd - 1] === 0x0d)) dataEnd--;
    }
    if (dataEnd > pdf.length) continue;

    const bytes = pdf.subarray(dataStart, dataEnd);
    pos = dataEnd;

    // Sanidade: precisa começar com o marcador JPEG SOI (FF D8)
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) continue;

    const minSide = Math.min(width, height);
    const maxSide = Math.max(width, height);
    const isPhoto =
      minSide >= opts.minDimension &&
      maxSide / Math.max(minSide, 1) <= opts.maxAspectRatio &&
      bytes.length >= opts.minBytes;

    if (!isPhoto) { skipped++; continue; }

    const hash = `${bytes.length}:${fnv1a(bytes)}`;
    if (seen.has(hash)) { skipped++; continue; }
    seen.add(hash);

    if (totalBytes + bytes.length > opts.maxTotalBytes) { skipped++; continue; }
    totalBytes += bytes.length;

    // slice() copia — subarray manteria o PDF inteiro vivo na memória
    images.push({ bytes: bytes.slice(), width, height });
  }

  return { images, skipped };
}
