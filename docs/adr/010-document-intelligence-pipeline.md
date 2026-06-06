# ADR-010 — Document Intelligence Pipeline: Template Registry + Hybrid AI

**Status:** Accepted  
**Date:** 2026-06-06  
**Authors:** Engineering  
**Supersedes:** —  
**Related:** ADR-009 (Public API), ADR-008 (OCR Provider), OS Import Bridge (CLAUDE.md)

---

## Context

`os-import-processor` v1 handled PDF import exclusively via Gemini 2.0 Flash (multimodal PDF bytes).
This worked but had three problems:

1. **Cost**: every PDF → Gemini call, even for well-known structured templates (Decathlon Chamado).
2. **Opacity**: no per-field confidence — the UI had no way to signal uncertain extractions to the reviewer.
3. **Fragility**: when Gemini quota was exhausted (429), the entire import pipeline returned 422 with a
   cryptic error. OpenAI was available but unused.

The goal of v7 is to build an extraction pipeline that can compete with SAP IDP in terms of accuracy
and confidence reporting, while keeping costs near-zero for known document templates.

---

## Decisions

### Decision 1: Template Registry first, AI as fallback

Introduce a `PdfParser[]` registry. Each parser has `detect(text) → bool` and `parse(text) → fields`.
Before calling any AI, run the registry. If a parser fires with high confidence, skip AI entirely.

**Rationale:**
- Known templates (Decathlon Chamado) have deterministic structure. Regex is 100% accurate and free.
- AI adds cost and latency. Use it only where it adds value (unknown templates, scanned PDFs, low-confidence fields).
- New parsers require zero changes to the pipeline — add to the array, done.

**Fingerprint strategy for Decathlon Chamado:**
```typescript
detect(text): boolean {
  return /Chamado\s+N[º°o]?\s*\d+/i.test(text) &&
         /Detalhes\s+do\s+Chamado/i.test(text);
}
```
Both markers must be present to avoid false positives.

---

### Decision 2: Per-field confidence scores on every extracted field

Every field carries `{ value, confidence: 0.0–1.0, source: "template" | "ai" }`.

**Rationale:**
- SAP IDP sells per-field confidence as a differentiator. We need this for enterprise credibility.
- Allows the pipeline to make intelligent decisions: "reinforce with AI if confidence < 0.70".
- Allows the UI to highlight uncertain fields without requiring a new OS status.
- Template-extracted fields start with calibrated confidence (0.80–0.98 based on regex specificity).
  AI-extracted fields start at 0.78 (empirical floor for Gemini 2.0 Flash on structured docs).

**Confidence calibration (template):**

| Field | Confidence | Reason |
|-------|-----------|--------|
| `external_ref_id` | 0.98 | Deterministic regex on unique marker |
| `service_date` | 0.97 | DD/MM/YYYY format with labeled anchor |
| `client_name` | 0.92 | Pattern reliable but LTDA/SA suffix detection |
| `reported_problem` | 0.90 | Block extraction between known markers |
| `service_type` | 0.88 | Line after labeled anchor |
| `services_performed` | 0.88 | Same block extraction pattern |
| `technician_name` | 0.85 | Two-column interleaving — group 2 heuristic |
| `final_diagnosis` | 0.85 | Single line after labeled anchor |
| `site_location` | 0.80 | Optional field, anchor weaker |
| `priority` | 0.82 | Value mapping applied, anchor present |

---

### Decision 3: Weighted overall confidence

Overall confidence is a weighted average of field confidences. Required fields (like `reported_problem`
and `external_ref_id`) have higher weights than optional fields (like `parts_used`).

```typescript
const FIELD_WEIGHTS = {
  external_ref_id: 1.5, reported_problem: 1.5,
  client_name: 1.2,     service_date: 1.2,
  technician_name: 1.0, service_type: 1.0,
  ...
};
// overall = Σ(confidence_i × weight_i) / Σ(weight_i)
```

`requires_review = overall_confidence < 0.70`

**Consequence:** A document where `reported_problem` is empty will have a much lower overall score
than a document missing only `parts_used`. This correctly prioritizes the fields that matter.

---

### Decision 4: Hybrid mode — template + AI enhancement

When a template parser fires but some fields have low confidence (< 0.70) or are in `ALWAYS_AI_ENHANCE`
(`reported_problem`, `services_performed`, `final_diagnosis`), the pipeline runs AI anyway and merges
results field-by-field: the field with **higher confidence wins**.

```
ExtractionResult.method = "hybrid"
```

**Rationale:**
- `reported_problem` and `services_performed` are narrative blocks. Even when extracted correctly by
  regex, AI can improve formatting and completeness without replacing the extraction.
- `mergeFields(template, ai)` — template wins on structural fields; AI fills gaps.

---

### Decision 5: AI provider chain — Gemini → OpenAI

```
Gemini key 1 → (429?) → Gemini key 2 → (429?) → OpenAI gpt-4o-mini → null (partial result)
```

**OpenAI uses extracted text, not raw PDF bytes:**
OpenAI Chat Completions does not support inline PDF. Solution: send the extracted text as a user
message. This is actually better than multimodal: `gpt-4o-mini` is faster and cheaper than `gpt-4o`
for structured JSON extraction from clean text.

