import type {
  Presskit,
  PresskitSocial,
  PresskitMix,
  PresskitLink,
  PresskitCustomSection,
} from './presskit';

// Data editable del presskit que arma el admin (mismo shape que el body de
// /api/pk, sin `published`). Se guarda en pending_presskits.data (jsonb) y, al
// reclamarse, se vuelca al presskit real del DJ.
export interface PendingPresskitData {
  artist_name: string;
  real_name?: string | null;
  city?: string | null;
  country?: string | null;
  genres: string[];
  bio?: string | null;
  custom_sections: PresskitCustomSection[];
  rider?: string | null;
  photo_urls: string[];
  logo_urls: string[];
  socials: PresskitSocial[];
  mixes: PresskitMix[];
  links: PresskitLink[];
}

export interface PendingPresskit {
  id: string;
  claim_token: string;
  email: string;
  slug: string;
  data: PendingPresskitData;
  status: 'pending' | 'claimed' | 'cancelled';
  created_by: string | null;
  claimed_user_id: string | null;
  claimed_at: string | null;
  invited_at: string | null;
  created_at: string;
  updated_at: string;
}

// Mapea la data editable del pendiente al shape Presskit, para renderizar el
// perfil COMPLETO (con PresskitView) en la vista previa admin, la página de
// claim y la vista pública pre-publicación. id/user_id/timestamps son placeholder.
export function pendingToPresskit(d: Partial<PendingPresskitData>): Presskit {
  return {
    id: 'preview',
    user_id: 'preview',
    artist_name: d.artist_name || '',
    real_name: d.real_name ?? null,
    city: d.city ?? null,
    country: d.country ?? null,
    genres: d.genres || [],
    bio: d.bio ?? null,
    custom_sections: d.custom_sections || [],
    rider: d.rider ?? null,
    photo_url: null,
    photo_urls: d.photo_urls || [],
    logo_urls: d.logo_urls || [],
    socials: d.socials || [],
    mixes: d.mixes || [],
    links: d.links || [],
    published: false,
    created_at: '',
    updated_at: '',
  };
}

export function emptyPendingData(): PendingPresskitData {
  return {
    artist_name: '',
    real_name: '',
    city: '',
    country: '',
    genres: [],
    bio: '',
    custom_sections: [],
    rider: null,
    photo_urls: [],
    logo_urls: [],
    socials: [],
    mixes: [],
    links: [],
  };
}
