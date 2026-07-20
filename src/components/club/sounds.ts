// SUBIDÓN — sonido 100% WebAudio sintetizado (§4 del diseño). Cero assets externos.
// AudioContext lazy: se crea/resume en el primer gesto del usuario (pointerdown/keydown).
// Master gain bajo (~0.5) para no pelear con el stream del DJ. Toggle persistido en
// localStorage — SettingsModal (WS-3) lo cablea vía setSoundEnabled/isSoundEnabled.

const STORAGE_KEY = 'dnb_club_sound';
const MASTER_GAIN = 0.5;

let muted = false;
if (typeof window !== 'undefined') {
  muted = window.localStorage.getItem(STORAGE_KEY) === '0';
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

function initCtx(): void {
  if (ctx || typeof window === 'undefined') return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : MASTER_GAIN;
  master.connect(ctx.destination);
  // Buffer de ruido blanco de 1s, reutilizado por todos los transitorios
  noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
}

// Desbloqueo en el primer gesto (política de autoplay de los navegadores)
if (typeof window !== 'undefined') {
  const unlock = () => {
    initCtx();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
  };
  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock);
}

/** Contexto listo para sonar, o null si está muteado / sin soporte / SSR */
function ready(): AudioContext | null {
  if (muted) return null;
  if (!ctx) initCtx();
  if (!ctx || !master) return null;
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Oscilador corto con envolvente exponencial — helper de todos los sonidos */
function blip(
  c: AudioContext,
  type: OscillatorType,
  freqStart: number,
  freqEnd: number,
  startAt: number,
  durS: number,
  gain: number,
): void {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, freqStart), startAt);
  if (freqEnd !== freqStart) {
    o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), startAt + durS);
  }
  const g = c.createGain();
  g.gain.setValueAtTime(gain, startAt);
  g.gain.exponentialRampToValueAtTime(0.001, startAt + durS);
  o.connect(g);
  g.connect(master!);
  o.start(startAt);
  o.stop(startAt + durS + 0.02);
}

/** Ráfaga de ruido filtrado — transitorios (chispa, click de kick, riser) */
function noiseBurst(
  c: AudioContext,
  startAt: number,
  durS: number,
  gain: number,
  filterType: BiquadFilterType,
  filterFreq: number,
): void {
  if (!noiseBuffer) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer;
  const f = c.createBiquadFilter();
  f.type = filterType;
  f.frequency.value = filterFreq;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, startAt);
  g.gain.exponentialRampToValueAtTime(0.001, startAt + durS);
  src.connect(f);
  f.connect(g);
  g.connect(master!);
  src.start(startAt);
  src.stop(startAt + durS + 0.02);
}

// ---------------------------------------------------------------------------
// Tabla §4 — un sonido por evento
// ---------------------------------------------------------------------------

/** Disparo: "pew" (osc triangular + ruido) con pitch aleatorio ±10% */
export function playPew(gainScale = 1): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const f = 950 * (0.9 + Math.random() * 0.2);
  blip(c, 'triangle', f, f * 0.22, t, 0.13, 0.22 * gainScale);
  noiseBurst(c, t, 0.04, 0.08 * gainScale, 'highpass', 2500);
}

/** Escala pentatónica mayor de C (C D E G A, dos octavas) — el combo se OYE */
const PENTATONIC = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.51, 1567.98, 1760.0];

/** Hit a NPC: tick que sube por la pentatónica con el combo + thump grave */
export function playHitTick(comboStep = 0): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const f = PENTATONIC[Math.max(0, Math.min(PENTATONIC.length - 1, comboStep))];
  blip(c, 'sine', f, f, t, 0.08, 0.28);
  blip(c, 'sine', 95, 60, t, 0.09, 0.22); // thump grave
}

/** BEAT-SHOT: kick de batería encima del pew */
export function playKickDrum(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  blip(c, 'sine', 160, 42, t, 0.16, 0.7);
  noiseBurst(c, t, 0.015, 0.15, 'highpass', 4000); // click de ataque
}

