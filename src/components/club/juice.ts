// SUBIDÓN — sistema de juice (§4): trauma-shake cuadrático, kick de cámara y bus
// de eventos de feedback para el HUD. TODO en refs/objetos planos — cero React.
//
// Consumidores:
//  - ThirdPersonCamera: sampleJuice() por frame (aplica shake+kick al offset VISUAL,
//    nunca a la posición simulada).
//  - CrosshairHUD: lee `hud` por rAF (cooldown, combo, carga de granada, hitmarkers).
//  - DamageOverlay: registra onHypeBumpRef para el flash dorado "<X> te energizó".
//
// Productores (interfaz para WS-1/integración — llamadas puntuales por evento):
//  - notifyShotFired() al disparar (Projectiles ya lo llama al detectar el disparo local)
//  - notifyHit('normal'|'beat'|'air'|'bump') por cada impacto confirmado
//  - notifyCombo(hits, mult) al cambiar el combo (0,1 al expirar)
//  - notifyGrenadeCharge(c) con c∈[0,1] mientras carga, -1 al soltar/cancelar
//  - notifyHypeBump(nombre) al recibir un hype-bump de otro jugador
//  - addTrauma(TUNING.juice.traumaHypeDrop / traumaClubDrop) en drops (WS-1)

import { TUNING } from './tuning';
import { qualityRef } from './quality';
import { playHitTick, playKickDrum, playDing, playChime } from './sounds';

const J = TUNING.juice;
const SHAKE_KEY = 'dnb_club_shake';

const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

// ---------------------------------------------------------------------------
// Toggle de shake (SettingsModal lo cablea — WS-3)
// ---------------------------------------------------------------------------

let shakeEnabled = true;
if (typeof window !== 'undefined') {
  shakeEnabled = window.localStorage.getItem(SHAKE_KEY) !== '0';
}

export function setShakeEnabled(on: boolean): void {
  shakeEnabled = on;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(SHAKE_KEY, on ? '1' : '0');
  }
}

export function isShakeEnabled(): boolean {
  return shakeEnabled;
}

// ---------------------------------------------------------------------------
// Trauma-shake (shake = trauma², decay lineal 1.8/s, cap 1.0) + kick de cámara
// ---------------------------------------------------------------------------

const MAX_SHAKE_OFFSET = 0.12; // u de desplazamiento máximo
const MAX_SHAKE_ROLL = (1 * Math.PI) / 180; // 1° de roll máximo
const KICK_BACK = 0.06; // u de retroceso del kick
const KICK_PITCH_RAD = (J.kickPitchDeg * Math.PI) / 180;

const juiceState = {
  trauma: 0,
  kickAt: -1e12, // ms del último kick
};

/** Suma trauma (cap 1.0). El shake resultante es trauma² — golpes chicos casi no mueven. */
export function addTrauma(amount: number): void {
  juiceState.trauma = Math.min(1, juiceState.trauma + amount);
}

/** Kick de cámara del disparo: pitch +0.6°, retroceso 0.06u, recover 120ms ease-out */
export function addKick(): void {
  juiceState.kickAt = nowMs();
}

export interface JuiceSample {
  /** Desplazamiento de shake en espacio local de cámara (u) */
  offX: number;
  offY: number;
  /** Roll de shake (rad) */
  roll: number;
  /** Pitch del kick (rad, positivo = cámara sube) */
  kickPitchRad: number;
  /** Retroceso del kick a lo largo del eje de vista (u) */
  kickBack: number;
}

// Muestra reutilizada — cero allocations por frame
const _sample: JuiceSample = { offX: 0, offY: 0, roll: 0, kickPitchRad: 0, kickBack: 0 };

// Pseudo-ruido suave 1D: suma de senos inconmensurables (determinista, sin allocs)
function smoothNoise(t: number, seed: number): number {
  return Math.sin(t * 31.7 + seed) * 0.6 + Math.sin(t * 47.3 + seed * 2.3) * 0.4;
}

/**
 * Muestrea shake + kick y decae el trauma. Llamar UNA vez por frame (ThirdPersonCamera).
 * Devuelve siempre el mismo objeto (no retener la referencia entre frames).
 */
