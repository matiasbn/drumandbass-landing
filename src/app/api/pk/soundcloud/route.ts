import { NextRequest, NextResponse } from 'next/server';
import { fetchSoundcloudUserTracks } from '@/src/lib/soundcloud';

const SC_MOBILE_HEADERS = {
  Accept: 'text/html',
  'User-Agent':
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
};

type ScTrack = { id: string; title: string; url: string };

// El título sale del aria-label o del JSON-LD, así que puede venir con entidades
// HTML (p.ej. "&amp;" por "&"). Las decodificamos para guardar el título limpio.
function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function extractUsername(url: string): string | null {
  try {
    const u = new URL(url);
    if (!u.hostname.includes('soundcloud.com')) return null;
    // e.g. /zerodaydnb or /zerodaydnb/
    const parts = u.pathname.split('/').filter(Boolean);
    return parts[0] || null;
  } catch {
    return null;
  }
}

// Fuente 1: JSON-LD (schema.org). SoundCloud embebe el perfil como MusicGroup con
// un array de MusicRecording {name, url}. Es la fuente MÁS confiable: para algunas
// cuentas los tracks NO se renderizan como anchors aria-label (p.ej. djmestizo),
// pero SIEMPRE están acá. Recorremos el JSON en profundidad por robustez.
function extractJsonLdTracks(html: string, username: string): ScTrack[] {
  const out: ScTrack[] = [];
  const seen = new Set<string>();
  const prefix = `https://soundcloud.com/${username}/`;
  const scriptRe = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g;
  let m: RegExpExecArray | null;
  while ((m = scriptRe.exec(html)) !== null) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const stack: unknown[] = [data];
    while (stack.length) {
      const node = stack.pop();
      if (Array.isArray(node)) {
        // Push en reversa para que el recorrido LIFO respete el orden del array
        // (el JSON-LD lista los tracks del más reciente al más antiguo).
        for (let i = node.length - 1; i >= 0; i--) stack.push(node[i]);
        continue;
      }
      if (node && typeof node === 'object') {
        const o = node as Record<string, unknown>;
        if (o['@type'] === 'MusicRecording' && typeof o.url === 'string' && o.url.startsWith(prefix)) {
          const url = o.url;
          const slug = url.slice(prefix.length).replace(/\/+$/, '');
          if (slug && !seen.has(slug)) {
            seen.add(slug);
            out.push({ id: slug, title: decodeHtmlEntities(String(o.name ?? slug)), url });
          }
        }
        for (const v of Object.values(o)) {
          if (v && typeof v === 'object') stack.push(v);
        }
      }
    }
  }
  return out;
}

// Fuente 2: anchors aria-label + href del HTML móvil. Captura además playlists/EPs
// (/username/sets/…) que el JSON-LD (solo MusicRecording) no incluye.
function extractAriaTracks(html: string, username: string): ScTrack[] {
  const pattern = new RegExp(
    `aria-label="([^"]+)"[^>]*href="\\/${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\/([^"]+)"`,
    'g'
  );
  const out: ScTrack[] = [];
  const seen = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const slug = match[2];
    if (!seen.has(slug)) {
      seen.add(slug);
      out.push({
        id: slug,
        title: decodeHtmlEntities(match[1]),
        url: `https://soundcloud.com/${username}/${slug}`,
      });
    }
  }
  return out;
}

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const username = extractUsername(url);
  if (!username) {
    return NextResponse.json({ error: 'URL de SoundCloud inválida' }, { status: 400 });
  }

  try {
    // Fuente PRIMARIA: la API de SoundCloud (api-v2) con el client_id scrapeado,
    // que PAGINA y trae TODA la discografía. El HTML móvil solo embebe ~10 tracks
    // (los recientes), así que perfiles grandes se quedaban cortos.
    const apiTracks = await fetchSoundcloudUserTracks(url);

    // Fuente SECUNDARIA (fallback + robustez): scrape del HTML móvil (JSON-LD +
    // anchors aria-label). Cubre si la API falla (client_id rotado) y aporta algo
    // que la API no liste.
    let htmlTracks: ScTrack[] = [];
    try {
      const res = await fetch(`https://m.soundcloud.com/${username}`, { headers: SC_MOBILE_HEADERS });
      if (res.ok) {
        const html = await res.text();
        htmlTracks = [...extractJsonLdTracks(html, username), ...extractAriaTracks(html, username)];
      }
    } catch {
      // ignoramos: la API suele bastar
    }

    if ((!apiTracks || apiTracks.length === 0) && htmlTracks.length === 0) {
      return NextResponse.json({ error: 'No se pudo acceder al perfil de SoundCloud' }, { status: 502 });
    }

    // Merge: API primero (completa), luego HTML, deduplicado por slug.
    const bySlug = new Map<string, ScTrack>();
    for (const t of [...(apiTracks || []), ...htmlTracks]) {
      if (!bySlug.has(t.id)) bySlug.set(t.id, t);
    }

    // Orden alfabético por título (es-CL, sin distinguir mayúsculas/acentos).
    const tracks = [...bySlug.values()].sort((a, b) =>
      a.title.localeCompare(b.title, 'es', { sensitivity: 'base', numeric: true })
    );

    return NextResponse.json({ tracks });
  } catch (err) {
    console.error('SoundCloud scrape error:', err);
    return NextResponse.json(
      { error: 'No se pudieron obtener los tracks de SoundCloud' },
      { status: 500 }
    );
  }
}
