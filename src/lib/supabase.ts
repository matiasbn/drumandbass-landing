import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials not configured. Auth and chat will not work.');
}

// Singleton del cliente de browser. Crear varias instancias de GoTrueClient hace que
// getUser()/getSession() se cuelguen por contención del lock (Web Locks API). Memoizar
// garantiza una sola instancia compartida por toda la app.
// Helper concreto (sin genéricos) para que ReturnType infiera el tipo real del cliente.
const makeBrowserClient = () =>
  createBrowserClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder'
  );

let browserClient: ReturnType<typeof makeBrowserClient> | null = null;

export function createClient() {
  if (!browserClient) browserClient = makeBrowserClient();
  return browserClient;
}

// Legacy export for backwards compatibility
export const supabase = createClient();

export interface ChatMessage {
  id: string;
  username: string;
  message: string;
  created_at: string;
  video_id?: string;
}

export interface Raver {
  id: string;
  name: string | null;
  last_name: string | null;
  email: string;
  instagram: string | null;
  created_at: string;
}

// Junglist: auto-registro voluntario vía Google. Todos los campos obligatorios.
// Un DJ (pk_profiles) se considera junglist por unión de emails, no vive aquí.
export interface Junglist {
  id: string;
  user_id: string;
  name: string;
  last_name: string;
  email: string;
  instagram: string;
  created_at: string;
  updated_at: string;
}

export interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  username: string;
  email: string;
  avatar_url?: string;
  player_color?: string;
  face_type?: number;
  costume_id?: string;
  accessory_id?: string;
  score?: number;
  high_score?: number;
  is_admin?: boolean;
  created_at: string;
  updated_at: string;
}
