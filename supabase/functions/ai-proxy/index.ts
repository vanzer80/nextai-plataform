import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT_REQUESTS = 20;    // max per user per window
const RATE_LIMIT_WINDOW_MS = 60_000; // 1-minute sliding window

const RECEIPT_PROMPT = `Você é um perito financeiro especialista em OCR e auditoria de recibos. Analise TODAS as imagens fornecidas e extraia os dados EXATOS.\nREGRA 1: Proibido inventar dados. Se um campo não estiver claramente visível, retorne string vazia ''.\nREGRA 2: O campo 'amount' deve ser numérico (sem R$, sem vírgulas — use ponto decimal).\nREGRA 3: Para 'description', gere texto curto como 'Almoço no Restaurante X em 10/04/2026'.\nREGRA 4: O campo 'expense_date' deve ser a data da despesa no formato YYYY-MM-DD. Se não encontrar, retorne ''.`;
const MATERIAL_PROMPT = `Você é um especialista em equipamentos de HVAC, refrigeração e componentes técnicos industriais.\nAnalise a imagem e extraia as informações técnicas visíveis. A imagem pode ser: etiqueta de equipamento, plaqueta de identificação, componente físico, catálogo ou nota de compra.\nREGRA 1: Extraia apenas o que está claramente visível na imagem. Não invente dados.\nREGRA 2: 'especificacao_tecnica' deve ser UMA FRASE DESCRITIVA EM TEXTO SIMPLES — NÃO retorne um objeto JSON neste campo.\nREGRA 3: 'marca', 'modelo', 'codigo_referencia', 'tensao', 'capacidade': preencha se visível, retorne '' se não identificável.\nREGRA 4: 'quantidade' deve ser '1 unidade' se não estiver especificada na imagem.\nREGRA 5: 'obs' deve capturar outras informações técnicas relevantes visíveis. Retorne '' se não houver.`;
const RECEIPT_VOICE_PROMPT = `Você é um assistente de preenchimento de formulário de reembolso. O usuário descreveu verbalmente uma despesa.\nREGRA 1: Interprete datas relativas com base na data atual.\nREGRA 2: 'amount' deve ser numérico (sem R$).\nREGRA 3: Se o usuário não mencionou algum campo, retorne string vazia '' ou 0 para amount.\nREGRA 4: 'expense_date' no formato YYYY-MM-DD.`;
const MATERIAL_VOICE_PROMPT = `Você é um assistente de preenchimento de solicitação de compra de materiais industriais.\nREGRA 1: Preencha 'especificacao_tecnica' com uma frase descritiva do material em texto simples.\nREGRA 2: Para 'marca', 'modelo', 'codigo_referencia', 'tensao', 'capacidade': extraia se o técnico mencionou, retorne '' caso contrário.\nREGRA 3: 'quantidade' deve incluir unidade (ex: '2 unidades', '5 metros'). Default: '1 unidade'.\nREGRA 4: Se algum campo não foi mencionado, retorne string vazia ''.`;
const DIAGNOSTIC_PROMPT = `Você é um engenheiro técnico especialista em manutenção industrial.\n1. Reescreva o diagnóstico em linguagem técnica formal.\n2. Identifique possíveis causas raiz.\n3. Sugira recomendação técnica objetiva.\nREGRAS: Nunca inventar informações. Linguagem profissional. 'possible_causes' é array (1-4 itens).`;

const RECEIPT_SCHEMA = { type: "OBJECT", properties: { expenseType: { type: "STRING", enum: ["Combustível","Alimentação","Hospedagem","Estacionamento","Material","Outros"] }, amount: { type: "NUMBER" }, favorecido: { type: "STRING" }, pix: { type: "STRING" }, description: { type: "STRING" }, expense_date: { type: "STRING" } }, required: ["expenseType","amount","favorecido","pix","description","expense_date"] };
const MATERIAL_SCHEMA = { type: "OBJECT", properties: { especificacao_tecnica: { type: "STRING" }, marca: { type: "STRING" }, modelo: { type: "STRING" }, codigo_referencia: { type: "STRING" }, tensao: { type: "STRING" }, capacidade: { type: "STRING" }, quantidade: { type: "STRING" }, obs: { type: "STRING" } }, required: ["especificacao_tecnica","marca","modelo","codigo_referencia","tensao","capacidade","quantidade","obs"] };
const DIAGNOSTIC_SCHEMA = { type: "OBJECT", properties: { final_diagnosis: { type: "STRING" }, technical_description: { type: "STRING" }, possible_causes: { type: "ARRAY", items: { type: "STRING" } }, recommendation: { type: "STRING" } }, required: ["final_diagnosis","technical_description","possible_causes","recommendation"] };

interface CallResult {
  text:       string;
  provider:   "gemini_1" | "gemini_2" | "openai";
  isFallback: boolean;
}

