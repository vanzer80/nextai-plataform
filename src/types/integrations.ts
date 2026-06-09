export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  scopes: string[];
  is_active: boolean;
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WebhookDelivery {
  id: string;
  event_type: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'dead';
  attempts: number;
  last_error: string | null;
  delivered_at: string | null;
  created_at: string;
}

export interface ApiUsageStats {
  total_requests: number;
  success_requests: number;
  error_requests: number;
  avg_duration_ms: number;
}

export const API_SCOPES = [
  { value: 'orders:read',         label: 'OS — Leitura',          group: 'Ordens de Serviço' },
  { value: 'orders:write',        label: 'OS — Escrita',          group: 'Ordens de Serviço' },
  { value: 'reimbursements:read', label: 'Reembolsos — Leitura',  group: 'Financeiro'         },
  { value: 'clients:read',        label: 'Clientes — Leitura',    group: 'Comercial'          },
  { value: 'clients:write',       label: 'Clientes — Escrita',    group: 'Comercial'          },
  { value: 'quotes:read',         label: 'Orçamentos — Leitura',  group: 'Comercial'          },
  { value: 'webhooks:write',      label: 'Webhooks',              group: 'Integração'         },
] as const;

export const WEBHOOK_EVENTS = [
  { value: 'order.created',          label: 'OS criada',             group: 'Ordens de Serviço' },
  { value: 'order.updated',          label: 'OS atualizada',         group: 'Ordens de Serviço' },
  { value: 'order.completed',        label: 'OS concluída',          group: 'Ordens de Serviço' },
  { value: 'reimbursement.approved', label: 'Reembolso aprovado',    group: 'Financeiro'         },
  { value: 'reimbursement.paid',     label: 'Reembolso pago',        group: 'Financeiro'         },
  { value: 'quote.signed',           label: 'Orçamento assinado',    group: 'Comercial'          },
  { value: 'payable.paid',           label: 'Conta a pagar quitada', group: 'Financeiro'         },
] as const;
