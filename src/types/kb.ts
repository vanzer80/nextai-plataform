export interface KbArticle {
  id: string;
  team_id: string;
  title: string;
  content: string;
  service_type: string | null;
  tags: string[];
  is_public: boolean;
  is_active: boolean;
  view_count: number;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  users_created?: { full_name: string } | null;
}

export interface CreateKbArticleDTO {
  title: string;
  content: string;
  service_type?: string | null;
  tags?: string[];
  is_public?: boolean;
}

export type UpdateKbArticleDTO = Partial<CreateKbArticleDTO> & { is_active?: boolean };
