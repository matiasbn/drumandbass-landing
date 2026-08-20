import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/src/lib/supabase-server';
import { Presskit, PkProfile } from '@/src/types/presskit';
import { pendingToPresskit } from '@/src/types/pendingPresskit';
import type { PendingPresskitData } from '@/src/types/pendingPresskit';
import PresskitView from '@/src/components/pk/PresskitView';
import TrackOnMount from '@/src/components/TrackOnMount';

type PageProps = {
  params: Promise<{ slug: string }>;
};

// Busca el presskit publicado del slug. Si no hay, cae al pendiente (borrador aún
// no aceptado por el DJ) vía RPC pública por slug. Devuelve el presskit + si está
// publicado. `null` si no existe ni publicado ni pendiente.
async function loadPresskit(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  slug: string
): Promise<{ presskit: Presskit; published: boolean } | null> {
  const { data: pkProfile } = await supabase.from('pk_profiles').select('*').eq('slug', slug).single();
  if (pkProfile) {
    const profile = pkProfile as PkProfile;
    const { data: presskitData } = await supabase
      .from('presskits')
      .select('*')
      .eq('user_id', profile.user_id)
      .eq('published', true)
      .single();
    if (presskitData) return { presskit: presskitData as Presskit, published: true };
  }
  // Fallback: pendiente por slug (solo status='pending', vía SECURITY DEFINER).
  const { data: rows } = await supabase.rpc('get_pending_presskit_by_slug', { p_slug: slug });
  const row = Array.isArray(rows) ? rows[0] : rows;
  if (row?.data) return { presskit: pendingToPresskit(row.data as PendingPresskitData), published: false };
  return null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServer();
  const found = await loadPresskit(supabase, slug);

  if (!found) return { title: 'Presskit no encontrado — Drum and Bass Chile' };

  const { presskit, published } = found;
  return {
    title: `${presskit.artist_name} — Presskit | Drum and Bass Chile`,
    description: presskit.bio
      ? `${presskit.bio.substring(0, 155)}...`
      : `Presskit digital de ${presskit.artist_name}`,
    keywords: [presskit.artist_name, 'presskit', 'drum and bass Chile', ...(presskit.genres || [])],
    // Borrador (aún no aceptado): visible por link pero NO indexable.
    ...(published ? {} : { robots: { index: false, follow: false } }),
  };
}

// Presskit público del DJ. El cuerpo se renderiza con <PresskitView>, compartido
// con la vista previa del admin (/pk/preview/[id]) para que sean idénticos.
export default async function PublicPresskitPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServer();

  const found = await loadPresskit(supabase, slug);
  if (!found) notFound();

  const { presskit, published } = found;

  return (
    <main className="flex-1">
      {published ? (
        <TrackOnMount name="presskit_view" params={{ artist: presskit.artist_name, slug }} />
      ) : (
        // Borrador: aviso de que el artista aún no lo publicó.
        <div className="sticky top-0 z-50 bg-black text-white border-b-4 border-[#ff0055] px-4 py-2 text-center">
          <p className="mono text-[11px] font-black uppercase">
            Borrador · este presskit aún no fue publicado por el artista
          </p>
        </div>
      )}
      <PresskitView presskit={presskit} slug={slug} preview={!published} />
    </main>
  );
}
