import type { FieldExtraction } from "../types.ts";

// ─── types ────────────────────────────────────────────────────────────────────

export interface AiExtractionResult {
  fields: Record<string, FieldExtraction>;
  provider: "gemini" | "openai";
}

// ─── prompt ───────────────────────────────────────────────────────────────────

const EXTRACTION_SCHEMA_PROMPT = `
Você é um especialista em extração estruturada de dados de ordens de serviço técnicas.
Extraia os seguintes campos do documento e retorne JSON válido (sem markdown, sem explicações):

{
  "external_ref_id": "número/código único da OS no sistema de origem ou null",
  "client_name": "nome completo da empresa cliente ou null",
  "technician_name": "nome do técnico responsável ou null",
  "service_date": "data do serviço em formato YYYY-MM-DD ou null",
  "service_type": "tipo de serviço (ex: Manutenção Corretiva) ou null",
  "reported_problem": "descrição completa do problema relatado ou null",
  "final_diagnosis": "diagnóstico final / resolução da avaria ou null",
  "services_performed": "serviços executados / observações de conclusão ou null",
  "site_location": "endereço ou local de atendimento ou null",
  "priority": "somente um de: alta | media | baixa | null",
  "parts_used": "peças utilizadas ou null",
  "internal_notes": "notas internas relevantes ou null"
}

Regras:
- Retorne APENAS o JSON acima, sem texto adicional
- Para campos não encontrados, use null
- Datas sempre em YYYY-MM-DD
- Datas numéricas ambíguas (ex: "4/8/2026" pode ser 8 de abril ou 4 de agosto): determine o locale pelo contexto do documento — horários AM/PM ou datas por extenso em inglês (ex: "Saturday, June 6, 2026") indicam EN-US, leia M/D/YYYY; documento em português sem esses indícios, leia D/M/YYYY
- priority deve ser exatamente: alta, media, baixa ou null
`.trim();

// ─── helpers ──────────────────────────────────────────────────────────────────

function aiField(value: string | null): FieldExtraction {
  return { value, confidence: value ? 0.78 : 0, source: "ai" };
}

function parseAiJson(raw: string): Record<string, string | null> | null {
  try {
    const cleaned = raw.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function jsonToFields(
  data: Record<string, string | null>,
): Record<string, FieldExtraction> {
  const fields: Record<string, FieldExtraction> = {};
  for (const [k, v] of Object.entries(data)) {
    fields[k] = aiField(typeof v === "string" ? v.trim() : null);
  }
  return fields;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

// gemini-2.0-flash teve o free tier ZERADO pelo Google (429 com limit: 0) — mesma
// migração feita no ai-proxy v15. O free tier atual vale para gemini-2.5-flash.
const GEMINI_MODEL = "gemini-2.5-flash";

async function callGemini(
  apiKey: string,
  pdfBase64: string,
  pdfText: string,
): Promise<Record<string, FieldExtraction> | null> {
  const parts: unknown[] = [{ text: EXTRACTION_SCHEMA_PROMPT }];

  if (pdfText) {
    parts.push({ text: `\n\nTexto extraído do PDF:\n\n${pdfText.slice(0, 12000)}` });
  } else {
    parts.push({
      inline_data: { mime_type: "application/pdf", data: pdfBase64 },
    });
  }

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        // thinkingBudget: 0 — 2.5-flash pensa por default; para extração estruturada só adiciona latência/custo
        generationConfig: {
          responseMimeType: "application/json",
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    },
  );

  if (res.status === 429 || res.status === 503) {
    throw new Error(`GEMINI_429: HTTP ${res.status}`);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Gemini HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const data = parseAiJson(text);
  return data ? jsonToFields(data) : null;
}

// ─── OpenAI (fallback textual) ────────────────────────────────────────────────

async function callOpenAI(
  apiKey: string,
  pdfText: string,
): Promise<Record<string, FieldExtraction> | null> {
  if (!pdfText) {
    console.warn("[ai-provider-chain] OpenAI fallback sem texto extraído — ignorando");
    return null;
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: EXTRACTION_SCHEMA_PROMPT },
        {
          role: "user",
          content: `Extraia os campos deste documento:\n\n${pdfText.slice(0, 14000)}`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${body.slice(0, 300)}`);
  }

  const json = await res.json();
  const text: string = json?.choices?.[0]?.message?.content ?? "";
  const data = parseAiJson(text);
  return data ? jsonToFields(data) : null;
}

// ─── chain pública ────────────────────────────────────────────────────────────

/**
 * Tenta extrair campos via IA em cadeia: Gemini key1 → Gemini key2 → OpenAI.
 * Lança GEMINI_429 se ambas as chaves Gemini falharem por quota.
 * Retorna null somente se todos os provedores falharem com erros não-quota.
 */
export async function extractViaAiChain(
  pdfBase64: string,
  pdfText: string,
  env: {
    GEMINI_API_KEY_1?: string;
    GEMINI_API_KEY_2?: string;
    OPENAI_API_KEY?: string;
  },
): Promise<AiExtractionResult | null> {
  const geminiKeys = [env.GEMINI_API_KEY_1, env.GEMINI_API_KEY_2].filter(Boolean) as string[];
  let lastGeminiError: Error | null = null;
  let geminiQuotaExhausted = false;

  // Tenta cada chave Gemini em sequência
  for (const key of geminiKeys) {
    try {
      const fields = await callGemini(key, pdfBase64, pdfText);
      if (fields) return { fields, provider: "gemini" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      lastGeminiError = err instanceof Error ? err : new Error(msg);
      if (msg.includes("GEMINI_429")) {
        geminiQuotaExhausted = true;
        console.warn("[ai-provider-chain] Gemini quota esgotada, tentando próxima chave...");
      } else {
        console.error("[ai-provider-chain] Gemini erro:", msg);
      }
    }
  }

  // Fallback OpenAI
  if (env.OPENAI_API_KEY) {
    try {
      console.log("[ai-provider-chain] Tentando OpenAI como fallback...");
      const fields = await callOpenAI(env.OPENAI_API_KEY, pdfText);
      if (fields) return { fields, provider: "openai" };
    } catch (err) {
      console.error("[ai-provider-chain] OpenAI erro:", err);
    }
  }

  // Se todas as chaves Gemini falharam por quota e não há OpenAI disponível
  if (geminiQuotaExhausted && !env.OPENAI_API_KEY) {
    throw lastGeminiError ?? new Error("GEMINI_429: todas as chaves esgotadas");
  }

  return null;
}
