'use client';

import { useEffect, useState } from 'react';
import type { YoutubeVideo } from '@/src/lib/youtube';
import YoutubeVideos from '@/src/components/YoutubeVideos';

// Sección de El Sótano cargada CLIENT-SIDE desde /api/sotano (desacoplada del
// ISR del home), para que un capítulo nuevo aparezca casi al instante sin
// esperar la caché del home. Renderiza null hasta cargar y si no hay videos
// (así no aparece un encabezado vacío).
export default function SotanoSection() {
  const [videos, setVideos] = useState<YoutubeVideo[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/api/sotano')
      .then((r) => (r.ok ? r.json() : { videos: [] }))
      .then((d) => alive && setVideos(d.videos || []))
      .catch(() => alive && setVideos([]));
    return () => {
      alive = false;
    };
  }, []);

  if (!videos || videos.length === 0) return null;

  return (
    <section className="p-6 lg:p-12 border-b-4 border-black">
      <h2 className="text-5xl font-black uppercase mb-2 italic">El Sótano</h2>
      <p className="mono text-base lg:text-lg font-bold uppercase opacity-60 mb-6 leading-tight">
        Nuestra serie audiovisual: le abrimos la cabina a los DJs de drum and bass de Chile
        para que muestren lo suyo.
      </p>
      <YoutubeVideos videos={videos} />
    </section>
  );
}
