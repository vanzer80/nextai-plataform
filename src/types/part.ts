export interface Part {
  id: string;
  team_id?: string;
  code: string | null;
  name: string;
  unit: string;
  unit_cost: number;
  stock_qty: number;
  min_stock_qty: number;
  supplier_id: string | null;
  location: string | null;
  created_at: string;
  suppliers?: { name: string } | null;
}

export type CreatePartDTO = Omit<Part, 'id' | 'team_id' | 'created_at' | 'suppliers'>;
export type UpdatePartDTO = Partial<CreatePartDTO>;

export interface OsPart {
  id: string;
  report_id: string;
  part_id: string | null;
  part_name_manual: string | null;
  qty_used: number;
  unit_cost_at_time: number | null;
  team_id?: string;
  parts?: { name: string; unit: string } | null;
}

export function isLowStock(part: Part): boolean {
  return part.stock_qty <= part.min_stock_qty;
}
