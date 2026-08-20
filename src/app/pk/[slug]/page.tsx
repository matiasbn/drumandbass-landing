import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/src/lib/supabase-server';
import { Presskit, PkProfile } from '@/src/types/presskit';
import PresskitView from '@/src/components/pk/PresskitView';
import TrackOnMount from '@/src/components/TrackOnMount';

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServer();

  const { data: pkProfile } = await supabase
    .from('pk_profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!pkProfile) {
    return { title: 'Presskit no encontrado — Drum and Bass Chile' };
  }

  const { data: presskit } = await supabase
    .from('presskits')
    .select('*')
    .eq('user_id', pkProfile.user_id)
    .eq('published', true)
    .single();

  if (!presskit) {
    return { title: 'Presskit no encontrado — Drum and Bass Chile' };
  }

  return {
    title: `${presskit.artist_name} — Presskit | Drum and Bass Chile`,
    description: presskit.bio
      ? `${presskit.bio.substring(0, 155)}...`
      : `Presskit digital de ${presskit.artist_name}`,
    keywords: [presskit.artist_name, 'presskit', 'drum and bass Chile', ...(presskit.genres || [])],
  };
}

// Presskit público del DJ. El cuerpo se renderiza con <PresskitView>, compartido
// con la vista previa del admin (/pk/preview/[id]) para que sean idénticos.
export default async function PublicPresskitPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServer();

  const { data: pkProfile } = await supabase
    .from('pk_profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!pkProfile) notFound();

  const profile = pkProfile as PkProfile;

  const { data: presskitData } = await supabase
    .from('presskits')
    .select('*')
    .eq('user_id', profile.user_id)
    .eq('published', true)
    .single();

  if (!presskitData) notFound();

  const presskit = presskitData as Presskit;

  return (
    <main className="flex-1">
      <TrackOnMount name="presskit_view" params={{ artist: presskit.artist_name, slug }} />
      <PresskitView presskit={presskit} slug={profile.slug} />
    </main>
  );
}
