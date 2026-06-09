import type { ExtractionResult, FieldExtraction } from "../types.ts";
import { extractTextFromPdfBase64 } from "./text-extractor.ts";
import { matchTemplate } from "./template-registry.ts";
import { extractViaAiChain } from "./ai-provider-chain.ts";
import { computeOverallConfidence, mergeFields, needsReview } from "./confidence.ts";

// Campos com confiança abaixo deste valor serão encaminhados para reforço via IA
const AI_BOOST_THRESHOLD = 0.70;

// Campos que devem ser reforçados por IA mesmo se template extraiu com confiança razoável
const ALWAYS_AI_ENHANCE = new Set(["reported_problem", "services_performed", "final_diagnosis"]);

interface PipelineEnv {
  GEMINI_API_KEY_1?: string;
  GEMINI_API_KEY_2?: string;
  OPENAI_API_KEY?: string;
}

/**
 * Pipeline principal de extração documental.
 *
 * Fluxo:
 *  1. Extrai texto (server-side unpdf, ou usa pdfText do browser se fornecido)
 *  2. Tenta template registry (zero custo de IA)
 *  3. Se template cobre tudo com alta confiança → retorna resultado puro
 *  4. Se template parcial → usa IA para preencher/reforçar campos fracos
 *  5. Se sem template → usa IA para extração completa
 *  6. Calcula confiança geral e sinaliza necessidade de revisão
 */
export async function processDocument(
  pdfBase64: string,
  env: PipelineEnv,
  preExtractedText?: string, // texto já extraído pelo browser via pdf.js
): Promise<ExtractionResult> {
  // ── 1. Texto ──────────────────────────────────────────────────────────────
  const pdfText = preExtractedText?.trim()
    ? preExtractedText
    : await extractTextFromPdfBase64(pdfBase64);

  console.log(
    `[pipeline] texto extraído: ${pdfText.length} chars, template tentando...`,
  );

  // ── 2. Template Registry ──────────────────────────────────────────────────
  const templateMatch = pdfText ? matchTemplate(pdfText) : null;
  let fields: Record<string, FieldExtraction> = templateMatch?.fields ?? {};
  let method: ExtractionResult["method"] = "template";
  let templateId: string | null = templateMatch?.parser_id ?? null;

  // ── 3. Verifica se template cobriu tudo bem ───────────────────────────────
  const hasWeakFields = Object.entries(fields).some(
    ([key, f]) => f.confidence < AI_BOOST_THRESHOLD || ALWAYS_AI_ENHANCE.has(key),
  );

  const noTemplate = !templateMatch;

  if (noTemplate || hasWeakFields) {
    const hasAiKeys =
      env.GEMINI_API_KEY_1 || env.GEMINI_API_KEY_2 || env.OPENAI_API_KEY;

    if (hasAiKeys) {
      console.log(
        `[pipeline] ${noTemplate ? "sem template" : "campos fracos"} → acionando IA`,
      );

      // Pode lançar GEMINI_429 se todas as chaves falharem — deixar propagar
      const aiResult = await extractViaAiChain(pdfBase64, pdfText, env);

      if (aiResult) {
        if (templateMatch) {
          // Modo híbrido: template ganha campos de alta confiança, IA preenche o resto
          fields = mergeFields(fields, aiResult.fields);
          method = "hybrid";
        } else {
          fields = aiResult.fields;
          method = aiResult.provider === "gemini" ? "ai:gemini" : "ai:openai";
        }
      } else if (noTemplate) {
        // IA também falhou sem lançar — resultado parcial
        console.warn("[pipeline] IA retornou nulo, resultado parcial");
      }
    } else {
      console.warn("[pipeline] sem chaves de IA configuradas, usando template parcial");
    }
  }

  // ── 4. Confiança geral ────────────────────────────────────────────────────
  const overallConfidence = computeOverallConfidence(fields);

  console.log(
    `[pipeline] método=${method} template=${templateId} confiança=${overallConfidence}`,
  );

  return {
    template_id: templateId,
    method,
    overall_confidence: overallConfidence,
    requires_review: needsReview(overallConfidence),
    fields,
  };
}
