export interface Supplier {
  id: string;
  team_id?: string;
  name: string;
  cnpj: string | null;
  contato_nome: string | null;
  contato_telefone: string | null;
  contato_email: string | null;
  logradouro: string | null;
  cidade: string | null;
  estado: string | null;
  avg_delivery_days: number | null;
  rating: number | null;
  status: 'ativo' | 'inativo';
  notes: string | null;
  created_at: string;
}

export type CreateSupplierDTO = Omit<Supplier, 'id' | 'team_id' | 'created_at'>;
export type UpdateSupplierDTO = Partial<CreateSupplierDTO>;

export interface SupplierStats {
  total_orders: number;
  total_spent: number | null;
  last_purchase_at: string | null;
}
