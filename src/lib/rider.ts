// Rider técnico ESTRUCTURADO del presskit. Un rider de DJ suele tener VARIAS
// configuraciones de setup (club, alternativo/fallback, festival, b2b, etc.),
// cada una con sus equipos. Se guarda como JSON en `presskits.rider` (text).
// Compat: rider viejo (config única a nivel raíz, o texto plano) se migra a un
// setup / a las notas generales al parsear.

export interface RiderSetup {
  name?: string; // "Setup club", "Alternativo", "Festival"…
  players?: { model: string; quantity: number };
  mixer?: string;
  monitors?: number;
  extras?: string[];
  notes?: string;
}

export interface RiderData {
  setups: RiderSetup[];
  notes?: string; // notas generales (aplican a todos los setups)
}

// Modelos reales estándar en clubes (Pioneer/AlphaTheta es el estándar).
export const PLAYER_MODELS = [
  'Pioneer CDJ-3000',
  'Pioneer CDJ-2000NXS2',
  'Pioneer XDJ-1000MK2',
  'Turntables Technics SL-1200',
  'Otro',
];
export const MIXER_MODELS = [
  'Pioneer DJM-A9',
  'Pioneer DJM-900NXS2',
  'Pioneer DJM-V10',
  'Pioneer DJM-750MK2',
  'Allen & Heath Xone',
  'Otro',
];
export const RIDER_EXTRAS = [
  'Cables RCA',
  'USB',
  'Soporte para laptop',
  'DI box',
  'Micrófono',
  'Tomas de corriente (mín. 3)',
];

export function setupIsEmpty(s: RiderSetup | null | undefined): boolean {
  if (!s) return true;
  return (
    !s.players?.model &&
    !s.mixer &&
    !s.monitors &&
    !(s.extras && s.extras.length) &&
    !(s.notes && s.notes.trim())
  );
}

export function riderIsEmpty(d: RiderData | null | undefined): boolean {
  if (!d) return true;
  const hasSetup = (d.setups || []).some((s) => !setupIsEmpty(s));
  return !hasSetup && !(d.notes && d.notes.trim());
}

export function emptySetup(): RiderSetup {
  return { players: { model: '', quantity: 2 }, extras: [] };
}

// Normaliza cualquier valor guardado a { setups, notes }.
export function parseRider(raw: string | null | undefined): RiderData {
  if (!raw) return { setups: [] };
  let o: unknown;
  try {
    o = JSON.parse(raw);
  } catch {
    // Rider viejo en texto plano → notas generales.
    return { setups: [], notes: raw };
  }
  if (!o || typeof o !== 'object' || Array.isArray(o)) return { setups: [] };
  const obj = o as Record<string, unknown>;
  if (Array.isArray(obj.setups)) {
    return { setups: obj.setups as RiderSetup[], notes: typeof obj.notes === 'string' ? obj.notes : undefined };
  }
  // Compat: config única a nivel raíz (players/mixer/…) → un solo setup.
  const single = obj as RiderSetup;
  if (!setupIsEmpty(single)) {
    const { notes, ...rest } = single;
    return { setups: [rest], notes };
  }
  return { setups: [], notes: typeof obj.notes === 'string' ? obj.notes : undefined };
}

function cleanSetup(s: RiderSetup): RiderSetup | null {
  const clean: RiderSetup = {};
  if (s.name?.trim()) clean.name = s.name.trim();
  if (s.players?.model) clean.players = { model: s.players.model, quantity: Math.max(1, s.players.quantity || 1) };
  if (s.mixer) clean.mixer = s.mixer;
  if (s.monitors && s.monitors > 0) clean.monitors = s.monitors;
  if (s.extras && s.extras.length) clean.extras = s.extras;
  if (s.notes?.trim()) clean.notes = s.notes.trim();
  // Un setup con solo nombre (sin equipos ni notas) no cuenta.
  return setupIsEmpty(clean) ? null : clean;
}

export function serializeRider(d: RiderData): string | null {
  const setups = (d.setups || []).map(cleanSetup).filter((s): s is RiderSetup => s !== null);
  const out: RiderData = { setups };
  if (d.notes?.trim()) out.notes = d.notes.trim();
  return riderIsEmpty(out) ? null : JSON.stringify(out);
}

// Filas de un setup para mostrarlo.
export function setupRows(s: RiderSetup): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (s.players?.model) rows.push({ label: 'Reproductores', value: `${s.players.quantity || 1}× ${s.players.model}` });
  if (s.mixer) rows.push({ label: 'Mixer', value: s.mixer });
  if (s.monitors) rows.push({ label: 'Monitores de booth', value: String(s.monitors) });
  if (s.extras && s.extras.length) rows.push({ label: 'Extras', value: s.extras.join(', ') });
  return rows;
}
