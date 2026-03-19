import React from 'react';
import { Metadata } from 'next';
import { createSupabaseServer } from '@/src/lib/supabase-server';
import { Presskit, PkProfile } from '@/src/types/presskit';
import Card from '@/src/components/Card';
import Grid from '@/src/components/Grid';

export const metadata: Metadata = {
  title: 'Artistas',
  description: 'Directorio de DJs, productores y talentos de la escena Drum and Bass en Chile.',
  keywords: ['artistas drum and bass', 'DJs DNB Chile', 'talentos bass music Chile'],
  alternates: { canonical: '/artistas' },
};

export const revalidate = 60;

export default async function ArtistDirectory() {
  const supabase = await createSupabaseServer();

  const { data: presskits } = await supabase
    .from('presskits')
    .select('*')
    .eq('published', true)
    .order('artist_name', { ascending: true });

  const publishedPresskits = (presskits || []) as Presskit[];

  // Fetch pk_profiles for slugs
  const userIds = publishedPresskits.map((pk) => pk.user_id);
  const { data: profiles } = await supabase
    .from('pk_profiles')
    .select('*')
    .in('user_id', userIds.length > 0 ? userIds : ['none']);

  const profileMap = new Map(
    ((profiles || []) as PkProfile[]).map((p) => [p.user_id, p])
  );

  const artists = publishedPresskits.map((pk) => {
    const profile = profileMap.get(pk.user_id);
    const slug = profile?.slug;

    return {
      name: pk.artist_name,
      photoUrl: pk.photo_urls?.length ? pk.photo_urls[0] : pk.photo_url,
      href: slug ? `/pk/${slug}` : undefined,
    };
  });

  return (
    <div className="bg-white min-h-screen">
      <Grid
        title="Artistas"
        subtitle={metadata.description as string}
        count={artists.length}
        countLabel="TALENTOS REGISTRADOS"
        bgColor="bg-[#0000ff]"
      >
        {artists.map((artist, idx) => (
          <Card
            key={idx}
            name={artist.name}
            photoUrl={artist.photoUrl}
            href={artist.href}
          />
        ))}
      </Grid>
    </div>
  );
}
