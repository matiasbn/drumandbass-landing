
import React from 'react';
import { Metadata } from 'next';
import ORGANIZACIONES from '@/src/data/organizaciones.json';
import Card from '@/src/components/Card';
import Grid from '@/src/components/Grid';

export const metadata: Metadata = {
  title: "Organizaciones | Drum & Bass Chile",
  description: "Organizaciones, sellos y colectivos que impulsan la cultura Drum and Bass en la escena chilena.",
};

export default function OrganizacionesPage() {
  const organizaciones = [...ORGANIZACIONES].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="bg-white min-h-screen">
      <Grid title="Organizaciones" subtitle={metadata.description} count={organizaciones.length} countLabel="ORGANIZACIONES REGISTRADAS" bgColor="bg-black" badgeColor="bg-[#ff0000]">
        {organizaciones.map((organizacion, idx) => (
          <Card
            key={idx}
            name={organizacion.name}
            links={[{ title: "Instagram", url: organizacion.url }]}
          />
        ))}
      </Grid>
    </div>
  );
}