// Extracts user UUID from JWT sub claim without a round-trip to the auth server.
// The JWT signature was already verified by the Supabase API gateway before reaching this function.
function extractUserId(authHeader: string): string | null {
  try {
    const parts = authHeader.replace("Bearer ", "").split(".");
    if (parts.length !== 3) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(payload));
    return typeof decoded.sub === "string" ? decoded.sub : null;
  } catch {
    return null;
  }
}

// Per-user sliding window rate limiter. Limit: RATE_LIMIT_REQUESTS por RATE_LIMIT_WINDOW_MS.
// Deno.openKv() não é suportado de forma estável no Supabase Edge Runtime (API do Deno
// Deploy) — quando indisponível, cai para um Map in-memory do isolate. Qualquer falha de
// infraestrutura é fail-open: rate limit é proteção de custo, nunca pode derrubar a feature.
let kvPromise: Promise<Deno.Kv | null> | null = null;
function getKv(): Promise<Deno.Kv | null> {
  // try síncrono: se Deno.openKv não existir no runtime, a chamada lança TypeError
  kvPromise ??= (async () => {
    try { return await Deno.openKv(); } catch { return null; }
  })();
  return kvPromise;
}

const memCounts = new Map<string, number>();

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  try {
    const window = Math.floor(Date.now() / RATE_LIMIT_WINDOW_MS);
    const kv = await getKv();
    if (kv) {
      const key = ["ratelimit", userId, window];
      const entry = await kv.get<number>(key);
      const count = (entry.value ?? 0) + 1;
      if (count > RATE_LIMIT_REQUESTS) return { allowed: false, remaining: 0 };
      await kv.set(key, count, { expireIn: RATE_LIMIT_WINDOW_MS * 2 });
      return { allowed: true, remaining: RATE_LIMIT_REQUESTS - count };
    }
    // Fallback in-memory (por isolate): mesma janela; janelas antigas são descartadas.
    const memKey = `${userId}:${window}`;
    for (const k of memCounts.keys()) {
      if (!k.endsWith(`:${window}`)) memCounts.delete(k);
    }
    const count = (memCounts.get(memKey) ?? 0) + 1;
    memCounts.set(memKey, count);
    if (count > RATE_LIMIT_REQUESTS) return { allowed: false, remaining: 0 };
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS - count };
  } catch {
    return { allowed: true, remaining: RATE_LIMIT_REQUESTS };
  }
}

function isQuota(err: Error) {
  return err.message.includes("GEMINI_429") || err.message.includes("GEMINI_503");
}

async function callGemini(apiKey: string, contents: unknown[], system: string, schema: unknown): Promise<string> {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents, generationConfig: { responseMimeType: "application/json", responseSchema: schema }, systemInstruction: { parts: [{ text: system }] } }),
  });
  if (!res.ok) throw new Error(`GEMINI_${res.status}:${await res.text()}`);
  const d = await res.json();
  return d.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
}

