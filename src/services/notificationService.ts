import { supabase } from '@/src/lib/supabase';

// Registro de push subscription (Web Push). O caller envolve em try/catch e ignora o resultado.
export function upsertPushSubscription(params: {
  userId: string;
  subscription: PushSubscriptionJSON;
  userAgent: string;
}) {
  const { userId, subscription, userAgent } = params;
  return supabase.from('push_subscriptions').upsert(
    { user_id: userId, subscription, user_agent: userAgent },
    { onConflict: 'user_id,user_agent' },
  );
}

// Notificações recentes do usuário (posse de linha por user_id, não tenant). Caller usa `if (data) ...`.
export async function fetchUserNotifications(userId: string): Promise<Record<string, unknown>[] | null> {
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);
  return data as Record<string, unknown>[] | null;
}

// Realtime de notificações do usuário. Retorna a função de cleanup (padrão dos demais services).
// IMPORTANTE: chamar ANTES do fetch inicial — captura inserts que cheguem durante o fetch.
export function subscribeUserNotifications(
  userId: string,
  handlers: {
    onInsert: (row: Record<string, unknown>) => void;
    onUpdate: (row: Record<string, unknown>) => void;
  },
): () => void {
  const channel = supabase.channel('realtime_app_notifications')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
      handlers.onInsert(payload.new);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (payload) => {
      handlers.onUpdate(payload.new);
    })
    .subscribe();
  return () => { supabase.removeChannel(channel); };
}

// Marca uma notificação como lida. O caller faz o early-return `if (is_read) return` e ignora o resultado.
export function markNotificationRead(id: string) {
  return supabase.from('notifications').update({ is_read: true }).eq('id', id);
}

// ── Fila local de "marcar como lida" (resiliência offline) ────────────────────
// Em localStorage: ids cujo update falhou (offline/erro). Reenviados ao reconectar.

const READ_QUEUE_KEY = 'nextai-notif-read-queue';

function readQueue(): string[] {
  try {
    const raw = localStorage.getItem(READ_QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeQueue(ids: string[]): void {
  try {
    localStorage.setItem(READ_QUEUE_KEY, JSON.stringify(ids));
  } catch {
    /* storage indisponível — best-effort */
  }
}

function enqueueRead(id: string): void {
  const q = readQueue();
  if (!q.includes(id)) writeQueue([...q, id]);
}

// Marca como lida com resiliência: em falha (offline/erro), enfileira para o próximo
// sync. Nunca lança — a UI já atualizou de forma otimista.
export async function markNotificationReadResilient(id: string): Promise<void> {
  try {
    const { error } = await markNotificationRead(id);
    if (error) enqueueRead(id);
  } catch {
    enqueueRead(id);
  }
}

// Reenvia as marcações pendentes (chamar no mount e ao reconectar). Best-effort.
export async function flushNotificationReadQueue(): Promise<void> {
  const q = readQueue();
  if (q.length === 0) return;
  const remaining: string[] = [];
  for (const id of q) {
    try {
      const { error } = await markNotificationRead(id);
      if (error) remaining.push(id);
    } catch {
      remaining.push(id);
    }
  }
  writeQueue(remaining);
}
