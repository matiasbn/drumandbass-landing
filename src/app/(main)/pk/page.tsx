import type { Metadata } from 'next';
import BrutalistButton from '@/src/components/BigButton';
import {
  RiInstagramLine,
  RiSoundcloudLine,
  RiSpotifyLine,
  RiYoutubeLine,
  RiMusic2Line,
  RiMapPinLine,
} from '@remixicon/react';

export const metadata: Metadata = {
  title: 'DJ SYNKRO — Presskit | Drum and Bass Chile',
  description:
    'Presskit digital de DJ SYNKRO. Drum and Bass, Liquid y Neurofunk desde Santiago, Chile.',
  keywords: [
    'DJ SYNKRO',
    'presskit',
    'drum and bass Chile',
    'liquid dnb',
    'neurofunk',
  ],
};

const DJ = {
  artistName: 'DJ SYNKRO',
  realName: 'Carlos Mendoza',
  city: 'Santiago',
  country: 'Chile',
  genres: ['Drum and Bass', 'Liquid', 'Neurofunk'],
  bio: 'Productor y DJ de la escena Drum and Bass chilena desde 2018. Conocido por sus sets energéticos que fusionan liquid melódico con neurofunk pesado, ha tocado en los principales eventos de bass music en Santiago y Valparaíso. Su sonido se caracteriza por atmósferas cinematográficas, bajos profundos y una selección que viaja entre lo melódico y lo oscuro.',
  socials: [
    { platform: 'Instagram', url: '#', variant: 'instagram' as const, icon: RiInstagramLine },
    { platform: 'SoundCloud', url: '#', variant: 'soundcloud' as const, icon: RiSoundcloudLine },
    { platform: 'Spotify', url: '#', variant: 'spotify' as const, icon: RiSpotifyLine },
    { platform: 'YouTube', url: '#', variant: 'youtube' as const, icon: RiYoutubeLine },
  ],
  mixes: [
    { title: 'Nocturnal Frequencies Vol. 3', platform: 'SoundCloud', url: '#' },
    { title: 'Liquid Dreams — Live at Club Subsuelo', platform: 'YouTube', url: '#' },
    { title: 'Neurofunk Therapy EP', platform: 'Spotify', url: '#' },
    { title: 'Bass Culture Radio Guest Mix', platform: 'SoundCloud', url: '#' },
  ],
};

export default function PresskitPage() {
  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="border-b-4 border-black p-6 lg:p-12 flex flex-col md:flex-row gap-8 items-center">
        <div className="w-full md:w-80 h-80 bg-gray-300 brutalist-border brutalist-shadow flex items-center justify-center shrink-0">
          <span className="text-6xl font-black opacity-20 select-none">IMG</span>
        </div>
        <div className="flex-1">
          <h1 className="text-6xl lg:text-8xl font-black uppercase italic tracking-tighter leading-none mb-2">
            {DJ.artistName}
          </h1>
          <p className="mono text-lg font-bold uppercase opacity-60 mb-4">
            {DJ.realName}
          </p>
          <p className="mono text-sm font-bold uppercase flex items-center gap-2 mb-4">
            <RiMapPinLine className="w-4 h-4" />
            {DJ.city}, {DJ.country}
          </p>
          <div className="flex flex-wrap gap-2">
            {DJ.genres.map((genre) => (
              <span
                key={genre}
                className="mono text-xs font-black uppercase bg-black text-white px-3 py-1"
              >
                {genre}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Bio */}
      <section className="border-b-4 border-black p-6 lg:p-12">
        <h2 className="text-5xl font-black uppercase italic mb-6">BIO</h2>
        <p className="text-lg leading-relaxed max-w-3xl">{DJ.bio}</p>
      </section>

      {/* Redes Sociales */}
      <section className="border-b-4 border-black p-6 lg:p-12">
        <h2 className="text-5xl font-black uppercase italic mb-6">SOCIAL</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {DJ.socials.map(({ platform, url, variant, icon: Icon }) => (
            <BrutalistButton
              key={platform}
              variant={variant}
              href={url}
              external
              className="p-6 flex-col text-center"
            >
              <div className="text-2xl flex justify-center mb-2">
                <Icon />
              </div>
              {platform}
            </BrutalistButton>
          ))}
        </div>
      </section>

      {/* Música / Mixes */}
      <section className="border-b-4 border-black p-6 lg:p-12">
        <h2 className="text-5xl font-black uppercase italic mb-6">
          <RiMusic2Line className="inline w-10 h-10 mr-2" />
          MIXES & RELEASES
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DJ.mixes.map((mix, i) => (
            <a
              key={i}
              href={mix.url}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-white brutalist-border brutalist-shadow p-6 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all block"
            >
              <h3 className="text-xl font-black uppercase mb-2">{mix.title}</h3>
              <span className="mono text-xs font-bold uppercase opacity-60">
                {mix.platform}
              </span>
            </a>
          ))}
        </div>
      </section>
    </main>
  );
}
