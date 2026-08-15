// Rider técnico ESTRUCTURADO del presskit. Un rider de DJ suele tener VARIAS
// configuraciones de setup (club, alternativo/fallback, festival, b2b, etc.),
// cada una con sus equipos. Se guarda como JSON en `presskits.rider` (text).
// Compat: rider viejo (config única a nivel raíz, o texto plano) se migra a un
// setup / a las notas generales al parsear.

export interface RiderSetup {
  name?: string; // "Setup club", "Alternativo", "Festival"…
  // Un setup es EXCLUYENTE: o "reproductores + mixer" (players/mixer) o un
  // controlador all-in-one (controller). Nunca ambos — cleanSetup lo garantiza.
  players?: { model: string; quantity: number };
  mixer?: string;
  // Controlador all-in-one: SIN nombre ni cantidad. En el presskit se numeran
  // secuencialmente ("Controlador 1", "Controlador 2"…) — ver riderDisplay.
  controller?: { model: string };
  monitors?: number;
  extras?: string[];
  notes?: string;
}

export interface RiderData {
  setups: RiderSetup[];
  notes?: string; // notas generales (aplican a todos los setups)
}

// Modelos reales de club (CDJs/media players + tornamesas). Pioneer/AlphaTheta
// es el estándar de la escena; se incluyen alternativos y varias tornas.
export const PLAYER_MODELS = [
  // Pioneer / AlphaTheta CDJ
  'Pioneer CDJ-3000',
  'Pioneer CDJ-2000NXS2',
  'Pioneer CDJ-2000NXS',
  'Pioneer CDJ-2000',
  'Pioneer CDJ-900NXS',
  'Pioneer CDJ-900',
  'Pioneer XDJ-1000MK2',
  'Pioneer XDJ-1000',
  'Pioneer XDJ-700',
  // Denon
  'Denon DJ SC6000 Prime',
  'Denon DJ SC6000M Prime',
  'Denon DJ SC5000 Prime',
  // Tornamesas
  'Technics SL-1200MK7',
  'Technics SL-1210MK7',
  'Technics SL-1200MK2',
  'Technics SL-1200MK5',
  'Technics SL-1210MK5',
  'Pioneer PLX-1000',
  'Reloop RP-8000 MK2',
  'Reloop RP-7000 MK2',
  'Audio-Technica AT-LP140XP',
  'Otro',
];
export const MIXER_MODELS = [
  // Pioneer / AlphaTheta DJM
  'Pioneer DJM-A9',
  'Pioneer DJM-V10',
  'Pioneer DJM-V10-LF',
  'Pioneer DJM-900NXS2',
  'Pioneer DJM-900NXS',
  'Pioneer DJM-800',
  'Pioneer DJM-750MK2',
  'Pioneer DJM-450',
  'Pioneer DJM-250MK2',
  // Allen & Heath
  'Allen & Heath Xone:96',
  'Allen & Heath Xone:92',
  'Allen & Heath Xone:PX5',
  'Allen & Heath Xone:43',
  'Allen & Heath Xone:23',
  // Rane / Denon
  'Rane Seventy',
  'Rane Seventy-Two MKII',
  'Rane MP2015',
  'Denon DJ X1850 Prime',
  'Denon DJ X1800 Prime',
  'Otro',
];

// Controladores all-in-one (reemplazan reproductores + mixer). Estándar de la
// escena: Pioneer/AlphaTheta DDJ/XDJ, Denon Prime, Traktor, RANE, Numark.
export const CONTROLLER_MODELS = [
  // Pioneer / AlphaTheta
  'Pioneer DDJ-FLX10',
  'Pioneer DDJ-FLX6',
  'Pioneer DDJ-FLX4',
  'Pioneer DDJ-1000',
  'Pioneer DDJ-1000SRT',
  'Pioneer DDJ-REV7',
  'Pioneer DDJ-REV5',
  'Pioneer DDJ-REV1',
  'Pioneer DDJ-800',
  'Pioneer DDJ-400',
  'Pioneer XDJ-XZ',
  'Pioneer XDJ-RX3',
  'Pioneer XDJ-RR',
  'AlphaTheta OPUS-QUAD',
  // Denon DJ
  'Denon DJ Prime 4+',
  'Denon DJ Prime 4',
  'Denon DJ Prime 2',
  'Denon DJ SC Live 4',
  'Denon DJ SC Live 2',
  'Denon DJ Prime GO',
  // Native Instruments
  'Traktor Kontrol S4 MK3',
  'Traktor Kontrol S8',
  'Traktor Kontrol S2 MK3',
  // RANE / Numark
  'RANE ONE',
  'RANE FOUR',
  'Numark Mixstream Pro+',
  'Otro',
];

export function setupIsEmpty(s: RiderSetup | null | undefined): boolean {
  if (!s) return true;
  return (
    !s.players?.model &&
    !s.mixer &&
    !s.controller?.model &&
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
  // Exclusividad: un controlador all-in-one reemplaza reproductores + mixer.
  // El controlador NO lleva nombre (se numera al mostrarse); solo los setups de
  // reproductores conservan su nombre opcional.
  if (s.controller?.model) {
    clean.controller = { model: s.controller.model };
  } else {
    if (s.name?.trim()) clean.name = s.name.trim();
    if (s.players?.model) clean.players = { model: s.players.model, quantity: Math.max(1, s.players.quantity || 1) };
    if (s.mixer) clean.mixer = s.mixer;
  }
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
  if (s.controller?.model) {
    // El encabezado "Controlador N" lo pone riderDisplay; aquí solo el modelo.
    rows.push({ label: 'Modelo', value: s.controller.model });
  } else {
    if (s.players?.model) rows.push({ label: 'Reproductores', value: `${s.players.quantity || 1}× ${s.players.model}` });
    if (s.mixer) rows.push({ label: 'Mixer', value: s.mixer });
  }
  if (s.monitors) rows.push({ label: 'Monitores de booth', value: String(s.monitors) });
  if (s.extras && s.extras.length) rows.push({ label: 'Extras', value: s.extras.join(', ') });
  return rows;
}

export function isControllerSetup(s: RiderSetup): boolean {
  return !!s.controller?.model;
}

// Setups listos para mostrar, con encabezado resuelto: los controladores se
// numeran secuencialmente ("Controlador 1/2/3…"); los setups de reproductores
// usan su nombre (o "Setup N"). Descarta los vacíos (sin equipos ni notas).
export interface RiderDisplayItem {
  name: string; // encabezado del card
  rows: { label: string; value: string }[];
  notes?: string;
  isController: boolean;
}

export function riderDisplay(d: RiderData): RiderDisplayItem[] {
  const items: RiderDisplayItem[] = [];
  let ctrl = 0;
  let plain = 0;
  for (const s of d.setups || []) {
    const rows = setupRows(s);
    if (rows.length === 0 && !s.notes) continue;
    if (isControllerSetup(s)) {
      ctrl += 1;
      items.push({ name: `Controlador ${ctrl}`, rows, notes: s.notes, isController: true });
    } else {
      plain += 1;
      items.push({ name: s.name || `Setup ${plain}`, rows, notes: s.notes, isController: false });
    }
  }
  return items;
}
