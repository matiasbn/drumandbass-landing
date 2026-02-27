import { SocialLink } from './types/types';
import { RiSoundcloudLine, RiInstagramLine, RiSpotifyLine, RiYoutubeLine } from '@remixicon/react';

export const LOGO_PATH = "/logo-con-bandera.png";

export const SOCIALS : Record<string, SocialLink> = {
    instagram: { platform: 'Instagram', url: 'https://www.instagram.com/drumandbasschile.cl/', icon: RiInstagramLine },
    soundcloud: { platform: 'SoundCloud', url: 'https://soundcloud.com/drum-and-bass-chile', icon: RiSoundcloudLine },
    spotify: { platform: 'Spotify', url: 'https://open.spotify.com/playlist/3tE3RqDoTGskv0DJjVFBNy?si=146371bb86e543b6&pt=c209f3cac82594b9b8c025320bf2d877', icon: RiSpotifyLine },
    youtube: { platform: 'YouTube', url: 'https://www.youtube.com/@drumandbasschile', icon: RiYoutubeLine },
  };

export const WHATSAPP_LINK = 'https://chat.whatsapp.com/GH1ZogYyOKTFqrV6s70U4R';

export const BASE_URL = 'https://www.drumandbasschile.cl';

export const TEAM = [
  { name: 'zeroday.dnb', instagram: 'https://www.instagram.com/zeroday.dnb/' },
  { name: 'killtrobeat', instagram: 'https://www.instagram.com/killtrobeat/' },
  { name: 'alangf', instagram: 'https://www.instagram.com/alangf/' },
];