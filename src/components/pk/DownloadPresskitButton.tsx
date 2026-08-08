'use client';

import React, { useState } from 'react';
import { RiDownloadLine } from '@remixicon/react';
import type { Presskit } from '@/src/types/presskit';
import { event } from '@/src/lib/gtag';

// Descarga el presskit como PDF "enviable" (documento propio, no captura). El
// generador (@react-pdf/renderer) es pesado, así que se importa on-demand al
// hacer click — no infla la carga de la página.
async function toDataUri(url?: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const fr = new FileReader();
      fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : null);
      fr.onerror = () => resolve(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export default function DownloadPresskitButton({ presskit, slug }: { presskit: Presskit; slug: string }) {
  const [loading, setLoading] = useState(false);

  const onClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const [{ pdf }, { PresskitPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./PresskitPdf'),
      ]);
      const photo = presskit.photo_urls?.[0] || presskit.photo_url || null;
      const photoData = await toDataUri(photo);
      const blob = await pdf(<PresskitPdf presskit={presskit} photoData={photoData} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `presskit-${slug}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      event('presskit_download', { slug, artist: presskit.artist_name });
    } catch {
      // Si algo falla, no rompemos la página.
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="inline-flex items-center gap-2 brutalist-border bg-black text-white px-5 py-3 mono text-sm font-black uppercase hover:bg-[#ff0055] transition-colors disabled:opacity-60 cursor-pointer"
    >
      <RiDownloadLine className="w-5 h-5" />
      {loading ? 'Generando PDF…' : 'Descargar presskit (PDF)'}
    </button>
  );
}
