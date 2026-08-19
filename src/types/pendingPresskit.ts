import type {
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
