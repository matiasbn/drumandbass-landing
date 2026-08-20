// Videos de YouTube del canal @drumandbasschile cuyo título contiene "El Sótano".
// Usa la playlist de subidas del canal (UU...) y filtra por título; cachea la
// respuesta de la API con ISR para no gastar cuota en cada request.

const UPLOADS_PLAYLIST = 'UUa93ljufgJ4Wdryd8FUFZnQ'; // subidas de @drumandbasschile
const TITLE_MATCH = 'el sotano'; // normalizado (sin acentos, minúsculas)

export interface YoutubeVideo {
  id: string;
  title: string;
  thumbnail: string;
  publishedAt: string;
}

const normalize = (t: string) =>
  t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

interface PlaylistItem {
  snippet?: {
    title?: string;
    publishedAt?: string;
    resourceId?: { videoId?: string };
    thumbnails?: Record<string, { url?: string }>;
  };
}

export async function getSotanoVideos(max = 6): Promise<YoutubeVideo[]> {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];

  try {
    const url =
      `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet` +
      `&playlistId=${UPLOADS_PLAYLIST}&maxResults=50&key=${key}`;
    // 30s: guarda de cuota. La sección de El Sótano se sirve por /api/sotano
    // (sin cache de ruta), así que esta es la frescura real (~30s). Aunque haya
    // mucho tráfico, la API de YouTube se llama como máximo 1 vez cada 30s
    // (~2880/día vs cuota de 10k). No confundir con el ISR del home (eventos).
    const res = await fetch(url, { next: { revalidate: 30 } });
    if (!res.ok) return [];

    const data = (await res.json()) as { items?: PlaylistItem[] };
    const items = data.items || [];

    return items
      .filter((i) => normalize(i.snippet?.title || '').includes(TITLE_MATCH))
      .map((i) => {
        const sn = i.snippet || {};
        const videoId = sn.resourceId?.videoId || '';
        const th = sn.thumbnails || {};
        const thumb = th.maxres || th.high || th.medium || th.default;
        return {
          id: videoId,
          title: sn.title || '',
          thumbnail: thumb?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          publishedAt: sn.publishedAt || '',
        };
      })
      .filter((v) => v.id)
      .slice(0, max);
  } catch {
    return [];
  }
}
