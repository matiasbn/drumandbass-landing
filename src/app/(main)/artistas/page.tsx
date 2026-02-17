import React from 'react';
import { Metadata } from 'next';
import ARTISTS from '@/src/data/artistas.json';
import Card from '@/src/components/Card';
import Grid from '@/src/components/Grid';

export const metadata: Metadata = {
  title: 'Artistas',
  description: 'Directorio de DJs, productores y talentos de la escena Drum and Bass en Chile.',
  keywords: ['artistas drum and bass', 'DJs DNB Chile', 'talentos bass music Chile'],
  alternates: { canonical: '/artistas' },
};

export default function ArtistDirectory() {
  const artists = ARTISTS.sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="bg-white min-h-screen">
      <Grid
        title="Artistas"
        subtitle={metadata.description}
        count={artists.length}
        countLabel="TALENTOS REGISTRADOS"
        bgColor="bg-[#0000ff]"
      >
        {artists.map((artist, idx) => (
          <Card
            key={idx}
            name={artist.name}
            links={artist.links}
            items={artist.sets}
            itemsLabel="Sets"
          />
        ))}
      </Grid>
    </div>
  );
}
