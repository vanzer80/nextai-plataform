# ADR-008 — OCR Provider: GPT-4o vs Google Document AI

**Status:** Proposed  
**Date:** 2026-05-24  
**Sprint:** E

## Context

We need to extract structured data (amount, merchant, date) from receipt photos uploaded by technicians.

## Decision

**OpenAI GPT-4o Vision** via Supabase Edge Function. Reasons: superior accuracy for varied receipt formats (including handwritten Brazilian receipts), structured JSON output via function calling, and cost-effective at current scale.

Estimated cost: ~US$0.003 per extraction (1 image + prompt ≈ 1,000 tokens input + 100 output at GPT-4o pricing).

## Prompt Strategy

```
You are a receipt data extractor for Brazilian expense management.
Extract the following from the receipt image and return as JSON:
{
  "amount": number or null (in BRL, no currency symbol),
  "description": string or null (merchant name),
  "expense_date": "YYYY-MM-DD" or null,
  "category_hint": string or null (one of: alimentação, transporte, hospedagem, combustível, material, outros),
  "confidence": number between 0 and 1
}
Return only the JSON object, no explanation.
```

## Alternatives Considered

1. **Google Document AI** — Higher accuracy for structured documents (invoices). More complex setup (service account, regional endpoints). Better for formal invoices; GPT-4o better for informal receipts. Rejected for v1 simplicity.
2. **AWS Textract** — Good accuracy, pay-per-use. Requires AWS account and SDK. Rejected to avoid multi-cloud dependency.
3. **Tesseract.js (client-side)** — Zero API cost. Poor accuracy for Portuguese receipts, no semantic understanding. Rejected.
4. **Manual only (no OCR)** — Current state. Rejected as it is the gap we are closing.

## Consequences

- Requires `OPENAI_API_KEY` secret in Supabase Edge Function environment.
- Add rate limiting in Edge Function (max 10 calls/minute per tenant) to prevent cost abuse.
- OCR is always a suggestion — user must confirm before saving. Never auto-save OCR output.
- Fallback: if OCR fails or confidence < 0.6, return null values silently. User fills manually.
- Monitor cost via OpenAI usage dashboard. Set a per-tenant monthly cap alert.
