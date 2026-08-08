// Rider técnico ESTRUCTURADO del presskit. Un rider de DJ estándar cubre:
// reproductores, mixer, monitores de booth, extras/conexiones y notas.
// Se guarda como JSON en la columna `presskits.rider` (text). Si un presskit
// viejo tuviera texto plano, se trata como "notas" (compat).

export interface RiderData {
  players?: { model: string; quantity: number };
  mixer?: string;
  monitors?: number;
  extras?: string[];
  notes?: string;
}

// Modelos reales estándar en clubes (Pioneer/AlphaTheta es el estándar de la
// escena). "Otro" para cualquier caso especial (va en notas).
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

export function riderIsEmpty(d: RiderData | null | undefined): boolean {
  if (!d) return true;
  return (
    !d.players?.model &&
    !d.mixer &&
    !d.monitors &&
    !(d.extras && d.extras.length) &&
    !(d.notes && d.notes.trim())
  );
}

export function parseRider(raw: string | null | undefined): RiderData {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw);
    if (o && typeof o === 'object' && !Array.isArray(o)) return o as RiderData;
  } catch {
    // Rider viejo en texto plano → lo mostramos como notas.
    return { notes: raw };
  }
  return {};
}

export function serializeRider(d: RiderData): string | null {
  const clean: RiderData = {};
  if (d.players?.model) clean.players = { model: d.players.model, quantity: Math.max(1, d.players.quantity || 1) };
  if (d.mixer) clean.mixer = d.mixer;
  if (d.monitors && d.monitors > 0) clean.monitors = d.monitors;
  if (d.extras && d.extras.length) clean.extras = d.extras;
  if (d.notes && d.notes.trim()) clean.notes = d.notes.trim();
  return riderIsEmpty(clean) ? null : JSON.stringify(clean);
}

// Filas para mostrar el rider en la página pública / admin.
export function riderRows(d: RiderData): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (d.players?.model) rows.push({ label: 'Reproductores', value: `${d.players.quantity || 1}× ${d.players.model}` });
  if (d.mixer) rows.push({ label: 'Mixer', value: d.mixer });
  if (d.monitors) rows.push({ label: 'Monitores de booth', value: String(d.monitors) });
  if (d.extras && d.extras.length) rows.push({ label: 'Extras', value: d.extras.join(', ') });
  return rows;
}