export function sampleJuice(dtS: number): JuiceSample {
  // Decay del trauma siempre (aunque el shake esté apagado, no debe acumularse)
  juiceState.trauma = Math.max(0, juiceState.trauma - J.traumaDecayPerS * dtS);

  // Shake off: por toggle propio o por calidad BAJA (WS-3)
  if (!shakeEnabled || qualityRef.current === 'baja') {
    _sample.offX = 0;
    _sample.offY = 0;
    _sample.roll = 0;
    _sample.kickPitchRad = 0;
    _sample.kickBack = 0;
    return _sample;
  }

  const t = nowMs() / 1000;
  const s = juiceState.trauma * juiceState.trauma; // cuadrático: sutil abajo, violento arriba
  _sample.offX = MAX_SHAKE_OFFSET * s * smoothNoise(t, 0.9);
  _sample.offY = MAX_SHAKE_OFFSET * s * smoothNoise(t, 4.1);
  _sample.roll = MAX_SHAKE_ROLL * s * smoothNoise(t, 7.7);

  // Kick: aplica entero al instante y recupera en 120ms con ease-out
  const p = (nowMs() - juiceState.kickAt) / J.kickRecoverMs;
  const k = p >= 1 ? 0 : (1 - p) * (1 - p);
  _sample.kickPitchRad = KICK_PITCH_RAD * k;
  _sample.kickBack = KICK_BACK * k;

  return _sample;
}

// ---------------------------------------------------------------------------
// Bus de HUD — estado caliente que CrosshairHUD lee por rAF
// ---------------------------------------------------------------------------

/**
 * Distancia EXTRA de cámara (u). Durante el CLUB DROP se sube para que la
 * cámara se aleje y se aprecie el espectáculo completo; ThirdPersonCamera
 * interpola hacia este valor. Se lee por frame, sin re-renders.
 */
export const cameraZoom = { extra: 0 };

export function setCameraExtraDistance(d: number): void {
  cameraZoom.extra = d;
}

export type HitKind = 'normal' | 'beat' | 'air' | 'bump';

export const hud = {
  /** performance.now() del último disparo local (para el crosshair de cooldown) */
  lastShotAt: -1e12,
  shotCooldownMs: TUNING.arma.shotCooldownMs,
  /** Carga de granada ∈ [0,1] mientras se mantiene click derecho; -1 = no cargando */
  grenadeCharge: -1,
  /** Estado del combo (lo escribe WS-1 vía notifyCombo) */
  combo: { hits: 0, mult: 1, until: 0 },
  /** Cola de hitmarkers pendientes — CrosshairHUD la consume */
  hitQueue: [] as HitKind[],
  /** Epoch ms hasta el que hay un VIP en la pista (0 = ninguno) — banner con
   *  countdown del HUD (§4, M7). Lo escribe HealthContext. */
  vipUntilEpoch: 0,
};

/** Disparo local efectuado: reinicia el crosshair de cooldown y da el kick de cámara. */
export function notifyShotFired(): void {
  hud.lastShotAt = nowMs();
  addKick();
}

/** Carga de granada: c ∈ [0,1] por frame mientras carga; -1 al soltar/cancelar. */
export function notifyGrenadeCharge(charge: number): void {
  hud.grenadeCharge = charge;
}

/** Combo actualizado (WS-1): reinicia la barra de decay de 4s. (0,1) al expirar. */
export function notifyCombo(hits: number, mult: number): void {
  hud.combo.hits = hits;
  hud.combo.mult = mult;
  hud.combo.until = hits > 0 ? nowMs() + TUNING.combo.ventanaS * 1000 : 0;
}

/**
 * Impacto confirmado: hitmarker (X / estrella / dorado), trauma y sonido en un solo punto.
 * 'normal' = hit a NPC · 'beat' = BEAT-SHOT · 'air' = AIRSHOT · 'bump' = hype-bump.
 */
export function notifyHit(kind: HitKind = 'normal'): void {
  if (hud.hitQueue.length < 8) hud.hitQueue.push(kind);
  addTrauma(kind === 'bump' ? 0.1 : J.traumaHit);
  if (kind === 'bump') {
    playChime();
  } else {
    playHitTick(hud.combo.hits);
    if (kind === 'beat') playKickDrum();
    if (kind === 'air') playDing();
  }
}

/** Color del crosshair/tracer según multiplicador: rosa → cian → dorado (M10) */
export function comboColor(mult: number): string {
  if (mult >= 4) return '#ffd700';
  if (mult >= 2) return '#00ccff';
  return '#ff0055';
}

// ---------------------------------------------------------------------------
// Hype-bump entre jugadores — DamageOverlay registra el handler
// ---------------------------------------------------------------------------

export const onHypeBumpRef: { current: ((fromName: string) => void) | null } = { current: null };

/** Otro jugador te energizó: flash dorado + chime + hitmarker bump (§5). */
export function notifyHypeBump(fromName: string): void {
  notifyHit('bump');
  onHypeBumpRef.current?.(fromName);
}
