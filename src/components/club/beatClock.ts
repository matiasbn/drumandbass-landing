// Beat clock 174 BPM (M2) — fuente única de ritmo del club sobre performance.now().
// Strobes, láseres y el BEAT-SHOT se sincronizan con ESTE reloj (no con el audio del
// stream: CORS impide analizarlo — es el groove del club, no el de la canción).

import { TUNING } from './tuning';

/** Período de un beat en ms (174 BPM ≈ 344.8ms) */
export const BEAT_PERIOD_MS = 60000 / TUNING.beat.bpm;

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// Ancla del reloj: primer load del módulo en el cliente
const anchorMs = nowMs();

/** Fase del beat ∈ [0,1): 0 = golpe, 0.5 = contratiempo. */
export function getBeatPhase(t: number = nowMs()): number {
  const phase = ((t - anchorMs) % BEAT_PERIOD_MS) / BEAT_PERIOD_MS;
  return phase < 0 ? phase + 1 : phase;
}

/**
 * Distancia con signo (ms) al beat más cercano.
 * Negativa = antes del beat, positiva = después. Rango: (−período/2, período/2].
 */
export function msFromBeat(t: number = nowMs()): number {
  const phase = getBeatPhase(t);
  const ms = phase * BEAT_PERIOD_MS;
  return ms > BEAT_PERIOD_MS / 2 ? ms - BEAT_PERIOD_MS : ms;
}

/** true si t cae dentro de la ventana de beat-shot (±80ms del beat). */
export function isOnBeat(t: number = nowMs()): boolean {
  return Math.abs(msFromBeat(t)) <= TUNING.beat.windowMs;
}

/** ms que faltan para el próximo beat (útil para risers/anticipación visual). */
export function msToNextBeat(t: number = nowMs()): number {
  return (1 - getBeatPhase(t)) * BEAT_PERIOD_MS;
}

/**
 * isOnBeat para timestamps de Date.now() (p.ej. `Projectile.birth`).
 * Convierte epoch ms → reloj performance.now() vía timeOrigin, para poder
 * evaluar el BEAT-SHOT en el instante exacto del disparo (M2).
 */
export function isOnBeatEpoch(epochMs: number): boolean {
  const origin = typeof performance !== 'undefined' ? performance.timeOrigin : 0;
  return isOnBeat(epochMs - origin);
}
