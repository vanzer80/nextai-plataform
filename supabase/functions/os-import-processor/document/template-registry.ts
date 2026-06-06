import type { PdfParser, FieldExtraction } from "../types.ts";
import { decathlonChamadoParser } from "./parsers/decathlon-chamado.ts";

// Registro ordenado por especificidade (mais específico primeiro).
// Para adicionar um novo parser: importar e empurrar neste array.
const REGISTRY: PdfParser[] = [
  decathlonChamadoParser,
];

export interface TemplateMatchResult {
  parser_id: string;
  fields: Record<string, FieldExtraction>;
}

/**
 * Tenta identificar o template do documento e extrair os campos.
 * Retorna null se nenhum parser reconhecer o texto.
 */
export function matchTemplate(text: string): TemplateMatchResult | null {
  for (const parser of REGISTRY) {
    if (parser.detect(text)) {
      console.log(`[template-registry] parser "${parser.id}" reconheceu o documento`);
      return { parser_id: parser.id, fields: parser.parse(text) };
    }
  }
  return null;
}
