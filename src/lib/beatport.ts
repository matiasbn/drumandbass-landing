import { beatportParse } from '@/src/lib/beatportUrl';

// Cliente de la API de Beatport (v4) usando las credenciales client_credentials
// que Beatport expone en el JS público de su widget embed. Con eso se lista la
// discografía de un artista (o los tracks de un release) CON su preview MP3
// (`sample_url`), reproducible en nuestro player propio.
//
// Zona gris de ToS (como el client_id de SoundCloud): son credenciales del
// embed oficial, no de un usuario. Frágiles: el client_id/secret puede rotar,
// así que se scrapean EN VIVO del JS del embed (con cache en memoria) para
// auto-repararse, y el token se refresca al expirar.

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

export type BeatportTrack = {
  id: string;
  title: string; // "Nombre (Mix)" si el mix no es Original Mix
  subtitle: string; // artistas
  previewUrl: string | null; // sample MP3 de ~2 min
  artwork: string | null;
  url: string; // URL pública del track
};

// ── Credenciales del embed (scrape del JS, cacheadas) ────────────────────────
let cachedCreds: { id: string; secret: string } | null = null;

async function getCreds(force = false): Promise<{ id: string; secret: string } | null> {
  if (cachedCreds && !force) return cachedCreds;
  try {
    const shell = await fetch('https://embed.beatport.com/', { headers: { 'User-Agent': UA } });
    if (!shell.ok) return cachedCreds;
    const html = await shell.text();
    const asset = html.match(/src="(\/assets\/[^"]+\.js)"/);
    if (!asset) return cachedCreds;
    const jsRes = await fetch(`https://embed.beatport.com${asset[1]}`, { headers: { 'User-Agent': UA } });
    if (!jsRes.ok) return cachedCreds;
    const js = await jsRes.text();
    const m = js.match(/client_id:"([^"]+)",client_secret:"([^"]+)"/);
    if (!m) return cachedCreds;
    cachedCreds = { id: m[1], secret: m[2] };
    return cachedCreds;
  } catch {
    return cachedCreds;
  }
}

// ── Token (client_credentials, cacheado hasta poco antes de expirar) ─────────
let cachedToken: { value: string; exp: number } | null = null;

async function getToken(force = false): Promise<string | null> {
  const now = Date.now();
  if (!force && cachedToken && cachedToken.exp > now + 30_000) return cachedToken.value;
  const creds = await getCreds(force);
  if (!creds) return null;
  try {
    const res = await fetch('https://account.beatport.com/o/token/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: creds.id,
        client_secret: creds.secret,
        grant_type: 'client_credentials',
      }),
    });
    if (!res.ok) {
      // creds rotadas → re-scrapear una vez
      if (!force) return getToken(true);
      return null;
    }
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    cachedToken = { value: j.access_token, exp: now + (j.expires_in || 3600) * 1000 };
    return cachedToken.value;
  } catch {
    return null;
  }
}

// GET autenticado a la API v4, con un reintento refrescando token en 401.
async function api(path: string): Promise<Record<string, unknown> | null> {
  let token = await getToken();
  if (!token) return null;
  const url = `https://api.beatport.com/v4${path}`;
  let res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA } });
  if (res.status === 401) {
    token = await getToken(true);
    if (!token) return null;
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'User-Agent': UA } });
  }
  if (!res.ok) return null;
  return (await res.json()) as Record<string, unknown>;
}

type RawTrack = {
  id?: number;
  name?: string;
  mix_name?: string;
  slug?: string;
  sample_url?: string | null;
  artists?: { name?: string }[];
  release?: { name?: string; image?: { uri?: string } };
};

function mapTrack(t: RawTrack): BeatportTrack | null {
  if (!t?.id || !t?.name) return null;
  const mix = t.mix_name && !/^original mix$/i.test(t.mix_name) ? ` (${t.mix_name})` : '';
  return {
    id: String(t.id),
    title: `${t.name}${mix}`,
    subtitle: (t.artists || []).map((a) => a.name).filter(Boolean).join(', '),
    previewUrl: t.sample_url || null,
    artwork: t.release?.image?.uri || null,
    url: `https://www.beatport.com/track/${t.slug || 'track'}/${t.id}`,
  };
}

// ── Público: tracks a partir de una URL de Beatport ──────────────────────────
// artist → toda la discografía; release → sus tracks; track → ese track.
export async function beatportTracksFromUrl(url: string, max = 100): Promise<BeatportTrack[]> {
  const parsed = beatportParse(url);
  if (!parsed) return [];
  const { type, id } = parsed;

  if (type === 'artist') {
    const out: BeatportTrack[] = [];
    let page = 1;
    while (out.length < max) {
      const d = await api(`/catalog/artists/${id}/tracks/?per_page=100&page=${page}`);
      const results = (d?.results as RawTrack[]) || [];
      for (const t of results) {
        const mt = mapTrack(t);
        if (mt) out.push(mt);
      }
      if (!d?.next || results.length === 0) break;
      page += 1;
    }
    return out.slice(0, max);
  }

  if (type === 'release') {
    const d = await api(`/catalog/releases/${id}/tracks/?per_page=100`);
    return ((d?.results as RawTrack[]) || []).map(mapTrack).filter((t): t is BeatportTrack => t !== null);
  }

  if (type === 'track') {
    const d = await api(`/catalog/tracks/${id}/`);
    const mt = d ? mapTrack(d as RawTrack) : null;
    return mt ? [mt] : [];
  }

  return [];
}
