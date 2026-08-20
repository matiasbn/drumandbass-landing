// Helpers PUROS de URL de YouTube (sin API ni fetch): detectar y convertir a
// URL de embed, para incrustar sets de YouTube en el presskit. Archivo aparte de
// youtube.ts (que sí usa la API) para no arrastrar ese código al bundle cliente.

export function isYoutubeUrl(url: string): boolean {
  return /(?:^|\/\/|\.)(?:youtube\.com|youtu\.be)\b/i.test(url || '');
}

// Extrae el id de VIDEO de una URL de YouTube (watch/youtu.be/shorts/live/embed).
// null si es una playlist pura o no se pudo. Para la IFrame Player API.
export function youtubeVideoId(url: string): string | null {
  try {
    const u = new URL((url || '').startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (!host.endsWith('youtube.com')) return null;
    if (u.pathname === '/watch') return u.searchParams.get('v');
    const seg = u.pathname.split('/').filter(Boolean);
    if ((seg[0] === 'embed' || seg[0] === 'shorts' || seg[0] === 'live') && seg[1]) return seg[1];
    return null;
  } catch {
    return null;
  }
}

// Extrae el id de PLAYLIST (?list=…) si lo hay.
export function youtubePlaylistId(url: string): string | null {
  try {
    const u = new URL((url || '').startsWith('http') ? url : `https://${url}`);
    return u.searchParams.get('list');
  } catch {
    return null;
  }
}

// Convierte cualquier URL de YouTube (watch, youtu.be, playlist, shorts, live,
// embed) a su URL de embed. Devuelve null si no se pudo resolver.
export function youtubeEmbedUrl(url: string): string | null {
  try {
    const u = new URL((url || '').startsWith('http') ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host.endsWith('youtube.com')) {
      if (u.pathname === '/watch') {
        const id = u.searchParams.get('v');
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      if (u.pathname.startsWith('/embed/')) return `https://www.youtube.com${u.pathname}`;
      if (u.pathname === '/playlist') {
        const list = u.searchParams.get('list');
        return list ? `https://www.youtube.com/embed/videoseries?list=${list}` : null;
      }
      const seg = u.pathname.split('/').filter(Boolean);
      if ((seg[0] === 'shorts' || seg[0] === 'live') && seg[1]) {
        return `https://www.youtube.com/embed/${seg[1]}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}
