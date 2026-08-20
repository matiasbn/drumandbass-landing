import { Presskit } from '@/src/types/presskit';
import BrutalistButton from '@/src/components/BigButton';
import { socialToUrl } from '@/src/lib/socials';
import { parseRider, setupRows, riderIsEmpty, riderDisplay } from '@/src/lib/rider';
import DownloadPresskitButton from '@/src/components/pk/DownloadPresskitButton';
import ReleasesPlayer from '@/src/components/ReleasesPlayer';
import { isSoundcloudUrl } from '@/src/lib/soundcloud';
import { isBandcampUrl } from '@/src/lib/bandcamp';
import type { NationalRelease } from '@/src/lib/nationalReleases';
import PhotoCarousel from '@/src/components/pk/PhotoCarousel';
import LogosSection from '@/src/components/pk/LogosSection';
import {
  RiInstagramLine,
  RiSoundcloudLine,
  RiSpotifyLine,
  RiYoutubeLine,
  RiMapPinLine,
  RiGlobalLine,
  RiFacebookLine,
  RiTiktokLine,
  RiTwitterXLine,
  RiAlbumFill,
} from '@remixicon/react';

const PLATFORM_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; variant: 'instagram' | 'soundcloud' | 'spotify' | 'youtube' | 'primary' | 'bandcamp' }> = {
  instagram: { icon: RiInstagramLine, variant: 'instagram' },
  soundcloud: { icon: RiSoundcloudLine, variant: 'soundcloud' },
  spotify: { icon: RiSpotifyLine, variant: 'spotify' },
  youtube: { icon: RiYoutubeLine, variant: 'youtube' },
  facebook: { icon: RiFacebookLine, variant: 'primary' },
  tiktok: { icon: RiTiktokLine, variant: 'primary' },
  twitter: { icon: RiTwitterXLine, variant: 'primary' },
  bandcamp: { icon: RiAlbumFill, variant: 'bandcamp' },
};

function getPlatformConfig(platform: string) {
  const key = platform.toLowerCase();
  return PLATFORM_CONFIG[key] || { icon: RiGlobalLine, variant: 'primary' as const };
}

function ensureAbsoluteUrl(url: string): string {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `https://${url}`;
}

interface PresskitViewProps {
  presskit: Presskit;
  slug: string;
  // preview = vista previa del admin (presskit no publicado): oculta la descarga
  // del PDF, que necesita un presskit real publicado por slug.
  preview?: boolean;
}

