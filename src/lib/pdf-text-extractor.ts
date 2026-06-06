/**
 * Extração de texto client-side via pdfjs-dist.
 * Retorna string vazia em vez de lançar — o servidor usa modo multimodal como fallback.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    // Worker via CDN para evitar problema de bundling no Vite
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

    const pageTexts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ');
      pageTexts.push(pageText);
    }

    return pageTexts.join('\n').trim();
  } catch (err) {
    console.warn('[pdf-text-extractor] falhou, servidor usará modo multimodal:', err);
    return '';
  }
}
