'use client';

import { useEffect, useState } from 'react';
import NationalReleases from '@/src/components/NationalReleases';
import type { NationalRelease } from '@/src/lib/nationalReleases';

// Sección "Releases Nacionales" del home. Carga los releases client-side desde
// /api/releases (siempre fresco), para que un release recién marcado por un DJ
// se vea de inmediato sin quedar horneado en el HTML cacheado del home (ISR).
// Mismo patrón que la app usa para datos dependientes del estado actual.
export default function NationalReleasesSection() {
  const [releases, setReleases] = useState<NationalRelease[] | null>(null);

  useEffect(() => {
    let active = true;
    fetch('/api/releases', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (active) setReleases((d.releases as NationalRelease[]) ?? []);
      })
      .catch(() => {
        if (active) setReleases([]);
      });
    return () => {
      active = false;
    };
  }, []);

  // Hasta cargar (o si no hay releases) no renderiza nada: evita hornear estado
  // en el HTML del ISR y evita una sección vacía.
  if (!releases || releases.length === 0) return null;

  const shown = releases.slice(0, 4);

  return (
    <section className="p-6 lg:p-12 border-b-4 border-black">
      <h2 className="text-5xl font-black uppercase mb-2 italic">Releases Nacionales</h2>
      <p className="mono text-base lg:text-lg font-bold uppercase opacity-60 mb-6 leading-tight">
        Lo más reciente de los productores de drum and bass nacionales. Publica el tuyo desde tu
        presskit.
      </p>
      <NationalReleases releases={shown} moreHref="/releases" />
    </section>
  );
}
