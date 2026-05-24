export interface CsatResponse {
  id: string;
  report_id: string;
  team_id: string;
  token: string;
  rating: number | null;
  comment: string | null;
  submitted_at: string | null;
  created_at: string;
}

export interface CsatTokenData {
  id: string;
  already_submitted: boolean;
  rating: number | null;
  report_id: string;
  os_number: string | null;
  service_date: string | null;
  service_type: string | null;
  tenant_name: string;
  tenant_logo_url: string | null;
  client_name: string | null;
}

export interface CsatAvg {
  avg_rating: number | null;
  response_count: number;
  total_count: number;
}
