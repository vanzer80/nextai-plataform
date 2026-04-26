import { supabase } from '@/src/lib/supabase';

export interface ReceiptExtractionResult {
  expenseType: 'Combustível' | 'Alimentação' | 'Hospedagem' | 'Estacionamento' | 'Material' | 'Outros';
  amount: number;
  favorecido: string;
  pix: string;
  description: string;
  expense_date: string;
}

export interface MaterialExtractionResult {
  especificacao_tecnica: string;
  quantidade: string;
  obs: string;
}

export interface ImageInput {
  base64: string;
  mimeType: string;
}

export interface DiagnosticEnhancementResult {
  final_diagnosis: string;
  technical_description: string;
  possible_causes: string[];
  recommendation: string;
}

// Toda a lógica de IA roda server-side na Edge Function ai-proxy.
// Fallback Gemini key1 → key2 → OpenAI acontece no servidor.
// Nenhuma chave de API é exposta no bundle JS.

async function callProxy(type: string, params: object): Promise<unknown> {
  const { data, error } = await supabase.functions.invoke('ai-proxy', {
    body: { type, ...params },
  });
  if (error) throw error;
  if (!data) throw new Error('Resposta vazia do servidor AI');
  return data;
}

function normalizeReceipt(raw: any): ReceiptExtractionResult {
  const amount = typeof raw.amount === 'number'
    ? raw.amount
    : parseFloat(String(raw.amount ?? '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
  return {
    expenseType: raw.expenseType ?? 'Outros',
    amount,
    favorecido: String(raw.favorecido ?? ''),
    pix: String(raw.pix ?? ''),
    description: String(raw.description ?? ''),
    expense_date: String(raw.expense_date ?? ''),
  };
}

function normalizeMaterial(raw: any): MaterialExtractionResult {
  return {
    especificacao_tecnica: String(raw.especificacao_tecnica ?? ''),
    quantidade: String(raw.quantidade ?? ''),
    obs: String(raw.obs ?? ''),
  };
}

function normalizeDiagnostic(raw: any): DiagnosticEnhancementResult {
  return {
    final_diagnosis:       String(raw.final_diagnosis ?? ''),
    technical_description: String(raw.technical_description ?? ''),
    possible_causes:       Array.isArray(raw.possible_causes) ? raw.possible_causes.map(String) : [],
    recommendation:        String(raw.recommendation ?? ''),
  };
}

export async function extractReceiptFromImages(images: ImageInput[]): Promise<ReceiptExtractionResult> {
  return normalizeReceipt(await callProxy('receipt_images', { images }));
}

export async function extractMaterialFromImages(images: ImageInput[]): Promise<MaterialExtractionResult> {
  return normalizeMaterial(await callProxy('material_images', { images }));
}

export async function extractReceiptFromVoice(transcript: string): Promise<ReceiptExtractionResult> {
  return normalizeReceipt(await callProxy('receipt_voice', { transcript }));
}

export async function extractMaterialFromVoice(transcript: string): Promise<MaterialExtractionResult> {
  return normalizeMaterial(await callProxy('material_voice', { transcript }));
}

export async function enhanceDiagnostic(
  rawInput: string,
  context: { serviceType: string; assetDescription?: string; reportedProblem?: string },
): Promise<DiagnosticEnhancementResult> {
  return normalizeDiagnostic(await callProxy('diagnostic', { rawInput, context }));
}
