import { createClient } from '@supabase/supabase-js';
import { PresskitMix } from '@/src/types/presskit';
import { isSoundcloudUrl } from '@/src/lib/soundcloud';

export interface NationalRelease {
  title: string;
  url: string;
  artistName: string;
  slug: string | null;
  releasedAt: string | null;
}

// Cliente anónimo sin cookies: lo usa el home (ISR). No debe usar el cliente
// con cookies (createSupabaseServer) porque volvería la página dinámica y
// rompería el caché ISR. Los presskits publicados son de lectura pública (RLS).
function anonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Junta los releases de SoundCloud marcados como "Publicar en Releases
 * Nacionales" por todos los DJs con presskit publicado, ordenados por fecha de
 * publicación (display_date de SoundCloud), y devuelve los últimos `limit`.
 */
export async function getNationalReleases(limit = 3): Promise<NationalRelease[]> {
  const supabase = anonClient();
  if (!supabase) return [];

  const { data: presskits, error } = await supabase
    .from('presskits')
    .select('artist_name, user_id, mixes, updated_at')
    .eq('published', true);

  if (error || !presskits) return [];

  // Slugs para linkear el artista a su presskit (/pk/:slug).
  const userIds = presskits.map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from('pk_profiles')
    .select('user_id, slug')
    .in('user_id', userIds);
  const slugByUser = new Map<string, string>(
    (profiles || []).map((p) => [p.user_id, p.slug])
  );

  const releases: NationalRelease[] = [];
  for (const pk of presskits) {
    const mixes = (pk.mixes || []) as PresskitMix[];
    for (const m of mixes) {
      if (
        m.featured &&
        m.type === 'release' &&
        isSoundcloudUrl(m.url) &&
        m.title?.trim() &&
        m.url?.trim()
      ) {
        releases.push({
          title: m.title,
          url: m.url,
          artistName: pk.artist_name,
          slug: slugByUser.get(pk.user_id) ?? null,
          // Fallback a updated_at del presskit si el scraping de la fecha falló.
          releasedAt: m.released_at ?? pk.updated_at ?? null,
        });
      }
    }
  }

  releases.sort((a, b) => {
    const ta = a.releasedAt ? new Date(a.releasedAt).getTime() : 0;
    const tb = b.releasedAt ? new Date(b.releasedAt).getTime() : 0;
    return tb - ta;
  });

  return releases.slice(0, limit);
}
