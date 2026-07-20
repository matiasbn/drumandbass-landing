// Sesiones simuladas para probar en local los flujos que dependen de Google.
//
// El descuento Junglist tiene cinco estados según quién mira, y verificarlos a
// mano exige crear cuentas reales, inscribirlas y borrarlas. Con esto se cambia
// de perfil con un click.
//
// SEGURIDAD: solo desarrollo. En producción `MOCK_AUTH_ENABLED` es false, las
// ramas mock quedan como código muerto (y el bundler las elimina del cliente),
// así que no hay forma de suplantar a nadie. En prod el flujo es estricto: la
// identidad sale siempre de la sesión real de Supabase.
//
// No hace falta variable de entorno: mientras no elijas un perfil no hay cookie
// y todo funciona con tu sesión real. El mock solo entra cuando lo pides.
//
// NEXT_PUBLIC_PROD_SIM=1 lo apaga también en local (ver lib/devFlags).

import { DEV_TOOLS_ENABLED } from './devFlags';

export const MOCK_AUTH_ENABLED = DEV_TOOLS_ENABLED;

/** Cookie donde vive el perfil elegido. Legible por cliente y servidor. */
export const MOCK_COOKIE = 'dnb_mock_persona';

export type MockPersona = 'anon' | 'user' | 'junglist_new' | 'junglist_old' | 'dj';

export interface MockPersonaDef {
  key: MockPersona;
  label: string;
  email: string | null;
  /** Si está en junglists o pk_profiles. */
  isJunglist: boolean;
  /** Si se registró DESPUÉS de fijarse el cupón (⇒ junglist nuevo). */
  registeredAfterCoupon: boolean;
  desc: string;
}

export const MOCK_PERSONAS: MockPersonaDef[] = [
  {
    key: 'anon',
    label: 'Anónimo',
    email: null,
    isJunglist: false,
    registeredAfterCoupon: false,
    desc: 'Sin sesión. Debe ver la puerta.',
  },
  {
    key: 'user',
    label: 'Con sesión, no junglist',
    email: 'user@test.dev',
    isJunglist: false,
    registeredAfterCoupon: false,
    desc: 'Cuenta sin registro de junglist. Puerta solo si hay cupón para nuevos.',
  },
  {
    key: 'junglist_new',
    label: 'Junglist nuevo',
    email: 'nuevo@test.dev',
    isJunglist: true,
    registeredAfterCoupon: true,
    desc: 'Se inscribió después de fijarse el cupón. Le toca el código de nuevos.',
  },
  {
    key: 'junglist_old',
    label: 'Junglist antiguo',
    email: 'antiguo@test.dev',
    isJunglist: true,
    registeredAfterCoupon: false,
    desc: 'Ya era junglist. Le toca el código de ya registrados.',
  },
  {
    key: 'dj',
    label: 'DJ (presskit)',
    email: 'dj@test.dev',
    isJunglist: true,
    registeredAfterCoupon: false,
    desc: 'Un DJ es siempre junglist, y cuenta como antiguo.',
  },
];

export function findPersona(key: string | undefined | null): MockPersonaDef | null {
  if (!key) return null;
  return MOCK_PERSONAS.find(p => p.key === key) ?? null;
}

/**
 * Valor de cookie que significa "usa la sesión REAL de Google" (la lógica de
 * prod, en local). Es donde pruebas admin: entras con tu cuenta real y la RLS
 * te deja escribir. Todo lo demás es un perfil ficticio.
 */
export const SOCIAL = 'social';

/** Identidad activa en dev: un perfil ficticio, o 'social' (sesión real). */
export type ActiveIdentity = MockPersonaDef | typeof SOCIAL;

/**
 * Resuelve la identidad desde el valor de cookie. Sin cookie ⇒ Anónimo: en dev
 * el default es ficticio, la sesión real es opt-in ('social').
 */
export function resolveIdentity(raw: string | undefined | null): ActiveIdentity {
  if (raw === SOCIAL) return SOCIAL;
  return findPersona(raw) ?? MOCK_PERSONAS[0]; // MOCK_PERSONAS[0] === anon
}

/** Lee el valor crudo de la cookie desde el navegador. */
export function readMockCookie(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${MOCK_COOKIE}=`))
    ?.split('=')[1];
}

/**
 * Identidad activa leída desde el navegador. `null` solo si el modo mock está
 * apagado (prod, o PROD_SIM). En dev siempre hay identidad (Anónimo por default).
 */
export function readMockPersona(): ActiveIdentity | null {
  if (!MOCK_AUTH_ENABLED) return null;
  return resolveIdentity(readMockCookie());
}

/**
 * Qué cupón le corresponde a un perfil simulado, dados los códigos reales del
 * evento. Réplica de la función SQL get_event_coupon: cada segmento lee SOLO su
 * columna, sin fallback entre segmentos.
 */
export function mockCouponFor(
  persona: MockPersonaDef,
  couponNew: string | null,
  couponExisting: string | null
): { code: string; kind: 'new' | 'existing' } | null {
  if (!persona.isJunglist) return null;
  if (persona.registeredAfterCoupon) {
    return couponNew ? { code: couponNew, kind: 'new' } : null;
  }
  return couponExisting ? { code: couponExisting, kind: 'existing' } : null;
}
