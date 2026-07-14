'use client';

import { RiYoutubeLine } from '@remixicon/react';

import type { YoutubeVideo } from '@/src/lib/youtube';
import { SOCIALS } from '@/src/constants';
import { event } from '@/src/lib/gtag';
import BrutalistButton from '@/src/components/BigButton';

export default function YoutubeVideos({ videos }: { videos: YoutubeVideo[] }) {
  if (videos.length === 0) return null;

  return (
    <div>
      {/* Últimos 2 videos en una sola fila; al hacer click abren en YouTube */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {videos.map((v) => (
          <a
            key={v.id}
            href={`https://www.youtube.com/watch?v=${v.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => event('sotano_video_click', { video_title: v.title })}
            className="group brutalist-border bg-white overflow-hidden block"
          >
            <div className="relative aspect-video bg-black">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={v.thumbnail}
                alt={v.title}
                loading="lazy"
                className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-500"
              />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="bg-black text-white brutalist-border w-16 h-16 flex items-center justify-center text-2xl group-hover:bg-[#ff0000] transition-colors">
                  ▶
                </span>
              </span>
            </div>
            <div className="p-4 border-t-4 border-black">
              <h3 className="font-black uppercase text-sm lg:text-base leading-tight">{v.title}</h3>
            </div>
          </a>
        ))}
      </div>

      {/* Botón al canal */}
      <div className="mt-6">
        <BrutalistButton
          variant="youtube"
          href={SOCIALS.youtube.url}
          external
          className="w-full lg:w-auto text-lg py-4 px-8"
        >
          <RiYoutubeLine /> Ver todos los capítulos en YouTube
        </BrutalistButton>
      </div>
    </div>
  );
}