**GEMINI_429 propagation:**
If all keys are exhausted, the pipeline throws `Error("GEMINI_429: ...")`.  
The `index.ts` catch block intercepts this and returns HTTP 503 with a user-friendly Portuguese message
instead of the cryptic 422 from v1.

---

### Decision 6: No new OS status — use nullable confidence columns

Rather than adding a `needs_review` status to the `report_status` enum (which would require migrations
and changes to every status-aware component), store confidence data in nullable columns:

```sql
-- service_reports
import_confidence        NUMERIC(4,3)   -- NULL for non-PDF imports
import_field_confidences JSONB          -- snapshot of field scores at import time

-- os_import_log
extraction_method        TEXT           -- "template" | "ai:gemini" | "ai:openai" | "hybrid"
overall_confidence       NUMERIC(4,3)
field_confidences        JSONB
```

The UI renders a `ImportConfidenceBadge` (green/amber/red) next to the status badge in `ReportDetail.tsx`.
No workflow change: the OS still enters `pending_review` and follows the normal approval flow.
The badge is a signal to the reviewer, not a new state machine.

**Consequence:** Simpler schema, zero risk to existing workflow. Downside: no queryable `WHERE needs_review = true`.
Workaround: `WHERE import_confidence < 0.70 AND import_confidence IS NOT NULL`.

---

### Decision 7: Client-side text extraction (pdfjs-dist)

Browser sends `pdf_text` alongside `pdf_base64`. The server uses it as the preferred text source
(avoids running `unpdf` server-side, which is slower).

```typescript
// ImportOsDialog.tsx — parallel extraction
const [pdfBase64, pdfText] = await Promise.all([
  fileToBase64(pdfFile),
  extractTextFromPdf(pdfFile),   // pdfjs-dist, CDN worker
]);
```

If `pdf_text` is empty (scanned PDF, extraction failure), the server falls back to:
1. `npm:unpdf@0.11.0` server-side
2. If that also fails → empty string → Gemini gets raw PDF bytes (multimodal path)

**Three-tier text extraction:** browser pdfjs → server unpdf → Gemini multimodal.

---

## File Structure

```
supabase/functions/os-import-processor/
  index.ts                          # Handler v7 — orchestrates pipeline
  types.ts                          # FieldExtraction, ExtractionResult, PdfParser
  document/
    pipeline.ts                     # Main orchestrator: text → template → AI → confidence
    text-extractor.ts               # Server-side: npm:unpdf (Deno-compatible)
    template-registry.ts            # PdfParser[] registry — add new parsers here
    confidence.ts                   # Weighted scoring, mergeFields, needsReview
    ai-provider-chain.ts            # Gemini key1 → key2 → OpenAI chain
    parsers/
      decathlon-chamado.ts          # Regex parser for Decathlon "Chamado" PDF format

src/
  lib/pdf-text-extractor.ts         # Browser-side pdfjs-dist wrapper
  components/reports/
    ImportOsDialog.tsx              # + pdf_text extraction in parallel
    ImportConfidenceBadge.tsx       # Green/amber/red confidence badge
  pages/reports/
    ReportDetail.tsx                # + ImportConfidenceBadge when import_confidence != null
  types/reports.ts                  # + import_confidence, import_field_confidences fields
```

---

## Adding a New Document Template Parser

1. Create `supabase/functions/os-import-processor/document/parsers/<client>-<format>.ts`
2. Export a `PdfParser` object with `id`, `detect(text)`, `parse(text)`
3. Import it in `document/template-registry.ts` and push to `REGISTRY`
4. No other changes needed — the pipeline picks it up automatically

**Parser fingerprint rules:**
- Use **two independent markers** in `detect()` to avoid false positives
- Calibrate confidence values based on how deterministic each regex is (see table in Decision 2)
- Use `extractBetween(text, startMarker, endMarker)` for narrative block fields
- Handle two-column PDF interleaving: labels and values appear on alternating lines

---

## Consequences

**Positive:**
- Zero AI cost for known Decathlon PDFs (template extracts with ~0.92 overall confidence)
- Per-field confidence enables intelligent UI signaling without workflow changes
- OpenAI fallback means Gemini quota exhaustion no longer blocks PDF import
- Extensible: adding a new client template takes ~1h, no changes to core pipeline

**Negative / Known Gaps:**
- `pdfjs-dist` adds ~2MB to the client bundle (tree-shaken, lazy-loaded on PDF tab open)
- Template confidence calibrations are empirical — may need tuning as new PDF variants appear
- AI fields start at 0.78 confidence floor regardless of actual quality — no per-response quality scoring from Gemini yet
- CDN worker for pdfjs (`cdn.jsdelivr.net`) is a dependency not under our control

**Future improvements:**
- Per-response quality scoring from Gemini (use `candidate.finishReason` and `safetyRatings`)
- Confidence learning: update calibrations based on which fields users actually edit after import
- Batch import: accept ZIP of PDFs, process in background, notify via webhook
