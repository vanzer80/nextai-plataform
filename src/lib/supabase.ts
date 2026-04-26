import { createClient } from '@supabase/supabase-js';

// 1. Diagnóstico e exportação de variáveis para UI de emergência
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

let safeUrl = supabaseUrl;
let safeKey = supabaseAnonKey;

// 2. Refatoração do Cliente Supabase: Evita crash do módulo se URL for undef/inválida
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('CRÍTICO: VITE_SUPABASE_URL ou VITE_SUPABASE_ANON_KEY estão vazias no .env!');
  safeUrl = 'https://erro-env-faltando.supabase.co';
  safeKey = 'dummy-key-para-nao-travar-react';
}

let client;
const options = {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  }
};

try {
  client = createClient(safeUrl, safeKey, options);
} catch (error) {
  console.error('Falha ao inicializar o cliente Supabase. Verifique a URL do projeto.', error);
  console.error('Falha ao inicializar o cliente Supabase. Verifique a URL do projeto.');
  client = createClient('https://erro-env-faltando.supabase.co', 'dummy-key-para-nao-travar-react', options);
}

export const supabase = client;
