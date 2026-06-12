// os-import-processor v8 — NextAI OS Import Bridge
//
// Recebe uma OS de qualquer sistema externo (TOTVS, SAP, Omie, PDF),
// normaliza para o schema padrão NextAI e cria em service_reports.
// v8: fotos embutidas no PDF são extraídas e anexadas à OS (report_attachments);
//     fotos passam ao bucket reports_media (o app lê anexos de lá, não de "reports");
//     extração IA migrada para gemini-2.5-flash (free tier do 2.0-flash foi zerado).
//
// Separado da api-gateway porque:
//   - Processamento PDF pode levar 5-15s (Gemini + Storage) — bloquearia a gateway responsiva
//   - Responsabilidade única: gateway = CRUD rápido; este = normalização pesada
//   - Deploy e timeout independentes
//
// Auth: X-API-Key → SHA-256 → api_keys (mesmo padrão da api-gateway)
// Scope: orders:write
// Method: POST apenas

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { processDocument } from "./document/pipeline.ts";
import { extractJpegImagesFromPdf } from "./document/image-extractor.ts";
import type { ExtractionResult } from "./types.ts";

const SUPABASE_URL              = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Mesmo bucket e convenção de caminho do app (reportService.ts) — a tela de
// detalhe da OS gera signed URLs de reports_media a partir de report_attachments.
const STORAGE_BUCKET = "reports_media";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, idempotency-key",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ── Tipos ─────────────────────────────────────────────────────────────────────

const EXTERNAL_SOURCES = ["totvs", "sap", "omie", "pdf", "custom"] as const;
type ExternalSource = typeof EXTERNAL_SOURCES[number];

interface PhotoItem {
  base64:    string;
  mime_type: string;
  filename?: string;
}

interface OsImportPayload {
  mode:              "json" | "pdf";
  external_source:   ExternalSource;
  external_ref_id:   string;
  // PDF
  pdf_base64?:       string;
  pdf_url?:          string;
  pdf_text?:         string; // texto pré-extraído pelo browser (pdf.js)
  // Campos do sistema externo (modo json e resultado de extração PDF)
  client_name?:         string;
  client_cnpj?:         string;
  technician_email?:    string;
  technician_name?:     string;
  service_type?:        string;
  service_date?:        string;
  site_location?:       string;
  asset_name?:          string;
  priority?:            string;
  reported_problem?:    string;
  services_performed?:  string;
  final_diagnosis?:     string;
  parts_used?:          string;
  internal_notes?:      string;
  photos?:              Array<PhotoItem | string>;
}

interface ValidationError { field: string; message: string }

// ── Mapeamento de prioridade ──────────────────────────────────────────────────

const PRIORITY_MAP: Record<string, string> = {
  baixa: "baixa", low: "baixa", baja: "baixa",
  normal: "normal", medium: "normal", media: "normal",
  alta: "alta", high: "alta", alto: "alta",
  critica: "critica", critical: "critica", urgente: "critica", "crítica": "critica",
};

function mapPriority(raw?: string): string {
  if (!raw) return "normal";
  return PRIORITY_MAP[raw.toLowerCase().trim()] ?? "normal";
}

// ── Utilities ─────────────────────────────────────────────────────────────────

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function rfc7807(status: number, code: string, detail: string, instance: string): Response {
  const title = code.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return new Response(
    JSON.stringify({ type: `https://api.nextai.com.br/errors/${code}`, title, status, detail, instance }),
    { status, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } },
  );
}

// Sanitiza o payload antes de armazenar no log — remove PII sensível
function sanitizePayload(body: Record<string, unknown>): Record<string, unknown> {
  const { pdf_base64, pdf_text, photos, ...safe } = body;
  return {
    ...safe,
    ...(pdf_base64            ? { pdf_base64: "[redacted]" }                           : {}),
    ...(pdf_text              ? { pdf_text: "[redacted]" }                             : {}),
    ...(Array.isArray(photos) ? { photos_count: photos.length, photos: "[redacted]" } : {}),
  };
}

// ── Validação de entrada ──────────────────────────────────────────────────────

