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
  marca: string;
  modelo: string;
  codigo_referencia: string;
  tensao: string;
  capacidade: string;
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
  const toStr = (v: unknown): string => {
    if (!v && v !== 0) return '';
    if (typeof v === 'object') {
      // Gemini às vezes retorna objeto apesar do schema STRING — extrair primeiro valor string encontrado
      const obj = v as Record<string, unknown>;
      const firstStr = Object.values(obj).find(x => typeof x === 'string' && x);
      return firstStr ? String(firstStr) : '';
    }
    return String(v);
  };
  return {
    especificacao_tecnica: toStr(raw.especificacao_tecnica),
    marca: toStr(raw.marca),
    modelo: toStr(raw.modelo),
    codigo_referencia: toStr(raw.codigo_referencia),
    tensao: toStr(raw.tensao),
    capacidade: toStr(raw.capacidade),
    quantidade: toStr(raw.quantidade),
    obs: toStr(raw.obs),
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

export interface ExecutionEnhancementResult {
  services_performed: string;
  technical_recommendation: string;
  pending_issues: string;
}

function normalizeExecution(raw: any): ExecutionEnhancementResult {
  return {
    services_performed:       String(raw.services_performed ?? ''),
    technical_recommendation: String(raw.technical_recommendation ?? ''),
    pending_issues:           String(raw.pending_issues ?? ''),
  };
}

export async function enhanceExecution(
  rawInput: string,
  context: { serviceType: string; reportedProblem?: string; finalDiagnosis?: string; partsUsed?: string },
): Promise<ExecutionEnhancementResult> {
  return normalizeExecution(await callProxy('execution', { rawInput, context }));
}
