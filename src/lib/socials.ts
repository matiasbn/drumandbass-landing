// Redes sociales del presskit: se guarda SOLO el nombre de usuario (handle), no la
// URL completa. La URL se reconstruye al renderizar el link. Centralizado acá para
// que el editor, el presskit público y el admin usen la misma lógica.

export const PLATFORM_BASE_URLS: Record<string, string> = {
  Instagram: 'https://instagram.com/',
  SoundCloud: 'https://soundcloud.com/',
  Spotify: 'https://open.spotify.com/artist/',
  YouTube: 'https://youtube.com/@',
  Facebook: 'https://facebook.com/',
  TikTok: 'https://tiktok.com/@',
  Twitter: 'https://x.com/',
  Bandcamp: 'https://',
};

// Normaliza a HANDLE lo que sea que venga (handle, @handle, o URL completa —
// incluidas las viejas guardadas como URL). Saca base conocida / dominio, y limpia
// @, query (?igsh=…, ?si=…), fragment y slash final.
export function socialToHandle(platform: string, value: string): string {
  const t = (value || '').trim();
  if (!t) return '';
  // Bandcamp usa SUBDOMINIO (https://<handle>.bandcamp.com), no un path. El handle
  // es el subdominio; aceptamos URL completa o handle pelado.
  if (platform === 'Bandcamp') {
    const m = t.match(/https?:\/\/([^./]+)\.bandcamp\.com/i);
    if (m) return m[1];
    return t.replace(/^@/, '').replace(/[?#].*$/, '').replace(/\/+$/, '').replace(/\.bandcamp\.com.*$/i, '');
  }
  const base = PLATFORM_BASE_URLS[platform];
  let h: string;
  if (base && base !== 'https://' && t.startsWith(base)) {
    h = t.slice(base.length);
  } else {
    const m = t.match(/^https?:\/\/[^/]+\/(.+)$/i); // URL con path → último tramo
    if (m) h = m[1];
    else if (/^https?:\/\//i.test(t)) h = t.replace(/^https?:\/\//i, ''); // URL sin path (Bandcamp)
    else h = t;
  }
  const cleaned = h
    .replace(/^@/, '')
    .replace(/[?#].*$/, '') // corta query / fragment (tracking de Instagram, etc.)
    .replace(/\/+$/, '');
  // Solo el nombre de usuario: último tramo del path. Un usuario nunca lleva '/',
  // así que esto arregla paths raros (Spotify intl-es/artist/ID, user/ID) sin
  // afectar los handles normales (que no tienen '/').
  return cleaned.split('/').pop() || cleaned;
}

// Reconstruye la URL absoluta para el href a partir del handle guardado. Si el
// valor ya es una URL (compat con datos viejos), la deja tal cual.
export function socialToUrl(platform: string, value: string): string {
  const t = (value || '').trim();
  if (!t) return '';
  if (/^https?:\/\//i.test(t)) return t;
  // Bandcamp: subdominio. "djfatpablo" → https://djfatpablo.bandcamp.com
  if (platform === 'Bandcamp') {
    const handle = t.replace(/^@/, '').replace(/\.bandcamp\.com.*$/i, '').replace(/\/+$/, '');
    return `https://${handle}.bandcamp.com`;
  }
  const base = PLATFORM_BASE_URLS[platform];
  return base ? `${base}${t.replace(/^@/, '')}` : t;
}