function validatePayload(body: unknown): { payload: OsImportPayload; errors: ValidationError[] } {
  const errors: ValidationError[] = [];
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return {
      payload: {} as OsImportPayload,
      errors:  [{ field: "body", message: "Must be a JSON object." }],
    };
  }
  const b = body as Record<string, unknown>;

  if (!b.mode || !["json", "pdf"].includes(b.mode as string))
    errors.push({ field: "mode", message: "Required. Must be 'json' or 'pdf'." });

  if (!b.external_source || !EXTERNAL_SOURCES.includes(b.external_source as ExternalSource))
    errors.push({ field: "external_source", message: `Required. Must be one of: ${EXTERNAL_SOURCES.join(", ")}.` });

  if (!b.external_ref_id || typeof b.external_ref_id !== "string" || !b.external_ref_id.trim())
    errors.push({ field: "external_ref_id", message: "Required. ID da OS no sistema de origem." });

  if (b.mode === "pdf" && !b.pdf_base64 && !b.pdf_url)
    errors.push({ field: "pdf_base64", message: "Required for mode='pdf'. Provide pdf_base64 (base64 string) or pdf_url (public URL)." });

  return { payload: b as unknown as OsImportPayload, errors };
}

// ── Resolução de entidades ────────────────────────────────────────────────────

type Admin = ReturnType<typeof createClient>;

async function resolveClient(
  admin: Admin,
  teamId: string,
  clientName?: string,
  clientCnpj?: string,
): Promise<{ id: string | null; resolution: string }> {
  // 1. CNPJ exato (normalizado, só dígitos)
  if (clientCnpj) {
    const cnpjDigits = clientCnpj.replace(/\D/g, "");
    if (cnpjDigits.length === 14) {
      const { data } = await admin.from("clients")
        .select("id").eq("team_id", teamId).eq("cnpj", cnpjDigits).maybeSingle();
      if (data) return { id: data.id, resolution: "matched_cnpj" };
    }
  }

  // 2. name ILIKE case-insensitive
  if (clientName) {
    const { data } = await admin.from("clients")
      .select("id").eq("team_id", teamId)
      .ilike("name", `%${clientName.trim()}%`)
      .limit(1).maybeSingle();
    if (data) return { id: data.id, resolution: "matched_name" };
  }

  // 3. Auto-criar cliente mínimo com name
  if (clientName) {
    const { data } = await admin.from("clients")
      .insert({ team_id: teamId, name: clientName.trim() })
      .select("id").single();
    if (data) return { id: data.id, resolution: "auto_created" };
  }

  return { id: null, resolution: "not_found" };
}

async function resolveTechnician(
  admin: Admin,
  teamId: string,
  techEmail?: string,
  techName?: string,
): Promise<{ id: string | null; resolution: string }> {
  // 1. Email exato
  if (techEmail) {
    const { data } = await admin.from("users")
      .select("id").eq("team_id", teamId)
      .eq("email", techEmail.toLowerCase().trim())
      .maybeSingle();
    if (data) return { id: data.id, resolution: "matched_email" };
  }

  // 2. full_name ILIKE
  if (techName) {
    const { data } = await admin.from("users")
      .select("id").eq("team_id", teamId)
      .ilike("full_name", `%${techName.trim()}%`)
      .limit(1).maybeSingle();
    if (data) return { id: data.id, resolution: "matched_name" };
  }

  // null → OS criada sem técnico, equipe atribui manualmente
  return { id: null, resolution: "not_found" };
}

async function mapServiceType(
  admin: Admin,
  teamId: string,
  rawServiceType?: string,
): Promise<string | null> {
  if (!rawServiceType) return null;
  const { data } = await admin.from("service_types")
    .select("name").eq("team_id", teamId)
    .ilike("name", `%${rawServiceType.trim()}%`)
    .limit(1).maybeSingle();
  // Se não houver match, usa a string raw — service_type aceita texto livre
  return data?.name ?? rawServiceType;
}

// Extração PDF migrada para ./document/pipeline.ts (template registry + IA híbrida)

// ── Persistência de fotos ─────────────────────────────────────────────────────

