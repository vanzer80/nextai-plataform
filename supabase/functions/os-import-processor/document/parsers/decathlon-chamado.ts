import type { FieldExtraction, PdfParser } from "../../types.ts";

// ─── helpers ─────────────────────────────────────────────────────────────────

function field(value: string | null, confidence: number): FieldExtraction {
  return { value: value?.trim() || null, confidence, source: "template" };
}

function firstMatch(text: string, re: RegExp, group = 1): string | null {
  return re.exec(text)?.[group]?.trim() || null;
}

// Datas da Decathlon vêm em EN-US — "4/8/2026 2:31 PM" é 8 de abril (M/D/YYYY).
// Componente > 12 torna a leitura inequívoca em qualquer ordem; ambos ≤ 12 é
// ambíguo e o locale do template decide, com confiança reduzida para que o
// pipeline force revisão humana do campo.
const DATE_CONFIDENCE_UNAMBIGUOUS = 0.97;
const DATE_CONFIDENCE_AMBIGUOUS = 0.55;

interface LocaleDate {
  iso: string;
  ambiguous: boolean;
}

function parseEnUsDate(aRaw: string, bRaw: string, y: string): LocaleDate | null {
  const a = Number(aRaw);
  const b = Number(bRaw);

  let month: number;
  let day: number;
  let ambiguous = false;

  if (a <= 12 && b > 12) {
    month = a;
    day = b;
  } else if (a > 12 && b <= 12) {
    month = b;
    day = a;
  } else if (a <= 12 && b <= 12) {
    month = a;
    day = b;
    ambiguous = true;
  } else {
    return null;
  }

  const iso = `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  // Round-trip via Date rejeita componentes inválidos (0, 2/30, 4/31, …)
  const check = new Date(`${iso}T00:00:00Z`);
  if (check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return { iso, ambiguous };
}

// Extrai bloco de texto entre dois marcadores (primeiro match de cada)
function extractBetween(
  text: string,
  startMarker: RegExp,
  endMarker: RegExp,
): string | null {
  const s = startMarker.exec(text);
  if (!s) return null;
  const after = text.slice(s.index + s[0].length);
  const e = endMarker.exec(after);
  const block = e ? after.slice(0, e.index) : after;
  return block.replace(/\?/g, "•").replace(/\s{3,}/g, "\n").trim() || null;
}

// ─── parser ──────────────────────────────────────────────────────────────────

function parse(text: string): Record<string, FieldExtraction> {
  const fields: Record<string, FieldExtraction> = {};

  // external_ref_id — "Chamado Nº 12345"
  const refMatch = /Chamado\s+N[º°o]?\s*(\d+)/i.exec(text);
  fields.external_ref_id = field(refMatch?.[1] ?? null, refMatch ? 0.98 : 0);

  // client_name — primeira empresa LTDA/S.A./EIRELI/ME/EPP
  const clientMatch =
    /([A-ZÁÉÍÓÚÂÊÎÔÛÀÃÕÇ][A-Za-záéíóúâêîôûàãõçÁÉÍÓÚÂÊÎÔÛÀÃÕÇ\s.,\-&]+?(?:LTDA|S\.A\.|EIRELI|ME|EPP|S\/A)(?:\s*\.)?)/m.exec(
      text,
    );
  // Remove artefatos comuns como "E-mail:…" que grudam no nome
  const rawClient = clientMatch?.[1]?.replace(/\s*E-mail.*$/i, "").trim() ?? null;
  fields.client_name = field(rawClient, rawClient ? 0.92 : 0);

  // service_date — "Criado em\n M/D/YYYY" (duas colunas intercaladas, locale EN-US)
  const dateMatch =
    /Criado\s+em\s*[\n\r]+\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(text) ??
    /Criado\s+em\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(text);
  const date = dateMatch ? parseEnUsDate(dateMatch[1], dateMatch[2], dateMatch[3]) : null;
  fields.service_date = field(
    date?.iso ?? null,
    date ? (date.ambiguous ? DATE_CONFIDENCE_AMBIGUOUS : DATE_CONFIDENCE_UNAMBIGUOUS) : 0,
  );

  // service_type — linha após "Tipo de Serviço" ou regex de tipo de manutenção
  const stMatch =
    /Tipo\s+de\s+Servi[çc]o\s*[\n\r]+\s*([^\n\r]+)/i.exec(text) ??
    /^(Manuten[çc][aã]o\s+\w[\w\s]*)/m.exec(text);
  fields.service_type = field(stMatch?.[1] ?? null, stMatch ? 0.88 : 0);

  // technician_name — padrão de intercalamento: "Fornecedor\nTécnico\n<nome_fornecedor>\n<nome_técnico>"
  const techBlock =
    /Fornecedor\s*[\n\r]+\s*T[eé]cnico\s*[\n\r]+\s*([^\n\r]+)\s*[\n\r]+\s*([^\n\r]+)/i.exec(
      text,
    );
  // grupo 2 = técnico (valor da coluna direita)
  const techName = techBlock?.[2]?.trim() || firstMatch(text, /T[eé]cnico\s*:\s*([^\n\r]+)/i);
  fields.technician_name = field(techName ?? null, techName ? 0.85 : 0);

  // reported_problem — entre "Observações de criação" e "Observações de conclusão"
  const problem = extractBetween(
    text,
    /Observa[çc][õo]es\s+de\s+cria[çc][aã]o/i,
    /Observa[çc][õo]es\s+de\s+conclus[aã]o/i,
  );
  fields.reported_problem = field(problem, problem ? 0.90 : 0);

  // services_performed — entre "Observações de conclusão" e "Imagens de"
  const services = extractBetween(
    text,
    /Observa[çc][õo]es\s+de\s+conclus[aã]o/i,
    /Imagens\s+de/i,
  );
  fields.services_performed = field(services, services ? 0.88 : 0);

  // final_diagnosis — após "Resolução da Avaria"
  const diagMatch = /Resolu[çc][aã]o\s+da\s+Avaria\s*[\n\r]+\s*([^\n\r]+)/i.exec(text);
  fields.final_diagnosis = field(diagMatch?.[1] ?? null, diagMatch ? 0.85 : 0);

  // site_location — linha após "Local" ou "Endereço"
  const siteMatch =
    /Local\s*:\s*([^\n\r]+)/i.exec(text) ??
    /Endere[çc]o\s*[\n\r]+\s*([^\n\r]+)/i.exec(text);
  fields.site_location = field(siteMatch?.[1] ?? null, siteMatch ? 0.80 : 0);

  // priority — mapeado a partir de termos do documento
  const prioRaw = text.match(/Prioridade\s*[\n\r:]+\s*(\w+)/i)?.[1]?.toLowerCase() ?? null;
  const PRIO_MAP: Record<string, string> = {
    alta: "alta", high: "alta", urgente: "alta", urgent: "alta",
    media: "media", médio: "media", medium: "media", normal: "media",
    baixa: "baixa", low: "baixa",
  };
  const mappedPrio = prioRaw ? (PRIO_MAP[prioRaw] ?? null) : null;
  fields.priority = field(mappedPrio, mappedPrio ? 0.82 : 0);

  return fields;
}

// ─── export ───────────────────────────────────────────────────────────────────

export const decathlonChamadoParser: PdfParser = {
  id: "decathlon-chamado",

  detect(text: string): boolean {
    // Ambos os marcadores obrigatórios devem estar presentes
    return (
      /Chamado\s+N[º°o]?\s*\d+/i.test(text) &&
      /Detalhes\s+do\s+Chamado/i.test(text)
    );
  },

  parse,
};