// Cuerpo del presskit público, reutilizable: lo usa la página pública
// (/pk/[slug]) y la vista previa del admin (/pk/preview/[id]) para renderizar
// EXACTAMENTE lo mismo que verá el DJ.
export default function PresskitView({ presskit, slug, preview = false }: PresskitViewProps) {
  return (
    <>
      {/* Hero */}
      <section className="border-b-4 border-black p-6 lg:p-12 flex flex-col md:flex-row gap-8 items-center">
        <PhotoCarousel
          photos={presskit.photo_urls?.length ? presskit.photo_urls : presskit.photo_url ? [presskit.photo_url] : []}
          artistName={presskit.artist_name}
        />
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
          {!preview && (
            <div className="mt-6">
              <DownloadPresskitButton presskit={presskit} slug={slug} />
            </div>
          )}
        </div>
      </section>

      {/* Bio */}
      {presskit.bio && (
        <section className="border-b-4 border-black p-6 lg:p-12">
          <h2 className="text-5xl font-black uppercase italic mb-6">BIO</h2>
          <p className="text-lg leading-relaxed max-w-3xl whitespace-pre-line break-words overflow-hidden">{presskit.bio}</p>
        </section>
      )}

      {/* Secciones personalizadas (título + contenido), tras la bio */}
      {(presskit.custom_sections || [])
        .filter((s) => s.title?.trim() && s.body?.trim())
        .map((sec, i) => (
          <section key={i} className="border-b-4 border-black p-6 lg:p-12">
            <h2 className="text-5xl font-black uppercase italic mb-6 break-words">{sec.title}</h2>
            <p className="text-lg leading-relaxed max-w-3xl whitespace-pre-line break-words overflow-hidden">{sec.body}</p>
          </section>
        ))}

      {/* Rider técnico (opcional): uno o varios setups */}
      {(() => {
        const rider = parseRider(presskit.rider);
        if (riderIsEmpty(rider)) return null;
        const items = riderDisplay(rider);
        if (items.length === 0) return null;
        // "single" = un único setup de reproductores sin nombre → layout simple.
        // Un controlador siempre muestra su encabezado "Controlador N".
        const rawSole = rider.setups.filter((s) => setupRows(s).length > 0 || s.notes);
        const single = items.length === 1 && !items[0].isController && !rawSole[0]?.name;
        return (
          <section className="border-b-4 border-black p-6 lg:p-12">
            <h2 className="text-5xl font-black uppercase italic mb-6">RIDER TÉCNICO</h2>
            {/* auto-fit: tantas columnas como quepan con ≥400px cada una (para que
                el valor del rider no se parta). Ancho → 3 en fila; angosto → 2 o 1.
                El min(400px,100%) evita overflow horizontal en móvil. */}
            <div className="grid gap-6 max-w-7xl grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))]">
              {items.map((it, i) => (
                <div key={i} className={single ? 'md:col-span-2 max-w-2xl' : 'brutalist-border p-4'}>
                  {!single && (
                    <h3 className="font-black uppercase text-xl mb-3">{it.name}</h3>
                  )}
                  <div className="space-y-2">
                    {it.rows.map((r) => (
                      <div key={r.label} className="flex flex-col sm:flex-row sm:items-baseline gap-0.5 sm:gap-3 border-b-2 border-black/10 pb-1.5">
                        <span className="mono text-xs font-black uppercase text-gray-500 sm:w-28 shrink-0">{r.label}</span>
                        <span className="text-lg font-bold min-w-0 flex-1">{r.value}</span>
                      </div>
                    ))}
                    {it.notes && <p className="mono text-sm leading-relaxed whitespace-pre-line break-words pt-1">{it.notes}</p>}
                  </div>
                </div>
              ))}
            </div>
            {rider.notes && (
              <p className="mono text-base leading-relaxed whitespace-pre-line break-words max-w-3xl mt-6">{rider.notes}</p>
            )}
          </section>
        );
      })()}

      {/* Social */}
      {presskit.socials.length > 0 && (
        <section className="border-b-4 border-black p-6 lg:p-12">
          <h2 className="text-5xl font-black uppercase italic mb-6">SOCIAL</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {presskit.socials.map(({ platform, url }, index) => {
              const config = getPlatformConfig(platform);
              const Icon = config.icon;
              return (
                <BrutalistButton
                  // Key por índice: un DJ puede tener 2 cuentas de la misma
                  // plataforma (p.ej. dos SoundCloud) y no deben colisionar.
                  key={`${platform}-${index}`}
                  variant={config.variant}
                  href={socialToUrl(platform, url)}
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

      {/* Sets & Releases — reproductor con playlist (como /releases) para los
          tracks de SoundCloud, con expansión de EPs. Los datos (presskit.mixes)
          no se tocan, así que el PDF se sigue generando igual. */}
      {presskit.mixes.length > 0 && (() => {
        const valid = presskit.mixes.filter((m) => m.title?.trim() && m.url?.trim());
        // El player reproduce SoundCloud Y Bandcamp; el resto (YouTube/Spotify…)
        // queda como tarjetas-link.
        const playable = (u: string) => isSoundcloudUrl(u) || isBandcampUrl(u);
        const playerReleases: NationalRelease[] = valid
          .filter((m) => playable(ensureAbsoluteUrl(m.url)))
          .map((m) => ({
            title: m.title,
            url: ensureAbsoluteUrl(m.url),
            artistName: presskit.artist_name,
            slug,
            releasedAt: m.released_at ?? null,
            downloadable: false, // se lee en vivo por track
            downloadUrl: null,
            isEp: m.is_ep === true || /\/sets\//i.test(m.url) || /\/album\//i.test(m.url),
            kind: m.type === 'set' ? 'set' : 'release',
          }));
        const others = valid.filter((m) => !playable(ensureAbsoluteUrl(m.url)));
        return (
          <section className="border-b-4 border-black p-6 lg:p-12">
            <h2 className="text-5xl font-black uppercase italic mb-6">SETS &amp; RELEASES</h2>
            {playerReleases.length > 0 && <ReleasesPlayer releases={playerReleases} hideArtistFilter />}
            {others.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {others.map((mix, i) => (
                  <a
                    key={i}
                    href={ensureAbsoluteUrl(mix.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white brutalist-border brutalist-shadow p-6 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all block"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-xl font-black uppercase">{mix.title}</h3>
                      {mix.type && (
                        <span className={`mono text-[10px] font-black uppercase px-2 py-0.5 ${mix.type === 'release' ? 'bg-[#ff0055] text-white' : 'bg-black text-white'}`}>
                          {mix.type}
                        </span>
                      )}
                    </div>
                    <span className="mono text-xs font-bold uppercase opacity-60">{mix.platform}</span>
                  </a>
                ))}
              </div>
            )}
          </section>
        );
      })()}

      {/* Links */}
      {presskit.links?.length > 0 && (
        <section className="border-b-4 border-black p-6 lg:p-12">
          <h2 className="text-5xl font-black uppercase italic mb-6">LINKS</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {presskit.links.map((link, i) => (
              <a
                key={i}
                href={ensureAbsoluteUrl(link.url)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-white brutalist-border brutalist-shadow p-6 hover:translate-x-[-4px] hover:translate-y-[-4px] hover:shadow-[12px_12px_0px_0px_rgba(0,0,0,1)] transition-all block"
              >
                <h3 className="text-xl font-black uppercase">{link.title}</h3>
                <span className="mono text-xs font-bold uppercase opacity-60 break-all">
                  {link.url}
                </span>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Logos — al final del presskit, colapsables tras "Mostrar logos" */}
      <LogosSection
        slug={slug}
        artistName={presskit.artist_name}
        logoUrls={presskit.logo_urls ?? []}
      />
    </>
  );
}