/** Boom de bajo: 'sub' = HYPE DROP (seno 60Hz pitch-drop) · 'medio' = granada */
export function playBoom(kind: 'sub' | 'medio' = 'sub'): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  if (kind === 'sub') {
    blip(c, 'sine', 62, 26, t, 0.6, 0.85);
  } else {
    blip(c, 'sine', 120, 38, t, 0.32, 0.55);
    noiseBurst(c, t, 0.18, 0.2, 'lowpass', 900);
  }
}

/** Bala muere en pared: tap seco */
export function playSparkTap(): void {
  const c = ready();
  if (!c) return;
  noiseBurst(c, c.currentTime, 0.035, 0.14, 'bandpass', 3200);
}

/** Riser 2s (DROP INMINENTE / VENTANA DE DROP) — sub-riser corto para el VIP */
export function playRiser(durS = 2): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(160, t);
  o.frequency.exponentialRampToValueAtTime(1300, t + durS);
  const g = c.createGain();
  g.gain.setValueAtTime(0.001, t);
  g.gain.exponentialRampToValueAtTime(0.18, t + durS);
  g.gain.exponentialRampToValueAtTime(0.001, t + durS + 0.08);
  o.connect(g);
  g.connect(master!);
  o.start(t);
  o.stop(t + durS + 0.1);
  noiseBurst(c, t, durS, 0.05, 'highpass', 1200);
}

/** Acorde corto (MULTI-HYPE / CLUB DROP) — C mayor con sub */
export function playChord(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  for (const f of [261.63, 329.63, 392.0, 523.25]) {
    blip(c, 'triangle', f, f, t, 0.5, 0.13);
  }
  blip(c, 'sine', 65.41, 65.41, t, 0.55, 0.3); // sub C2
}

/** Fanfarria corta (VIP capturado): arpegio ascendente */
export function playFanfare(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    blip(c, 'square', f, f, t + i * 0.09, i === notes.length - 1 ? 0.35 : 0.14, 0.1);
  });
}

/** Ding agudo (AIRSHOT) */
export function playDing(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  blip(c, 'sine', 1567.98, 1567.98, t, 0.25, 0.2);
  blip(c, 'sine', 2093.0, 2093.0, t + 0.02, 0.2, 0.1);
}

/** Chime doble (hype-bump entre jugadores) */
export function playChime(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  blip(c, 'sine', 1174.66, 1174.66, t, 0.22, 0.16);
  blip(c, 'sine', 1760.0, 1760.0, t + 0.09, 0.28, 0.16);
}

/** Tick sutil de UI (cooldown listo) */
export function playUiTick(): void {
  const c = ready();
  if (!c) return;
  blip(c, 'sine', 1800, 1800, c.currentTime, 0.03, 0.07);
}

/** Click seco (disparo en cooldown — nunca silencio) */
export function playDenied(): void {
  const c = ready();
  if (!c) return;
  blip(c, 'square', 140, 140, c.currentTime, 0.045, 0.1);
}

/** Zumbido grave breve (cruce de etapa hacia EL BAJÓN) */
export function playZumbido(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.value = 52;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 220;
  const g = c.createGain();
  g.gain.setValueAtTime(0.22, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  o.connect(f);
  f.connect(g);
  g.connect(master!);
  o.start(t);
  o.stop(t + 0.5);
}

/** Colchón armónico suave (GLORIA) — acorde largo con attack/release lentos */
export function playGloriaPad(): void {
  const c = ready();
  if (!c) return;
  const t = c.currentTime;
  for (const f of [261.63, 392.0, 523.25, 659.25]) {
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = f;
    const g = c.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.06, t + 0.6);
    g.gain.exponentialRampToValueAtTime(0.001, t + 3.0);
    o.connect(g);
    g.connect(master!);
    o.start(t);
    o.stop(t + 3.1);
  }
}

// ---------------------------------------------------------------------------
// Toggle de mute (SettingsModal lo cablea — WS-3)
// ---------------------------------------------------------------------------

export function setSoundEnabled(on: boolean): void {
  muted = !on;
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, on ? '1' : '0');
  }
  if (master) master.gain.value = muted ? 0 : MASTER_GAIN;
}

export function isSoundEnabled(): boolean {
  return !muted;
}

export function toggleSound(): boolean {
  setSoundEnabled(muted);
  return !muted;
}
