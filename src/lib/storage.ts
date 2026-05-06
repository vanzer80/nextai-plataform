import { supabase } from '@/src/lib/supabase';

export function tenantPath(teamId: string, ...segments: string[]): string {
  return [teamId, ...segments].join('/');
}

// Extracts the storage path from a full Supabase public URL or returns the input as-is.
// Handles both old records (full URL) and new records (path only).
// URL format: https://<project>.supabase.co/storage/v1/object/public/<bucket>/<path>
export function extractStoragePath(urlOrPath: string, bucket: string): string {
  const marker = `/object/public/${bucket}/`;
  const idx = urlOrPath.indexOf(marker);
  if (idx !== -1) return urlOrPath.slice(idx + marker.length);
  return urlOrPath;
}

export async function batchSignedUrls(
  paths: string[],
  bucket: string,
  expiresIn = 3600,
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from(bucket).createSignedUrls(paths, expiresIn);
  const map: Record<string, string> = {};
  data?.forEach(d => { if (d.signedUrl) map[d.path] = d.signedUrl; });
  return map;
}
