/**
 * Extração server-side de texto de PDF via unpdf (Deno-compatible).
 * Retorna string vazia em vez de lançar — a pipeline trata ausência de texto
 * como sinal para modo multimodal (enviar bytes ao Gemini).
 */
export async function extractTextFromPdfBase64(base64: string): Promise<string> {
  try {
    const { extractText } = await import("npm:unpdf@0.11.0");
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const { text } = await extractText(bytes, { mergePages: true });
    return text?.trim() ?? "";
  } catch (err) {
    console.warn("[text-extractor] unpdf falhou, modo multimodal ativo:", err);
    return "";
  }
}
