import type { FieldExtraction, ExtractionResult } from "../types.ts";

// Campos obrigatórios têm peso maior no cálculo de confiança geral
const FIELD_WEIGHTS: Record<string, number> = {
  external_ref_id:    1.5,
  reported_problem:   1.5,
  client_name:        1.2,
  service_date:       1.2,
  technician_name:    1.0,
  service_type:       1.0,
  services_performed: 0.8,
  final_diagnosis:    0.8,
  site_location:      0.5,
  priority:           0.5,
  parts_used:         0.3,
};

const REVIEW_THRESHOLD = 0.70;

/**
 * Calcula confiança geral ponderada a partir dos campos extraídos.
 * Campos ausentes do dicionário de pesos recebem peso 0.3 (neutro).
 */
export function computeOverallConfidence(
  fields: Record<string, FieldExtraction>,
): number {
  let weightedSum = 0;
  let totalWeight = 0;

  for (const [key, extraction] of Object.entries(fields)) {
    const w = FIELD_WEIGHTS[key] ?? 0.3;
    weightedSum += extraction.confidence * w;
    totalWeight += w;
  }

  if (totalWeight === 0) return 0;
  return Math.round((weightedSum / totalWeight) * 1000) / 1000;
}

/**
 * Mescla campos de dois resultados de extração.
 * O campo com maior confiança vence; empate favorece `primary`.
 */
export function mergeFields(
  primary: Record<string, FieldExtraction>,
  secondary: Record<string, FieldExtraction>,
): Record<string, FieldExtraction> {
  const merged: Record<string, FieldExtraction> = { ...primary };

  for (const [key, secField] of Object.entries(secondary)) {
    const existing = merged[key];
    if (!existing || (secField.confidence > existing.confidence && secField.value)) {
      merged[key] = secField;
    }
  }

  return merged;
}

export function needsReview(confidence: number): boolean {
  return confidence < REVIEW_THRESHOLD;
}

/**
 * Converte campos de baixa confiança de uma ExtractionResult
 * em lista de nomes de campo para display na UI.
 */
export function lowConfidenceFields(
  result: ExtractionResult,
  threshold = 0.75,
): string[] {
  return Object.entries(result.fields)
    .filter(([, f]) => f.value !== null && f.confidence < threshold)
    .map(([key]) => key);
}
