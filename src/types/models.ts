/**
 * @deprecated Este arquivo está sendo descontinuado.
 * Use src/types/reports.ts para ServiceReport e tipos relacionados.
 * Última auditoria: 2026-04-25 | Remover após migrar todos os imports.
 */
import type { UserRole } from '@/src/contexts/AuthContext';

export interface Client {
  id: string;
  name: string;
}

export interface Reimbursement {
  id: string;
  created_at: string;
  category: string;
  amount: number;
  status: 'Pendente' | 'Aprovado' | 'Rejeitado' | 'Revisao';
  receipt_url: string | null;
  user_id: string;
  description: string | null;
  maintenance_type: string | null;
  client_id: string | null;
  branch: string | null;
  budget: string | null;
  favorecido: string | null;
  pix_key: string | null;
  rejection_reason: string | null;
  revision_reason: string | null;
  clients?: { name: string } | null;
  users?: { full_name: string } | null;
}

export interface MaterialRequest {
  id: string;
  created_at: string;
  updated_at: string;
  request_number: string;
  tech_id: string;
  comprador_id: string | null;
  cidade: string;
  client_id: string | null;
  loja: string | null;
  maintenance_type: string;
  prazo: string;
  especificacao_tecnica: string;
  quantidade: string;
  link_referencia: string | null;
  obs: string | null;
  foto_url: string | null;
  status: 'Pendente' | 'Em Análise' | 'Comprado' | 'Entregue' | 'Cancelado';
  urgency: 'Alta' | 'Média' | 'Baixa' | null;
  comprador_response: string | null;
  users?: { full_name: string } | null;
  clients?: { name: string } | null;
}

export interface Notification {
  id: string;
  created_at: string;
  user_id: string;
  title: string;
  message: string;
  is_read: boolean;
  type: string | null;
}

export interface ServiceReport {
  id: string;
  created_at: string;
  tech_id: string;
  client_id: string;
  equipment_id: string | null;
  description: string;
  status: 'draft' | 'pending_review' | 'returned' | 'approved' | 'rejected';
  photo_url: string | null;
}

export interface AppUser {
  id: string;
  full_name: string;
  role: UserRole;
  team_id: string | null;
  setup_pending: boolean;
}
