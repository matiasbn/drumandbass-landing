import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { createSupabaseServer } from '@/src/lib/supabase-server';
import { Presskit, PkProfile } from '@/src/types/presskit';
import BrutalistButton from '@/src/components/BigButton';
import {
  RiInstagramLine,
  RiSoundcloudLine,
  RiSpotifyLine,
  RiYoutubeLine,
  RiMusic2Line,
  RiMapPinLine,
  RiGlobalLine,
  RiFacebookLine,
  RiTiktokLine,
  RiTwitterXLine,
} from '@remixicon/react';

const PLATFORM_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; variant: 'instagram' | 'soundcloud' | 'spotify' | 'youtube' | 'primary' }> = {
  instagram: { icon: RiInstagramLine, variant: 'instagram' },
  soundcloud: { icon: RiSoundcloudLine, variant: 'soundcloud' },
  spotify: { icon: RiSpotifyLine, variant: 'spotify' },
  youtube: { icon: RiYoutubeLine, variant: 'youtube' },
  facebook: { icon: RiFacebookLine, variant: 'primary' },
  tiktok: { icon: RiTiktokLine, variant: 'primary' },
  twitter: { icon: RiTwitterXLine, variant: 'primary' },
  bandcamp: { icon: RiGlobalLine, variant: 'primary' },
};

function getPlatformConfig(platform: string) {
  const key = platform.toLowerCase();
  return PLATFORM_CONFIG[key] || { icon: RiGlobalLine, variant: 'primary' as const };
}

type PageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const supabase = await createSupabaseServer();

  const { data: pkProfile } = await supabase
    .from('pk_profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!pkProfile) {
    return { title: 'Presskit no encontrado — Drum and Bass Chile' };
  }

  const { data: presskit } = await supabase
    .from('presskits')
    .select('*')
    .eq('user_id', pkProfile.user_id)
    .eq('published', true)
    .single();

  if (!presskit) {
    return { title: 'Presskit no encontrado — Drum and Bass Chile' };
  }

  return {
    title: `${presskit.artist_name} — Presskit | Drum and Bass Chile`,
    description: presskit.bio
      ? `${presskit.bio.substring(0, 155)}...`
      : `Presskit digital de ${presskit.artist_name}`,
    keywords: [presskit.artist_name, 'presskit', 'drum and bass Chile', ...(presskit.genres || [])],
  };
}

export default async function PublicPresskitPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createSupabaseServer();

  const { data: pkProfile } = await supabase
    .from('pk_profiles')
    .select('*')
    .eq('slug', slug)
    .single();

  if (!pkProfile) notFound();

  const profile = pkProfile as PkProfile;

  const { data: presskitData } = await supabase
    .from('presskits')
    .select('*')
    .eq('user_id', profile.user_id)
    .eq('published', true)
    .single();

  if (!presskitData) notFound();

  const presskit = presskitData as Presskit;

  return (
    <main className="flex-1">
      {/* Hero */}
      <section className="border-b-4 border-black p-6 lg:p-12 flex flex-col md:flex-row gap-8 items-center">
        {presskit.photo_url ? (
          <img
            src={presskit.photo_url}
            alt={presskit.artist_name}
            className="w-full md:w-80 h-80 object-cover brutalist-border brutalist-shadow shrink-0"
          />
        ) : (
          <div className="w-full md:w-80 h-80 bg-gray-300 brutalist-border brutalist-shadow flex items-center justify-center shrink-0">
            <span className="text-6xl font-black opacity-20 select-none">IMG</span>
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-6xl lg:text-8xl font-black uppercase italic tracking-tighter leading-none mb-2">
            {presskit.artist_name}
          </h1>
          {presskit.real_name && (
            <p className="mono text-lg font-bold uppercase opacity-60 mb-4">
              {presskit.real_name}
            </p>
          )}
          {(presskit.city || presskit.country) && (
            <p className="mono text-sm font-bold uppercase flex items-center gap-2 mb-4">
              <RiMapPinLine className="w-4 h-4" />
              {[presskit.city, presskit.country].filter(Boolean).join(', ')}
            </p>
          )}
          {presskit.genres.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {presskit.genres.map((genre) => (
                <span
                  key={genre}
                  className="mono text-xs font-black uppercase bg-black text-white px-3 py-1"
                >
                  {genre}
                </span>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Bio */}
      {presskit.bio && (
        <section className="border-b-4 border-black p-6 lg:p-12">
          <h2 className="text-5xl font-black uppercase italic mb-6">BIO</h2>
          <p className="text-lg leading-relaxed max-w-3xl whitespace-pre-line">{presskit.bio}</p>
        </section>
      )}

      {/* Social */}
      {presskit.socials.length > 0 && (
        <section className="border-b-4 border-black p-6 lg:p-12">
          <h2 className="text-5xl font-black uppercase italic mb-6">SOCIAL</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {presskit.socials.map(({ platform, url }) => {
              const config = getPlatformConfig(platform);
              const Icon = config.icon;
              return (
                <BrutalistButton
                  key={platform}
                  variant={config.variant}
                  href={url}
                  external
                  className="p-6 flex-col text-center"
                >
                  <div className="text-2xl flex justify-center mb-2">
                    <Icon />
                  </div>
                  {platform}
                </BrutalistButton>
              );
            })}
          </div>
        </section>
      )}

      {/* Mixes */}
      {presskit.mixes.length > 0 && (
        <section className="border-b-4 border-black p-6 lg:p-12">
          <h2 className="text-5xl font-black uppercase italic mb-6">
            <RiMusic2Line className="inline w-10 h-10 mr-2" />
            MIXES & RELEASES
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {presskit.mixes.map((mix, i) => (
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
      )}
    </main>
  );
}
