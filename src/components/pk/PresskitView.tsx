import { Presskit } from '@/src/types/presskit';
import BrutalistButton from '@/src/components/BigButton';
import { socialToUrl, socialToHandle } from '@/src/lib/socials';
import { parseRider, setupRows, riderIsEmpty, riderDisplay } from '@/src/lib/rider';
import DownloadPresskitButton from '@/src/components/pk/DownloadPresskitButton';
import ReleasesPlayer from '@/src/components/ReleasesPlayer';
import { isSoundcloudUrl } from '@/src/lib/soundcloud';
import { isBandcampUrl } from '@/src/lib/bandcamp';
import { isYoutubeUrl } from '@/src/lib/youtubeUrl';
import { isSpotifyUrl } from '@/src/lib/spotifyUrl';
import type { NationalRelease } from '@/src/lib/nationalReleases';
import PhotoCarousel from '@/src/components/pk/PhotoCarousel';
import LogosSection from '@/src/components/pk/LogosSection';
import { looksLikeHtml } from '@/src/lib/mdFormat';
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
  // preview = vista previa / presskit no publicado (borrador). Se acepta por
  // compatibilidad con los callers; ya NO oculta la descarga del PDF (se genera
  // client-side desde el objeto presskit, no necesita estar publicado).
  preview?: boolean;
}

// Negrita inline: "**texto**" → <strong>. Devuelve nodos (texto + strong).
function renderInline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /\*\*(.+?)\*\*/g;
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push(<strong key={`${keyBase}-b${idx++}`}>{m[1]}</strong>);
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}