interface PhotoToPersist {
  bytes:    Uint8Array;
  mimeType: string;
  filename: string;
  caption:  string | null;
}

function b64ToBytes(b64: string): Uint8Array {
  const raw = b64.replace(/^data:[^;]+;base64,/, "");
  const binary = atob(raw);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// Baixa (URL) ou decodifica (base64) as fotos enviadas no payload
async function collectPayloadPhotos(
  photos: OsImportPayload["photos"],
): Promise<PhotoToPersist[]> {
  if (!photos || photos.length === 0) return [];
  const result: PhotoToPersist[] = [];

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    try {
      if (typeof photo === "string") {
        const res = await fetch(photo);
        if (!res.ok) continue;
        const mimeType = res.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
        const ext = mimeType.split("/")[1] ?? "jpg";
        result.push({
          bytes: new Uint8Array(await res.arrayBuffer()),
          mimeType,
          filename: `ext-${i + 1}.${ext}`,
          caption: null,
        });
      } else {
        const ext = (photo.mime_type.split("/")[1] ?? "jpg").replace(/;.*/, "");
        result.push({
          bytes: b64ToBytes(photo.base64),
          mimeType: photo.mime_type,
          filename: photo.filename ?? `ext-${i + 1}.${ext}`,
          caption: null,
        });
      }
    } catch {
      // Foto individual falhou — não bloqueia a importação da OS
    }
  }
  return result;
}

/**
 * Sobe cada foto para reports_media (caminho padrão do app) e registra em
 * report_attachments — sem a linha na tabela a foto não aparece na tela da OS.
 * uploadedBy é null em importações via X-API-Key (sem usuário autenticado).
 */
async function persistPhotos(
  admin: Admin,
  teamId: string,
  osId: string,
  uploadedBy: string | null,
  photos: PhotoToPersist[],
): Promise<number> {
  let persisted = 0;

  for (let i = 0; i < photos.length; i++) {
    const photo = photos[i];
    try {
      const ext = (photo.mimeType.split("/")[1] ?? "jpg").replace(/;.*/, "");
      const path = `${teamId}/reports/${osId}/attachments/imported-${i + 1}.${ext}`;
      const { error: upErr } = await admin.storage.from(STORAGE_BUCKET)
        .upload(path, photo.bytes, { contentType: photo.mimeType, upsert: true });
      if (upErr) continue;

      const { error: rowErr } = await admin.from("report_attachments").insert({
        report_id:   osId,
        uploaded_by: uploadedBy,
        url:         path,
        filename:    photo.filename,
        mime_type:   photo.mimeType,
        size_bytes:  photo.bytes.length,
        caption:     photo.caption,
      });
      if (!rowErr) persisted++;
    } catch {
      // Foto individual falhou — não bloqueia a importação da OS
    }
  }
  return persisted;
}

