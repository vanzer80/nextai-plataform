// Unidade atômica de extração: um campo + sua confiança + origem
export interface FieldExtraction {
  value: string | null;
  confidence: number; // 0.0 – 1.0
  source: "template" | "ai";
}

// Resultado completo da pipeline de extração documental
export interface ExtractionResult {
  template_id: string | null; // ex: "decathlon-chamado"
  method: "template" | "ai:gemini" | "ai:openai" | "hybrid";
  overall_confidence: number;
  requires_review: boolean; // true se overall_confidence < threshold
  fields: Record<string, FieldExtraction>;
}

// Contrato de um parser de template
export interface PdfParser {
  id: string;
  detect: (text: string) => boolean;
  parse: (text: string) => Record<string, FieldExtraction>;
}

// Mapa de campos extraídos para campos do payload da OS
export interface NormalizedOsFields {
  external_ref_id?: string;
  client_name?: string;
  technician_name?: string;
  service_date?: string; // ISO 8601
  service_type?: string;
  reported_problem?: string;
  final_diagnosis?: string;
  services_performed?: string;
  internal_notes?: string;
  priority?: string;
  site_location?: string;
  parts_used?: string;
}