async function callOpenAI(systemPrompt: string, userContent: unknown[]): Promise<string> {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) throw new Error("OPENAI_API_KEY não configurado");
  const res = await fetch(OPENAI_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${key}` },
    body: JSON.stringify({ model: "gpt-4o-mini", response_format: { type: "json_object" }, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userContent }] }),
  });
  if (!res.ok) throw new Error(`OPENAI_${res.status}:${await res.text()}`);
  const d = await res.json();
  return d.choices[0].message.content;
}

async function callWithFallback(
  contents: unknown[],
  system: string,
  schema: unknown,
  openaiUserContent: unknown[],
): Promise<CallResult> {
  const keys = [Deno.env.get("GEMINI_API_KEY_1"), Deno.env.get("GEMINI_API_KEY_2")].filter((k): k is string => !!k);
  let lastErr: Error | null = null;
  for (let i = 0; i < keys.length; i++) {
    try {
      const text = await callGemini(keys[i], contents, system, schema);
      return { text, provider: i === 0 ? "gemini_1" : "gemini_2", isFallback: false };
    } catch (err) {
      lastErr = err instanceof Error ? err : new Error(String(err));
      if (!isQuota(lastErr)) throw lastErr;
    }
  }
  const text = await callOpenAI(system, openaiUserContent);
  return { text, provider: "openai", isFallback: true };
}

function logRouting(
  requestType: string,
  provider: string,
  isFallback: boolean,
  latencyMs: number,
  success: boolean,
  errorCode: string | null,
): void {
  // Fire-and-forget — erro de log nunca propaga nem atrasa a resposta
  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  supabaseAdmin.from("ai_routing_log").insert({
    request_type: requestType,
    provider,
    is_fallback:  isFallback,
    latency_ms:   latencyMs,
    success,
    error_code:   errorCode,
  }).then(() => {}).catch(() => {});
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Headers por requisição — NUNCA mutar corsHeaders (objeto module-level compartilhado
  // entre requisições concorrentes do mesmo isolate).
  const resHeaders: Record<string, string> = { ...corsHeaders, "Content-Type": "application/json" };

  // Try externo: invariante — nenhum caminho de resposta sai sem os headers CORS.
  // Exceção não tratada faria o runtime devolver 500 sem CORS → browser bloqueia a
  // leitura e o client recebe FunctionsFetchError em vez do erro real.
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: resHeaders });
    }

    // Per-user rate limiting: 20 req/min. Protects against runaway costs across all tenants.
    const userId = extractUserId(authHeader);
    if (userId) {
      const { allowed, remaining } = await checkRateLimit(userId);
      // Expose remaining quota in response headers for client-side awareness
      resHeaders["X-RateLimit-Limit"] = String(RATE_LIMIT_REQUESTS);
      resHeaders["X-RateLimit-Remaining"] = String(remaining);
      if (!allowed) {
        return new Response(
          JSON.stringify({ error: "Limite de requisições atingido. Tente novamente em 1 minuto." }),
          { status: 429, headers: { ...resHeaders, "Retry-After": "60" } },
        );
      }
    }

    let body: Record<string, unknown>;
    try { body = await req.json(); }
    catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: resHeaders }); }

    const { type } = body;
    const startTime = Date.now();

    try {
    let callResult: CallResult;

    if (type === "receipt_images" || type === "material_images") {
      const images = body.images as Array<{ base64: string; mimeType: string }>;
      const isReceipt = type === "receipt_images";
      const geminiParts = [
        ...images.map(img => ({ inlineData: { data: img.base64, mimeType: img.mimeType } })),
        { text: isReceipt ? "Analise todas as imagens e extraia os dados do recibo/comprovante." : "Analise todas as imagens e identifique o material/componente técnico." },
      ];
      const openaiParts = [
        ...images.map(img => ({ type: "image_url", image_url: { url: `data:${img.mimeType};base64,${img.base64}` } })),
        { type: "text", text: isReceipt ? "Retorne JSON com: expenseType, amount, favorecido, pix, description, expense_date" : "Retorne JSON com: especificacao_tecnica, marca, modelo, codigo_referencia, tensao, capacidade, quantidade, obs" },
      ];
      callResult = await callWithFallback([{ parts: geminiParts, role: "user" }], isReceipt ? RECEIPT_PROMPT : MATERIAL_PROMPT, isReceipt ? RECEIPT_SCHEMA : MATERIAL_SCHEMA, openaiParts);

    } else if (type === "receipt_voice") {
      const t = body.transcript as string;
      callResult = await callWithFallback(
        [{ parts: [{ text: `O usuário disse: "${t}"\n\nExtraia os dados do reembolso.` }], role: "user" }],
        RECEIPT_VOICE_PROMPT, RECEIPT_SCHEMA,
        [{ type: "text", text: `${RECEIPT_VOICE_PROMPT}\n\nO usuário disse: "${t}"\n\nRetorne JSON com: expenseType, amount, favorecido, pix, description, expense_date` }],
      );

    } else if (type === "material_voice") {
      const t = body.transcript as string;
      callResult = await callWithFallback(
        [{ parts: [{ text: `O técnico disse: "${t}"\n\nExtraia as informações do material.` }], role: "user" }],
        MATERIAL_VOICE_PROMPT, MATERIAL_SCHEMA,
        [{ type: "text", text: `${MATERIAL_VOICE_PROMPT}\n\nO técnico disse: "${t}"\n\nRetorne JSON com: especificacao_tecnica, marca, modelo, codigo_referencia, tensao, capacidade, quantidade, obs` }],
      );

    } else if (type === "diagnostic") {
      const rawInput = body.rawInput as string;
      const ctx = body.context as { serviceType: string; assetDescription?: string; reportedProblem?: string };
      const prompt = `Diagnóstico informal: "${rawInput}"\nTipo: ${ctx.serviceType}.${ctx.assetDescription ? `\nAtivo: ${ctx.assetDescription}.` : ""}${ctx.reportedProblem ? `\nProblema: ${ctx.reportedProblem}.` : ""}\nReescreva e estruture.`;
      callResult = await callWithFallback(
        [{ parts: [{ text: prompt }], role: "user" }],
        DIAGNOSTIC_PROMPT, DIAGNOSTIC_SCHEMA,
        [{ type: "text", text: `${DIAGNOSTIC_PROMPT}\n\n${prompt}\n\nRetorne JSON com: final_diagnosis, technical_description, possible_causes (array), recommendation` }],
      );

    } else {
      return new Response(JSON.stringify({ error: `Tipo desconhecido: ${type}` }), { status: 400, headers: resHeaders });
    }

    const latencyMs = Date.now() - startTime;
    logRouting(type as string, callResult.provider, callResult.isFallback, latencyMs, true, null);

    return new Response(JSON.stringify(JSON.parse(callResult.text)), { headers: resHeaders });

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const latencyMs = Date.now() - startTime;
      logRouting(type as string, "gemini_1", false, latencyMs, false, msg.slice(0, 100));
      return new Response(JSON.stringify({ error: msg }), { status: 500, headers: resHeaders });
    }
  } catch (err) {
    // Última linha de defesa — erro imprevisto (fora do dispatch) ainda responde com CORS.
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: resHeaders });
  }
});
