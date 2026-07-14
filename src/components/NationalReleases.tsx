import React from 'react';
import Link from 'next/link';
import { RiSoundcloudLine, RiArrowRightLine } from '@remixicon/react';
import dayjs from '@/src/lib/date';
import type { NationalRelease } from '@/src/lib/nationalReleases';

// Clases literales para que Tailwind las incluya (no se pueden interpolar dinámicas).
// Las columnas se ajustan a la cantidad (tope por breakpoint) para dividir en
// espacios iguales cuando hay menos de 5.
const SM_COLS: Record<number, string> = { 1: 'sm:grid-cols-1', 2: 'sm:grid-cols-2' };
const MD_COLS: Record<number, string> = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
};
const LG_COLS: Record<number, string> = {
  1: 'lg:grid-cols-1',
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
};

// Banner de releases nacionales (home + /releases).
export default function NationalReleases({
  releases,
  moreHref,
}: {
  releases: NationalRelease[];
  moreHref?: string;
}) {
  if (releases.length === 0 && !moreHref) return null;

  // El botón "ver todos" cuenta como una celda más de la grilla, para que quede
  // en la misma fila que los releases (tope 5 columnas).
  const n = Math.min(releases.length + (moreHref ? 1 : 0), 5);
  const gridCols = `grid-cols-1 ${SM_COLS[Math.min(n, 2)]} ${MD_COLS[Math.min(n, 3)]} ${LG_COLS[n]}`;

  return (
    <div className={`grid ${gridCols} gap-4`}>
      {releases.map((r, i) => (
        <div
          key={`${r.url}-${i}`}
          className="group relative bg-white brutalist-border brutalist-shadow-soundcloud p-6 flex flex-col gap-3 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(255,85,0,1)] transition-all"
        >
          {/* Overlay que hace toda la tarjeta clickeable → SoundCloud */}
          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Escuchar ${r.title} en SoundCloud`}
            className="absolute inset-0"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="mono text-[10px] font-black uppercase bg-[#FF5500] text-white px-2 py-0.5">
              RELEASE
            </span>
            {r.releasedAt && (
              <span className="mono text-[10px] font-bold uppercase opacity-50">
                {dayjs(r.releasedAt).format('DD MMM YYYY')}
              </span>
            )}
          </div>

          <div className="flex items-start gap-2 group-hover:text-[#FF5500] transition-colors">
            <h3 className="text-xl font-black uppercase leading-tight break-words">{r.title}</h3>
            <RiSoundcloudLine className="w-5 h-5 text-[#FF5500] shrink-0 mt-1" />
          </div>

          <span className="mt-auto mono text-xs font-bold uppercase opacity-70 truncate">
            {r.slug ? (
              <Link
                href={`/pk/${r.slug}`}
                className="relative z-10 hover:text-[#FF5500] transition-colors"
              >
                {r.artistName}
              </Link>
            ) : (
              r.artistName
            )}
          </span>
        </div>
      ))}

      {moreHref && (
        <Link
          href={moreHref}
          className="group bg-white brutalist-border brutalist-shadow-soundcloud p-6 flex flex-col items-center justify-center gap-2 text-center hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(255,85,0,1)] transition-all"
        >
          <RiArrowRightLine className="w-8 h-8 text-[#FF5500] group-hover:translate-x-1 transition-transform" />
          <span className="text-lg font-black uppercase leading-tight group-hover:text-[#FF5500] transition-colors">
            Ver todos los releases
          </span>
        </Link>
      )}
    </div>
  );
}
