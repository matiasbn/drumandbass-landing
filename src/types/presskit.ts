export interface PkProfile {
  id: string;
  user_id: string;
  slug: string;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export interface PresskitSocial {
  platform: string;
  url: string;
}

export interface PresskitMix {
  title: string;
  platform: string;
  url: string;
  type?: 'set' | 'release';
  // "Publicar en Releases Nacionales" — solo aplica a releases de SoundCloud.
  featured?: boolean;
  // Fecha de publicación capturada desde SoundCloud (display_date) al marcar featured.
  released_at?: string | null;
  // Si el release es descargable (flag nativo de SoundCloud O gate externo tipo
  // Hypeddit), capturado junto con la fecha al marcar featured.
  downloadable?: boolean;
  // URL de descarga cuando NO es nativa (gate externo, p.ej. Hypeddit). null si
  // es descarga nativa (se baja desde la página de SoundCloud) o no descargable.
  download_url?: string | null;
  // Si el release es un EP/álbum (URL de tipo playlist/set) en vez de un track
  // suelto. Se muestra como categoría "EP" en Releases Nacionales.
  is_ep?: boolean;
}

export interface PresskitLink {
  title: string;
  url: string;
}

export interface Presskit {
  id: string;
  user_id: string;
  artist_name: string;
  real_name: string | null;
  city: string | null;
  country: string | null;
  genres: string[];
  bio: string | null;
  photo_url: string | null;
  photo_urls: string[];
  logo_urls: string[];
  socials: PresskitSocial[];
  mixes: PresskitMix[];
  links: PresskitLink[];
  published: boolean;
  created_at: string;
  updated_at: string;
}
