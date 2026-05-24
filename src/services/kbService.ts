import { supabase } from '@/src/lib/supabase';
import type { KbArticle, CreateKbArticleDTO, UpdateKbArticleDTO } from '@/src/types/kb';

const SELECT_FIELDS = `
  id, team_id, title, content, service_type, tags, is_public, is_active,
  view_count, created_by, updated_by, created_at, updated_at,
  users_created:created_by(full_name)
`;

export async function listKbArticles(opts: {
  search?: string;
  serviceType?: string;
  tag?: string;
  includeInactive?: boolean;
} = {}): Promise<KbArticle[]> {
  let q = supabase
    .from('kb_articles')
    .select(SELECT_FIELDS)
    .order('updated_at', { ascending: false });

  if (!opts.includeInactive) q = q.eq('is_active', true);
  if (opts.serviceType)     q = q.eq('service_type', opts.serviceType);
  if (opts.tag)             q = q.contains('tags', [opts.tag]);
  if (opts.search) {
    q = q.textSearch('title, content', opts.search, {
      type: 'websearch',
      config: 'portuguese',
    });
  }

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as KbArticle[];
}

export async function getKbArticle(id: string): Promise<KbArticle | null> {
  const { data, error } = await supabase
    .from('kb_articles')
    .select(SELECT_FIELDS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as unknown as KbArticle | null;
}

export async function createKbArticle(
  dto: CreateKbArticleDTO,
  userId: string,
): Promise<KbArticle> {
  const { data, error } = await supabase
    .from('kb_articles')
    .insert({
      title:        dto.title,
      content:      dto.content,
      service_type: dto.service_type ?? null,
      tags:         dto.tags ?? [],
      is_public:    dto.is_public ?? false,
      created_by:   userId,
      updated_by:   userId,
    })
    .select(SELECT_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as KbArticle;
}

export async function updateKbArticle(
  id: string,
  dto: UpdateKbArticleDTO,
  userId: string,
): Promise<void> {
  const { error } = await supabase
    .from('kb_articles')
    .update({ ...dto, updated_by: userId })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteKbArticle(id: string): Promise<void> {
  const { error } = await supabase
    .from('kb_articles')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getSuggestionsForServiceType(
  serviceType: string,
  limit = 3,
): Promise<KbArticle[]> {
  const { data, error } = await supabase
    .from('kb_articles')
    .select('id, title, content, service_type, tags, view_count, updated_at')
    .eq('is_active', true)
    .eq('service_type', serviceType)
    .order('view_count', { ascending: false })
    .limit(limit);
  if (error) return [];
  return (data ?? []) as unknown as KbArticle[];
}

export async function incrementView(articleId: string): Promise<void> {
  await supabase.rpc('increment_kb_view', { p_article_id: articleId });
}