// Render del cuerpo de una sección personalizada (Markdown-lite): agrupa líneas
// "- "/"* "/"• " en viñetas, "1. "/"1) " en lista numerada, aplica **negrita**
// inline, y el resto queda como párrafos con saltos de línea preservados. El DJ
// escribe en texto plano (así se guarda), sin editor rico.
function SectionBody({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let ul: string[] = [];
  let ol: string[] = [];
  let para: string[] = [];
  const flushPara = () => {
    const joined = para.join('\n').replace(/\n+$/, '');
    if (joined.trim()) blocks.push(<p key={`p${blocks.length}`} className="whitespace-pre-line break-words">{renderInline(joined, `p${blocks.length}`)}</p>);
    para = [];
  };
  const flushUl = () => {
    if (ul.length) blocks.push(
      <ul key={`u${blocks.length}`} className="list-disc pl-6 space-y-1 break-words">
        {ul.map((b, i) => <li key={i}>{renderInline(b, `u${blocks.length}-${i}`)}</li>)}
      </ul>
    );
    ul = [];
  };
  const flushOl = () => {
    if (ol.length) blocks.push(
      <ol key={`o${blocks.length}`} className="list-decimal pl-6 space-y-1 break-words">
        {ol.map((b, i) => <li key={i}>{renderInline(b, `o${blocks.length}-${i}`)}</li>)}
      </ol>
    );
    ol = [];
  };
  for (const line of lines) {
    const bl = line.match(/^\s*[-*•]\s+(.*)$/);
    const nu = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (bl) { flushPara(); flushOl(); ul.push(bl[1]); }
    else if (nu) { flushPara(); flushUl(); ol.push(nu[1]); }
    else { flushUl(); flushOl(); para.push(line); }
  }
  flushPara();
  flushUl();
  flushOl();
  return <div className="text-lg leading-relaxed max-w-3xl overflow-hidden space-y-4">{blocks}</div>;
}

// Cuerpo del presskit público, reutilizable: lo usa la página pública
// (/pk/[slug]) y la vista previa del admin (/pk/preview/[id]) para renderizar
// EXACTAMENTE lo mismo que verá el DJ.
// presskit view
export default function PresskitView({ presskit, slug }: PresskitViewProps) {
  // URLs de Spotify del presskit → sus tracks (previews) se integran al MISMO
  // reproductor de Sets & Releases (no una sección aparte).
  const spotifyUrls = (presskit.mixes || [])
    .filter((m) => m.title?.trim() && m.url?.trim())
    .filter((m) => isSpotifyUrl(m.url) && !isSoundcloudUrl(m.url) && !isBandcampUrl(m.url) && !isYoutubeUrl(m.url))
    .map((m) => ensureAbsoluteUrl(m.url));

  // Rider y Social se renderizan al FINAL (definidos acá, colocados abajo).
  const riderSection = (() => {
    const rider = parseRider(presskit.rider);
    if (riderIsEmpty(rider)) return null;
    const items = riderDisplay(rider);
    if (items.length === 0) return null;
    const rawSole = rider.setups.filter((s) => setupRows(s).length > 0 || s.notes);
    const single = items.length === 1 && !items[0].isController && !rawSole[0]?.name;
    return (
      <section className="border-b-4 border-black p-6 lg:p-12">
        <h2 className="text-5xl font-black uppercase italic mb-6">RIDER TÉCNICO</h2>
        <div className="grid gap-6 max-w-7xl grid-cols-[repeat(auto-fit,minmax(min(400px,100%),1fr))]">
          {items.map((it, i) => (
            <div key={i} className={single ? 'md:col-span-2 max-w-2xl' : 'brutalist-border p-4'}>
              {!single && <h3 className="font-black uppercase text-xl mb-3">{it.name}</h3>}
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
  })();

  const socialSection = presskit.socials.length > 0 ? (
    <section className="border-b-4 border-black p-6 lg:p-12">
      <h2 className="text-5xl font-black uppercase italic mb-6">SOCIAL</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {(() => {
          const counts = presskit.socials.reduce<Record<string, number>>((acc, s) => {
            acc[s.platform] = (acc[s.platform] || 0) + 1;
            return acc;
          }, {});
          return presskit.socials.map(({ platform, url }, index) => {
            const config = getPlatformConfig(platform);
            const Icon = config.icon;
            const handle = socialToHandle(platform, url);
            const label = counts[platform] > 1 && handle ? `@${handle}` : platform;
            return (
              <BrutalistButton key={`${platform}-${index}`} variant={config.variant} href={socialToUrl(platform, url)} external className="p-6 flex-col text-center">
                <div className="text-2xl flex justify-center mb-2"><Icon /></div>
                <span className="break-all">{label}</span>
              </BrutalistButton>
            );
          });
        })()}
      </div>
    </section>
  ) : null;

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
          {/* El PDF se genera client-side desde el objeto presskit, así que
              funciona también en la vista previa / presskit pendiente (el DJ
              aún no acepta), no solo en el publicado. */}
          <div className="mt-6">
            <DownloadPresskitButton presskit={presskit} slug={slug} />
          </div>
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
            {looksLikeHtml(sec.body) ? (
              <div
                className="text-lg leading-relaxed max-w-3xl break-words overflow-hidden [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:mb-1 [&_p]:mb-3 [&_strong]:font-black [&_b]:font-black [&_em]:italic [&_u]:underline [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: sec.body }}
              />
            ) : (
              <SectionBody text={sec.body} />
            )}
          </section>
        ))}

      {/* Sets & Releases — reproductor con playlist (como /releases) para los
          tracks de SoundCloud, con expansión de EPs. Los datos (presskit.mixes)
          no se tocan, así que el PDF se sigue generando igual. */}
      {presskit.mixes.length > 0 && (() => {
        const valid = presskit.mixes.filter((m) => m.title?.trim() && m.url?.trim());
        // El player reproduce SoundCloud, Bandcamp Y YouTube (este último con su
        // iframe embebido en el frame central). El resto (Spotify…) queda como
        // tarjetas-link.
        const playable = (u: string) => isSoundcloudUrl(u) || isBandcampUrl(u) || isYoutubeUrl(u);
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
        // Spotify se muestra en su propia sección ("{ARTISTA} EN SPOTIFY"), no acá.
        const others = valid.filter((m) => !playable(ensureAbsoluteUrl(m.url)) && !isSpotifyUrl(m.url));
        return (
          <section className="border-b-4 border-black p-6 lg:p-12">
            <h2 className="text-5xl font-black uppercase italic mb-6">SETS &amp; RELEASES</h2>
            {(playerReleases.length > 0 || spotifyUrls.length > 0) && (
              <ReleasesPlayer releases={playerReleases} spotifyUrls={spotifyUrls} hideArtistFilter />
            )}
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

      {/* Rider técnico y Social van al FINAL (definidos arriba). */}
      {riderSection}
      {socialSection}

      {/* Logos — al final del presskit, colapsables tras "Mostrar logos" */}
      <LogosSection
        slug={slug}
        artistName={presskit.artist_name}
        logoUrls={presskit.logo_urls ?? []}
      />
    </>
  );
}
