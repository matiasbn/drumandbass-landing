import React from 'react';
import { Metadata } from 'next';
import PRODUCTORES from '@/src/data/productores.json';
import Card from '@/src/components/Card';
import Grid from '@/src/components/Grid';

export const metadata: Metadata = {
  title: 'Productores | Drum and Bass Chile',
  description: 'Productores de eventos que impulsan la cultura Drum and Bass en la escena chilena.',
};

export default function ProductoresPage() {
  const productores = [...PRODUCTORES].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="bg-white min-h-screen">
      <Grid
        title="Productores"
        subtitle={metadata.description}
        count={productores.length}
        countLabel="PRODUCTORES REGISTRADOS"
        bgColor="bg-[#ff0000]"
      >
        {productores.map((productor, idx) => (
          <Card
            key={idx}
            name={productor.name}
            links={[{ title: 'Instagram', url: productor.url }]}
          />
        ))}
      </Grid>
    </div>
  );
}
