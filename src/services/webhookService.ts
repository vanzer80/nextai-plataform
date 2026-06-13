import { supabase } from '@/src/lib/supabase';

// Os callers inspecionam { data, error } inline (toast no erro), então as
// funções retornam o resultado BRUTO do supabase — sem throw (lift verbatim).

export function getWebhookEndpoints() {
  return supabase.rpc('get_webhook_endpoints');
}

export function getWebhookDeliveries(endpointId: string, limit = 20) {
  return supabase.rpc('get_webhook_deliveries', { p_endpoint_id: endpointId, p_limit: limit });
}

export function createWebhookEndpoint(url: string, events: string[], description: string | null) {
  return supabase.rpc('create_webhook_endpoint', {
    p_url: url,
    p_events: events,
    p_description: description,
  });
}

export function updateWebhookEndpoint(id: string, isActive: boolean) {
  return supabase.rpc('update_webhook_endpoint', { p_id: id, p_is_active: isActive });
}

export function deleteWebhookEndpoint(id: string) {
  return supabase.rpc('delete_webhook_endpoint', { p_id: id });
}

export function dispatchWebhooks() {
  return supabase.functions.invoke('webhook-dispatcher', { body: {} });
}
