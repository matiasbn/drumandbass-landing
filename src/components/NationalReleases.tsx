import React from 'react';
import Link from 'next/link';
import { RiSoundcloudLine } from '@remixicon/react';
import dayjs from '@/src/lib/date';
import type { NationalRelease } from '@/src/lib/nationalReleases';

export default function NationalReleases({ releases }: { releases: NationalRelease[] }) {
  if (releases.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {releases.map((r, i) => (
        <div
          key={`${r.url}-${i}`}
          className="bg-white brutalist-border brutalist-shadow-soundcloud p-6 flex flex-col gap-3"
        >
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

          <a
            href={r.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-start gap-2 hover:text-[#FF5500] transition-colors"
          >
            <h3 className="text-xl font-black uppercase leading-tight break-words">{r.title}</h3>
            <RiSoundcloudLine className="w-5 h-5 text-[#FF5500] shrink-0 mt-1" />
          </a>

          <span className="mt-auto mono text-xs font-bold uppercase opacity-70 truncate">
            {r.slug ? (
              <Link href={`/pk/${r.slug}`} className="hover:text-[#FF5500] transition-colors">
                {r.artistName}
              </Link>
            ) : (
              r.artistName
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