// ── Handler principal ─────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return rfc7807(405, "method_not_allowed", "Only POST is supported.", "/os-import-processor");
  }

  const instance = "/functions/v1/os-import-processor";

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });

  // 1. Autenticação: X-API-Key (integrações externas) ou Bearer JWT (UI interna) ─
  // X-API-Key → sha256 → api_keys (sistema legado TOTVS/SAP/etc.)
  // Bearer JWT → admin.auth.getUser → users.team_id (Admin/Master/Gestor logados)

  const rawKey     = req.headers.get("X-API-Key") ?? req.headers.get("x-api-key");
  const authHeader = req.headers.get("Authorization") ?? req.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let teamId: string;
  let apiKeyId: string | null = null;
  let callerUserId: string | null = null; // preenchido apenas no caminho Bearer JWT

  if (rawKey) {
    // ── X-API-Key path ────────────────────────────────────────────────────────
    const keyHash = await sha256hex(rawKey);
    const { data: apiKey } = await admin
      .from("api_keys")
      .select("id, team_id, scopes, is_active, expires_at")
      .eq("key_hash", keyHash)
      .maybeSingle();

    if (!apiKey)            return rfc7807(401, "invalid_api_key",  "API key not found.",       instance);
    if (!apiKey.is_active)  return rfc7807(401, "api_key_revoked",  "API key has been revoked.", instance);
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date())
      return rfc7807(401, "api_key_expired", "API key has expired.", instance);

    const scopes: string[] = apiKey.scopes ?? [];
    if (!scopes.includes("orders:write"))
      return rfc7807(403, "insufficient_scope", "Scope 'orders:write' required.", instance);

    teamId   = apiKey.team_id as string;
    apiKeyId = apiKey.id as string;

  } else if (bearerToken) {
    // ── Bearer JWT path (usuário da UI) ───────────────────────────────────────
    const { data: { user: authUser }, error: jwtErr } = await admin.auth.getUser(bearerToken);
    if (jwtErr || !authUser)
      return rfc7807(401, "invalid_token", "Token inválido ou expirado.", instance);

    const { data: profile } = await admin.from("users")
      .select("team_id, role")
      .eq("id", authUser.id)
      .maybeSingle();

    if (!profile?.team_id)
      return rfc7807(403, "profile_not_found", "Perfil de usuário não encontrado.", instance);
    if (!["Admin", "Master", "Gestor"].includes(profile.role as string))
      return rfc7807(403, "insufficient_role", "Requer perfil Admin, Master ou Gestor.", instance);

    teamId = profile.team_id as string;
    callerUserId = authUser.id;

  } else {
    return rfc7807(401, "missing_auth", "Forneça X-API-Key ou Authorization: Bearer.", instance);
  }

  // 2. Content-Type ─────────────────────────────────────────────────────────────
  const ct = req.headers.get("content-type") ?? "";
  if (!ct.includes("application/json"))
    return rfc7807(415, "unsupported_media_type", "Content-Type must be application/json.", instance);

  // 4. Idempotência ─────────────────────────────────────────────────────────────
  const idempKey = req.headers.get("Idempotency-Key");
  if (idempKey) {
    const { data: cached } = await admin
      .from("api_idempotency_keys")
      .select("status_code, response")
      .eq("key", idempKey)
      .eq("team_id", teamId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached) {
      return new Response(JSON.stringify(cached.response), {
        status: cached.status_code,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Idempotent-Replayed": "true" },
      });
    }
  }

  // 5. Parse + validação ────────────────────────────────────────────────────────
  let rawBody: unknown;
  try { rawBody = await req.json(); }
  catch { return rfc7807(400, "invalid_json", "Request body is not valid JSON.", instance); }

  const { payload, errors: valErrors } = validatePayload(rawBody);
  if (valErrors.length > 0) {
    return new Response(JSON.stringify({
      type: "https://api.nextai.com.br/errors/validation_error",
      title: "Validation Error", status: 400, errors: valErrors, instance,
    }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/problem+json" } });
  }

  // Criar entrada de log como 'pending' — será atualizada para success/failed/duplicate
  const { data: logEntry } = await admin.from("os_import_log").insert({
    team_id:         teamId,
    api_key_id:      apiKeyId,
    external_source: payload.external_source,
    external_ref_id: payload.external_ref_id,
    import_mode:     payload.mode,
    status:          "pending",
    raw_payload:     sanitizePayload(rawBody as Record<string, unknown>),
  }).select("id").single();
  const logId = logEntry?.id ?? null;

  // Helper: atualiza log para 'failed' e retorna 422 RFC 7807
  async function failLog(errorDetail: string): Promise<Response> {
    if (logId) {
      await admin.from("os_import_log")
        .update({ status: "failed", error_detail: errorDetail.slice(0, 1000) })
        .eq("id", logId);
    }
    return rfc7807(422, "import_failed", errorDetail, instance);
  }

  try {
    // 6. Verificação de deduplicação ────────────────────────────────────────────
    // Mesmo external_ref_id + external_source → retorna OS existente, status 200
    const { data: existing } = await admin.from("service_reports")
      .select("id, os_number")
      .eq("team_id", teamId)
      .eq("external_source", payload.external_source)
      .eq("external_ref_id", payload.external_ref_id)
      .maybeSingle();

    if (existing) {
      if (logId) {
        await admin.from("os_import_log").update({
          status: "duplicate",
          os_id:  existing.id,
        }).eq("id", logId);
      }
      const respBody = { data: {
        os_id:                 existing.id,
        os_number:             existing.os_number,
        client_resolution:     null,
        technician_resolution: null,
        duplicate:             true,
      }};
      if (idempKey) {
        await admin.from("api_idempotency_keys").upsert({
          key: idempKey, team_id: teamId, method: "POST",
          path: "/os-import-processor", status_code: 200, response: respBody,
        });
      }
      return new Response(JSON.stringify(respBody), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 7. Normalização — modo PDF usa pipeline de extração documental ────────────
    let normalized: Partial<OsImportPayload> = { ...payload };
    let extractionResult: ExtractionResult | null = null;
    let pdfBase64: string | undefined; // mantido para extração de fotos no passo 11

    if (payload.mode === "pdf") {
      pdfBase64 = payload.pdf_base64;
      if (!pdfBase64 && payload.pdf_url) {
        const res = await fetch(payload.pdf_url);
        if (!res.ok) return await failLog(`Não foi possível baixar o PDF: HTTP ${res.status}`);
        const buf = await res.arrayBuffer();
        const bytes = new Uint8Array(buf);
        let binary = "";
        const CHUNK = 8192;
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        pdfBase64 = btoa(binary);
      }
      if (!pdfBase64) return await failLog("pdf_base64 ou pdf_url obrigatório no modo pdf.");

      // Pipeline: template registry (zero custo) → IA híbrida (Gemini → OpenAI)
      extractionResult = await processDocument(
        pdfBase64,
        {
          GEMINI_API_KEY_1: Deno.env.get("GEMINI_API_KEY_1"),
          GEMINI_API_KEY_2: Deno.env.get("GEMINI_API_KEY_2"),
          OPENAI_API_KEY:   Deno.env.get("OPENAI_API_KEY"),
        },
        payload.pdf_text,
      );

      const extractedFields: Partial<OsImportPayload> = {};
      for (const [key, ef] of Object.entries(extractionResult.fields)) {
        if (ef.value !== null) {
          (extractedFields as Record<string, unknown>)[key] = ef.value;
        }
      }
      // Campos explícitos do payload sobrepõem os extraídos (permite override manual)
      normalized = { ...extractedFields, ...payload };
    }

    // 8. Resolução de entidades (IDs NextAI a partir de dados externos) ──────────
    const { id: clientId, resolution: clientRes } = await resolveClient(
      admin, teamId, normalized.client_name, normalized.client_cnpj
    );
    const { id: techId, resolution: techRes } = await resolveTechnician(
      admin, teamId, normalized.technician_email, normalized.technician_name
    );
    const serviceType = await mapServiceType(admin, teamId, normalized.service_type);
    const priority    = mapPriority(normalized.priority);

    // 9. Reservar número de OS (RPC sem auth.uid) ────────────────────────────────
    const { data: osNumber, error: osNumErr } = await admin.rpc(
      "reserve_os_number_service",
      { p_team_id: teamId }
    );
    if (osNumErr || !osNumber)
      return await failLog(`Erro ao reservar número de OS: ${osNumErr?.message ?? "resultado vazio"}`);

    // 10. INSERT service_reports — whitelist explícita, nunca spread do body ──────
    // Campos protegidos (id, team_id, os_number, created_at, search_vector) não
    // vêm do payload do cliente — são injetados aqui com valores confiáveis.
    const serviceDate = normalized.service_date ?? new Date().toISOString().split("T")[0];

    const srInsert: Record<string, unknown> = {
      team_id:         teamId,
      os_number:       osNumber as string,
      status:          "pending_review",
      external_source: payload.external_source,
      external_ref_id: payload.external_ref_id,
      service_date:    serviceDate,
      priority,
    };
    if (clientId)                      srInsert.client_id          = clientId;
    if (techId)                        srInsert.technician_id       = techId;
    if (serviceType)                   srInsert.service_type        = serviceType;
    if (normalized.site_location)      srInsert.site_location       = normalized.site_location;
    if (normalized.asset_name)         srInsert.asset_name_manual   = normalized.asset_name;
    if (normalized.reported_problem)   srInsert.reported_problem    = normalized.reported_problem;
    if (normalized.services_performed) srInsert.services_performed  = normalized.services_performed;
    if (normalized.final_diagnosis)    srInsert.final_diagnosis     = normalized.final_diagnosis;
    if (normalized.parts_used)         srInsert.parts_used          = normalized.parts_used;
    if (normalized.internal_notes)     srInsert.internal_notes      = normalized.internal_notes;

    // Metadados de confiança de importação (somente modo PDF)
    if (extractionResult) {
      srInsert.import_confidence        = extractionResult.overall_confidence;
      srInsert.import_field_confidences = extractionResult.fields;
    }

    const { data: sr, error: srErr } = await admin.from("service_reports")
      .insert(srInsert)
      .select("id, os_number")
      .single();

    if (srErr || !sr) return await failLog(`Erro ao criar OS no banco: ${srErr?.message ?? "resultado vazio"}`);

    // 11. Fotos: payload + embutidas no PDF (best-effort — falha não bloqueia) ───
    const photosToPersist = await collectPayloadPhotos(normalized.photos);
    let photosFromPdf = 0;

    if (pdfBase64) {
      try {
        const { images, skipped } = extractJpegImagesFromPdf(b64ToBytes(pdfBase64));
        if (skipped > 0) console.log(`[photos] ${skipped} imagens do PDF descartadas por filtro (logo/thumbnail/duplicada)`);
        photosFromPdf = images.length;
        for (let i = 0; i < images.length; i++) {
          photosToPersist.push({
            bytes:    images[i].bytes,
            mimeType: "image/jpeg",
            filename: `pdf-foto-${i + 1}.jpg`,
            caption:  "Importada do PDF de origem",
          });
        }
      } catch (err) {
        console.warn("[photos] extração de imagens do PDF falhou:", err);
      }
    }

    const photosUploaded = await persistPhotos(admin, teamId, sr.id, callerUserId, photosToPersist);

    // 12. Atualizar log para 'success' com metadados de extração ─────────────────
    if (logId) {
      const logUpdate: Record<string, unknown> = {
        status:                "success",
        os_id:                 sr.id,
        client_resolution:     clientRes,
        technician_resolution: techRes,
      };
      if (extractionResult) {
        logUpdate.extraction_method  = extractionResult.method;
        logUpdate.overall_confidence = extractionResult.overall_confidence;
        logUpdate.field_confidences  = extractionResult.fields;
      }
      await admin.from("os_import_log").update(logUpdate).eq("id", logId);
    }

    // 13. Resposta e cache de idempotência ───────────────────────────────────────
    const respBody: Record<string, unknown> = { data: {
      os_id:                 sr.id,
      os_number:             sr.os_number,
      client_resolution:     clientRes,
      technician_resolution: techRes,
      duplicate:             false,
      photos_uploaded:       photosUploaded,
      photos_from_pdf:       photosFromPdf,
      ...(extractionResult ? {
        extraction_method:  extractionResult.method,
        overall_confidence: extractionResult.overall_confidence,
        requires_review:    extractionResult.requires_review,
        template_id:        extractionResult.template_id,
      } : {}),
    }};

    if (idempKey) {
      await admin.from("api_idempotency_keys").upsert({
        key: idempKey, team_id: teamId, method: "POST",
        path: "/os-import-processor", status_code: 201, response: respBody,
      }).catch(console.error);
    }

    return new Response(JSON.stringify(respBody), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[os-import-processor] unhandled error:", msg);
    if (msg.includes("GEMINI_429")) {
      if (logId) {
        await admin.from("os_import_log")
          .update({ status: "failed", error_detail: msg.slice(0, 1000) })
          .eq("id", logId);
      }
      return rfc7807(
        503,
        "ai_service_unavailable",
        'Serviço de extração por IA temporariamente indisponível (cota excedida). Tente novamente em alguns minutos ou use a aba "Campos" para importar manualmente.',
        instance,
      );
    }
    return await failLog(msg.slice(0, 500));
  }
});
