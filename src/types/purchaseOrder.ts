export type POStatus = 'rascunho' | 'emitido' | 'recebido' | 'cancelado';

export interface PurchaseOrderItem {
  id: string;
  po_id: string;
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
  total_price: number;
}

export interface PurchaseOrder {
  id: string;
  team_id?: string;
  po_number: string;
  request_id: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  status: POStatus;
  total_value: number | null;
  notes: string | null;
  issued_at: string | null;
  received_at: string | null;
  issued_by: string | null;
  received_by: string | null;
  created_at: string;
  items?: PurchaseOrderItem[];
  suppliers?: { name: string; contato_email: string | null } | null;
  issued_by_user?: { full_name: string } | null;
}

export const PO_STATUS_LABEL: Record<POStatus, string> = {
  rascunho: 'Rascunho',
  emitido:  'Emitido',
  recebido: 'Recebido',
  cancelado: 'Cancelado',
};

export const PO_STATUS_COLOR: Record<POStatus, string> = {
  rascunho:  'bg-slate-100 text-slate-700',
  emitido:   'bg-blue-100 text-blue-700',
  recebido:  'bg-emerald-100 text-emerald-700',
  cancelado: 'bg-rose-100 text-rose-700',
};

export interface GeneratePOInput {
  description: string;
  qty: number;
  unit: string;
  unit_price: number;
}
