'use client';

// SUBIDÓN — hype de NPC (M3), VIP (M7), airshot (M8), beat-shot (M2, atribución
// por FIFO de disparos), buff de baile (M11, flags) y hype-bump (§5).
// El nombre del archivo NO se renombra (evitar churn de imports).
//
// Compatibilidad: PlayerDancer sigue llamando addNpcHype(id, getHypeAmount(tipo))
// — el "amount" legacy solo distingue disparo/granada; la cifra real de hype se
// calcula aquí con TUNING (beat, ventanas de drop, spotlight). El estado por NPC
// vive en el Map de refs npcHypeRef; InstancedDancers lo lee por frame y llama
// tickNpcs(dt) una vez por frame (decay, VIP, timers — sin setTimeouts sueltos).

import React, { createContext, useContext, useRef, useCallback, useEffect, ReactNode } from 'react';
import * as THREE from 'three';
import { TUNING } from './tuning';
import { isOnBeatEpoch } from './beatClock';
import { playerState } from './playerState';
import { useScore } from './ScoreContext';
import { useEnergy } from './EnergyContext';
import { useNpcPositions } from './NpcPositionsContext';
import { useProjectiles } from './ProjectileContext';
import { useMultiplayer, ClubFxPayload } from './MultiplayerContext';
import { hud, notifyHit, notifyHypeBump, addTrauma } from './juice';
import { playBoom, playFanfare, playRiser, playChord } from './sounds';

const MAX_HYPE = 100;
const HYPE_DECAY = 3; // decay del hype del JUGADOR local (per second, sin cambio)
const CELEBRATION_MS = 3000; // baile de celebración del HYPE DROP (reutiliza el ciclo hyped)

/**
 * Último disparo del jugador local — flag para el juice de WS-2
 * (tracer/muzzle dorados del BEAT-SHOT). Se escribe en registerPlayerShot.
 */
export const lastPlayerShot = { atMs: 0, beat: false, kind: 'shot' as 'shot' | 'grenade' };

export interface HypeState {
  hype: number;
  maxHype: number;
  /** true durante el baile de celebración del HYPE DROP (3s) */
  hyped: boolean;
  // ── SUBIDÓN (M3/M7/M11 + juice que consume WS-2) ──
  /** APAGADO (<30): pose celular + color desaturado (lo pinta InstancedDancers) */
  apagado: boolean;
  /** epoch ms — inmunidad post HYPE DROP (fuerza rotación de objetivos) */
  immuneUntil: number;
  /** epoch ms — VIP dorado activo hasta este instante (0 = no VIP) */
  vipUntil: number;
  /** hits acumulados al VIP (3 → captura) */
  vipHits: number;
  /** epoch ms — buff de baile activo (decay a la mitad) */
  buffUntil: number;
  /** epoch ms del último hit del jugador (squash de WS-2 deriva su progreso) */
  lastHitAt: number;
  /** epoch ms — flash blanco emissive del hit (80ms) */
  hitFlashUntil: number;
  /** epoch ms — hit-stop del reloj de animación de esa instancia (40ms) */
  animFreezeUntil: number;
  /** Intensidad restante del squash del hit ∈ [0,1] (1 al impactar → 0 en squashMs).
   *  La escribe tickNpcs; WS-2 la consume para el squash 1.25x/0.75y. */
  squashT: number;
  /** epoch ms de inicio de la celebración del HYPE DROP */
  celebrationStart: number;
}

interface HealthContextType {
  /** Hype del jugador local (ref, sin re-renders) */
  localHypeRef: React.MutableRefObject<HypeState>;
  /** Mapa de hype por NPC — InstancedDancers lo lee por frame */
  npcHypeRef: React.MutableRefObject<Map<string, HypeState>>;
  /** Suma hype al jugador local */
  addHype: (amount: number) => void;
  /**
   * LEGACY (PlayerDancer): aplica un hit del jugador a un NPC.
   * `amount` solo distingue el tipo (getHypeAmount): la cifra real sale de TUNING.
   * Devuelve true si el NPC llegó a 100 (HYPE DROP).
   */
  addNpcHype: (npcId: string, amount: number) => boolean;
  /** Cantidad base legada por tipo de proyectil (solo discrimina shot/granada) */
  getHypeAmount: (type: 'shot' | 'grenade') => number;
  /** ¿El jugador local está en hype drop? */
  isHyped: () => boolean;
  /** Decay del hype local — lo llama PlayerDancer desde useFrame */
  decayHype: (dt: number) => void;
  /** Callback ref: hit de hype local (overlay) */
  onHypeRef: React.MutableRefObject<(() => void) | null>;
  /** Callback ref: hype drop local (overlay) */
  onHypeDropRef: React.MutableRefObject<(() => void) | null>;
  // ── API nueva SUBIDÓN ──
  /** Registra un disparo local (FIFO de atribución del BEAT-SHOT y carga de granada) */
  registerPlayerShot: (kind: 'shot' | 'grenade', birthMs: number, charge: number) => void;
  /** Tick por frame (lo llama InstancedDancers): decay NPC, celebraciones, VIP */
  tickNpcs: (dtS: number) => void;
  /** Crea (si no existe) el estado del NPC con hype de spawn 30–60 */
  ensureNpc: (npcId: string) => HypeState;
  /** Buff de baile (M11): decay a la mitad por 10s */
  applyDanceBuff: (npcId: string) => void;
  /** Especial Confetti (M12): todos los APAGADOS suben a `toHype` */
  reviveApagados: (toHype: number) => void;
  /** Especial Onda (M12): hype plano sin multiplicadores ni puntos */
  addNpcHypeFlat: (npcId: string, amount: number) => void;
  /** Especial Spotlight (M12): hits +50% hype durante `durationS` */
  activateSpotlight: (durationS: number) => void;
  /** Hype-bump (§5): hit a otro jugador — +8 ambos, cooldown 5s por pareja.
   *  PENDIENTE de call site en PlayerDancer (directHits no-NPC). */
  notifyPlayerHit: (playerId: string) => void;
  /** Callback ref: VIP capturado (SpecialEffects lanza el confetti) */
  onVipCapturedRef: React.MutableRefObject<((npcId: string) => void) | null>;
}

const HealthContext = createContext<HealthContextType | null>(null);

const makeHype = (spawnHype: number): HypeState => ({
  hype: spawnHype,
  maxHype: MAX_HYPE,
  hyped: false,
  apagado: spawnHype < TUNING.npc.apagadoUmbral,
  immuneUntil: 0,
  vipUntil: 0,
  vipHits: 0,
  buffUntil: 0,
  lastHitAt: 0,
  hitFlashUntil: 0,
  animFreezeUntil: 0,
  squashT: 0,
  celebrationStart: 0,
});

const _arcUp = new THREE.Vector3(0, 0.5, 0);
// Temporales de los FX remotos (shoot/throwGrenade clonan internamente)
const _fxPos = new THREE.Vector3();
const _fxDir = new THREE.Vector3();

/**
 * Invierte el arco que throwGrenade aplica al dir (dir.y += 0.5; normalize),
 * para re-lanzar granadas REMOTAS por el mismo path sin aplicar el arco dos veces.
 * Si d' = normalize(d + u) con u = (0, 0.5, 0) y |d| = 1, entonces d = m·d' − u
 * donde m resuelve m² − m·d'y − 0.75 = 0 (raíz positiva). Muta y devuelve `dir`.
 */
const undoGrenadeArc = (dir: THREE.Vector3): THREE.Vector3 => {
  const m = (dir.y + Math.sqrt(dir.y * dir.y + 3)) / 2;
  return dir.multiplyScalar(m).sub(_arcUp).normalize();
};

const spawnHype = () =>
  TUNING.npc.spawnHypeMin + Math.random() * (TUNING.npc.spawnHypeMax - TUNING.npc.spawnHypeMin);

export const HealthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { scoreAction } = useScore();
  const { addEnergy, notifyShot, hypeMultRef, gloriaActiveRef, chillRef, subscribe } = useEnergy();
  const { positions: npcPositions } = useNpcPositions();
  const { projectilesRef, shoot, throwGrenade } = useProjectiles();
  const { username, sendClubFx, subscribeClubFx } = useMultiplayer();

  const localHypeRef = useRef<HypeState>(makeHype(0));
  const npcHypeRef = useRef<Map<string, HypeState>>(new Map());
  const onHypeRef = useRef<(() => void) | null>(null);
  const onHypeDropRef = useRef<(() => void) | null>(null);
  const onVipCapturedRef = useRef<((npcId: string) => void) | null>(null);
  const hypeDropTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Identidades inestables → refs (el value del contexto se mantiene estable)
  const scoreActionRef = useRef(scoreAction);
  scoreActionRef.current = scoreAction;
  const usernameRef = useRef(username);
  usernameRef.current = username;
  const sendClubFxRef = useRef(sendClubFx);
  sendClubFxRef.current = sendClubFx;

  // FIFO de disparos locales en vuelo (atribución beat-shot / carga de granada).
  // Un hit consume la cabeza; las entradas caducan por vida del proyectil.
  const shotFifoRef = useRef<{ birth: number; beat: boolean }[]>([]);
  const grenadeFifoRef = useRef<{ birth: number; charge: number }[]>([]);

  // Lote de granada por microtask: un blast golpea N NPCs en el mismo tick
  // síncrono → un solo popup +8×N y el MULTI-HYPE xN (M9)
  const grenadeBatchRef = useRef<{ ids: string[]; scheduled: boolean }>({ ids: [], scheduled: false });

  // Spotlight (M12): hits +50% hype hasta este epoch ms
  const spotlightUntilRef = useRef(0);

  // Hype-bump: cooldown por pareja (§5)
  const bumpCooldownRef = useRef<Map<string, number>>(new Map());

  // Scheduler del VIP (M7)
  const nextVipAtRef = useRef(0);

  // Espejo local del cooldown del airshot (solo para elegir el hitmarker estrella;
  // los PUNTOS los limita el COOLDOWNS de ScoreContext con la misma ventana)
  const airshotMarkAtRef = useRef(0);

  // Escáner de proyectiles nuevos (id monotónico de ProjectileContext): detecta los
  // disparos LOCALES sin tocar PlayerDancer — atribución de beat-shot, timer del
  // modo chill y broadcast §5 salen de aquí (tickNpcs corre una vez por frame).
  const lastScannedProjIdRef = useRef(-1);

  // ── Hype local del jugador (sin cambios de comportamiento) ──
  const triggerHypeDrop = useCallback(() => {
    const h = localHypeRef.current;
    h.hyped = true;
    h.hype = MAX_HYPE;
    onHypeDropRef.current?.();
    if (hypeDropTimerRef.current) clearTimeout(hypeDropTimerRef.current);
    hypeDropTimerRef.current = setTimeout(() => {
      h.hyped = false;
      h.hype = 0;
      hypeDropTimerRef.current = null;
    }, 3000);
  }, []);

  const addHype = useCallback((amount: number) => {
    const h = localHypeRef.current;
    if (h.hyped) return;
    h.hype = Math.min(MAX_HYPE, h.hype + amount);
    onHypeRef.current?.();
    if (h.hype >= MAX_HYPE) {
      triggerHypeDrop();
    }
  }, [triggerHypeDrop]);

  const isHyped = useCallback(() => localHypeRef.current.hyped, []);

  const decayHype = useCallback((dt: number) => {
    const h = localHypeRef.current;
    if (h.hyped || h.hype <= 0) return;
    h.hype = Math.max(0, h.hype - HYPE_DECAY * dt);
  }, []);

  // ── NPCs ──
  const ensureNpc = useCallback((npcId: string): HypeState => {
    let h = npcHypeRef.current.get(npcId);
    if (!h) {
      h = makeHype(spawnHype());
      npcHypeRef.current.set(npcId, h);
    }
    return h;
  }, []);

  const registerPlayerShot = useCallback((kind: 'shot' | 'grenade', birthMs: number, charge: number) => {
    if (kind === 'shot') {
      const beat = isOnBeatEpoch(birthMs);
      shotFifoRef.current.push({ birth: birthMs, beat });
      lastPlayerShot.atMs = birthMs;
      lastPlayerShot.beat = beat;
      lastPlayerShot.kind = 'shot';
    } else {
      grenadeFifoRef.current.push({ birth: birthMs, charge });
      lastPlayerShot.atMs = birthMs;
      lastPlayerShot.beat = false;
      lastPlayerShot.kind = 'grenade';
    }
  }, []);

  /** Consume la cabeza viva del FIFO de disparos; false si no hay (beat desconocido) */
  const popShotBeat = useCallback((now: number): boolean => {
    const fifo = shotFifoRef.current;
    const maxAge = (TUNING.arma.shotLifeS + 0.3) * 1000;
    while (fifo.length > 0 && now - fifo[0].birth > maxAge) fifo.shift();
    const head = fifo.shift();
    return head?.beat ?? false;
  }, []);

  /** Lee (sin consumir) la carga de la granada en vuelo más antigua */
  const peekGrenadeCharge = useCallback((now: number): number => {
    const fifo = grenadeFifoRef.current;
    while (fifo.length > 0 && now - fifo[0].birth > 4500) fifo.shift();
    return fifo.length > 0 ? fifo[0].charge : 0;
  }, []);

  /** Flush del lote de granada (microtask): puntos por NPC + MULTI-HYPE xN */
  const flushGrenadeBatch = useCallback(() => {
    const batch = grenadeBatchRef.current;
    batch.scheduled = false;
    const n = batch.ids.length;
    batch.ids.length = 0;
    if (n === 0) return;
    // Consumir la granada atribuida a este blast
    grenadeFifoRef.current.shift();
    scoreActionRef.current('grenadeNpc', 'Granada', n);
    notifyHit('normal'); // un hitmarker por blast (la explosión ya trae boom+trauma)
    if (n >= TUNING.granada.multiHypeDesde) {
      const extras = n - (TUNING.granada.multiHypeDesde - 1);
      scoreActionRef.current('multiHype', `MULTI-HYPE x${n}`, extras);
      playChord(); // tabla §4: MULTI-HYPE suena a acorde corto
    }
  }, []);

  /** Distancia jugador→NPC (airshot M8); Infinity si el NPC no reporta posición */
  const distToNpc = useCallback((npcId: string): number => {
    const pos = npcPositions.current.get(npcId);
    if (!pos) return Infinity;
    const p = playerState.position;
    const dx = pos.x - p.x;
    const dy = pos.y - p.y;
    const dz = pos.z - p.z;
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, [npcPositions]);

  /** Núcleo del hit del jugador sobre un NPC. Devuelve true si hubo HYPE DROP. */
  const applyPlayerHit = useCallback((npcId: string, kind: 'shot' | 'grenade'): boolean => {
    const h = ensureNpc(npcId);
    const now = Date.now();

    // Celebrando o inmune post-drop → sin efecto (rotación de objetivos)
    if (h.hyped || now < h.immuneUntil) return false;

    const beat = kind === 'shot' ? popShotBeat(now) : false;

    // Juice para WS-2 (flash 80ms + hit-stop 40ms + squash desde lastHitAt)
    h.lastHitAt = now;
    h.hitFlashUntil = now + 80;
    h.animFreezeUntil = now + TUNING.juice.hitStopMs;

    // ── VIP (M7): los hits cuentan para la captura; su hype queda congelado ──
    if (now < h.vipUntil) {
      h.vipHits++;
      scoreActionRef.current(beat ? 'beatShot' : 'hitNpc', beat ? '¡RITMO!' : 'VIP');
      notifyHit(beat ? 'beat' : 'normal');
      if (h.vipHits >= TUNING.vip.hitsNecesarios) {
        h.vipUntil = 0;
        h.vipHits = 0;
        hud.vipUntilEpoch = 0; // banner del HUD fuera (§4)
        scoreActionRef.current('vip', 'VIP');
        addEnergy(TUNING.energia.porVip, 'vip');
        addTrauma(0.3); // tabla de juice §4: VIP capturado
        playFanfare();
        onVipCapturedRef.current?.(npcId);
      }
      return false;
    }

    // ── Hype del hit: base (beat 22 / normal 15 / granada 12→20 por carga)
    //    × ventana de drop (x2/x3) × spotlight (+50%) ──
    let base: number;
    if (kind === 'shot') {
      base = beat ? TUNING.npc.hypeBeat : TUNING.npc.hypeHit;
    } else {
      const charge = peekGrenadeCharge(now);
      base = TUNING.npc.hypeGrenade + (TUNING.npc.hypeGrenadeFull - TUNING.npc.hypeGrenade) * charge;
    }
    let amount = base * hypeMultRef.current;
    if (now < spotlightUntilRef.current) amount *= 1.5;

    // Durante la GLORIA todos están a 100: el hit puntúa pero no hay drops
    const gloria = gloriaActiveRef.current;
    if (!gloria) {
      h.hype = Math.min(MAX_HYPE, h.hype + amount);
      h.apagado = h.hype < TUNING.npc.apagadoUmbral;
    }

    // ── Puntos ──
    if (kind === 'shot') {
      scoreActionRef.current(beat ? 'beatShot' : 'hitNpc', beat ? '¡RITMO!' : 'Hype');
      // Airshot (M8): en el aire o a >8u del objetivo → bonus flat (cooldown 2s)
      let air = false;
      if (playerState.airborne || distToNpc(npcId) > TUNING.airshot.distanciaMin) {
        scoreActionRef.current('airshot', 'AIRSHOT');
        // Hitmarker estrella solo cuando el bonus realmente está disponible
        if (now - airshotMarkAtRef.current >= TUNING.airshot.cooldownS * 1000) {
          airshotMarkAtRef.current = now;
          air = true;
        }
      }
      notifyHit(air ? 'air' : beat ? 'beat' : 'normal');
    } else {
      // Granada: lote por microtask → un popup +8×N y MULTI-HYPE xN
      const batch = grenadeBatchRef.current;
      batch.ids.push(npcId);
      if (!batch.scheduled) {
        batch.scheduled = true;
        queueMicrotask(flushGrenadeBatch);
      }
    }

    // ── HYPE DROP (M3): celebración 3s, +15×combo, +10 energía, reset a 40 ──
    if (!gloria && h.hype >= MAX_HYPE) {
      h.hyped = true;
      h.hype = MAX_HYPE;
      h.apagado = false;
      h.celebrationStart = now;
      scoreActionRef.current('hypeDropNpc', 'HYPE DROP');
      addEnergy(TUNING.energia.porHypeDrop, 'hypeDrop');
      addTrauma(TUNING.juice.traumaHypeDrop);
      playBoom('sub'); // boom de bajo del HYPE DROP (§4)
      if (usernameRef.current) {
        sendClubFxRef.current({ kind: 'hype_drop', from: usernameRef.current });
      }
      return true;
    }
    return false;
  }, [ensureNpc, popShotBeat, peekGrenadeCharge, flushGrenadeBatch, distToNpc,
      addEnergy, hypeMultRef, gloriaActiveRef]);

  // LEGACY: PlayerDancer pasa getHypeAmount('shot'|'grenade') — solo discrimina el tipo
  const addNpcHype = useCallback((npcId: string, amount: number): boolean => {
    const kind: 'shot' | 'grenade' = amount === TUNING.npc.hypeGrenade ? 'grenade' : 'shot';
    return applyPlayerHit(npcId, kind);
  }, [applyPlayerHit]);

  const getHypeAmount = useCallback((type: 'shot' | 'grenade'): number => {
    return type === 'shot' ? TUNING.npc.hypeHit : TUNING.npc.hypeGrenade;
  }, []);

  /** Tick por frame desde InstancedDancers: decay, fin de celebraciones, VIP */
  const tickNpcs = useCallback((dtS: number) => {
    const now = Date.now();
    const gloria = gloriaActiveRef.current;
    const chill = chillRef.current;
    const map = npcHypeRef.current;

    // ── Escáner de disparos locales nuevos (id monotónico) — sin tocar PlayerDancer:
    //    atribución del BEAT-SHOT (M2), timer del modo chill (M13) y broadcast §5 ──
    const projs = projectilesRef.current;
    let maxProjId = lastScannedProjIdRef.current;
    for (let i = 0; i < projs.length; i++) {
      const p = projs[i];
      if (p.id <= lastScannedProjIdRef.current) continue;
      if (p.id > maxProjId) maxProjId = p.id;
      const me = usernameRef.current;
      if (!me || p.shooterId !== me) continue; // NPC o remoto: no es nuestro
      if (p.type === 'shot') {
        registerPlayerShot('shot', p.birth, 0);
        sendClubFxRef.current({
          kind: 'shot',
          from: me,
          pos: [p.position.x, p.position.y, p.position.z],
          dir: [p.direction.x, p.direction.y, p.direction.z],
          color: p.color,
        });
      } else {
        // Carga reconstruida desde la velocidad (velMin→velMax ↔ carga 0→1)
        const { velMin, velMax } = TUNING.granada;
        const charge = Math.max(0, Math.min(1, (p.speed - velMin) / (velMax - velMin)));
        registerPlayerShot('grenade', p.birth, charge);
        sendClubFxRef.current({
          kind: 'grenade',
          from: me,
          pos: [p.position.x, p.position.y, p.position.z],
          // dir POST-arco (throwGrenade ya lo modificó); el receptor lo invierte
          dir: [p.direction.x, p.direction.y, p.direction.z],
          color: p.color,
          speed: p.speed,
          charge,
        });
      }
      notifyShot(); // resetea el timer del modo chill (M13)
    }
    lastScannedProjIdRef.current = maxProjId;

    map.forEach((h) => {
      // Progreso del squash del hit (lo consume WS-2): 1 al impactar → 0 en squashMs
      h.squashT = h.lastHitAt > 0
        ? Math.max(0, 1 - (now - h.lastHitAt) / TUNING.juice.squashMs)
        : 0;
      if (h.hyped) {
        // Fin del baile de celebración → reset a 40 (nunca Sísifo) + inmune 5s
        if (now - h.celebrationStart >= CELEBRATION_MS) {
          h.hyped = false;
          h.hype = TUNING.npc.dropResetTo;
          h.immuneUntil = now + TUNING.npc.dropInmuneS * 1000;
          h.apagado = false;
        }
        return;
      }
      if (gloria) {
        h.hype = MAX_HYPE; // GLORIA: todos a 100 bailando
        h.apagado = false;
        return;
      }
      // VIP caducado sin captura → escapó (el banner del HUD se oculta solo
      // al pasar hud.vipUntilEpoch — no hace falta limpiarlo aquí)
      if (h.vipUntil !== 0 && now >= h.vipUntil) {
        h.vipUntil = 0;
        h.vipHits = 0;
      }
      // Decay −4/s (a la mitad con buff de baile; pausado en chill y durante VIP)
      if (!chill && h.vipUntil === 0) {
        const rate = TUNING.npc.decayPerS * (now < h.buffUntil ? TUNING.baile.buffDecayMult : 1);
        h.hype = Math.max(0, h.hype - rate * dtS);
      }
      h.apagado = h.hype < TUNING.npc.apagadoUmbral;
    });

    // Scheduler del VIP (M7): cada 45–60s, si hay candidatos
    if (nextVipAtRef.current === 0) {
      nextVipAtRef.current = now + (TUNING.vip.cadaS[0] + Math.random() * (TUNING.vip.cadaS[1] - TUNING.vip.cadaS[0])) * 1000;
    }
    if (now >= nextVipAtRef.current && !gloria && map.size > 0) {
      spawnVip(now);
      nextVipAtRef.current = now + (TUNING.vip.cadaS[0] + Math.random() * (TUNING.vip.cadaS[1] - TUNING.vip.cadaS[0])) * 1000;
    }
  }, [gloriaActiveRef, chillRef, projectilesRef, registerPlayerShot, notifyShot]);

  /** Elige un NPC no celebrando/no inmune/no VIP y lo tiñe de dorado 10s */
  const spawnVip = (now: number) => {
    const candidates: HypeState[] = [];
    npcHypeRef.current.forEach((h) => {
      if (!h.hyped && h.vipUntil === 0 && now >= h.immuneUntil) candidates.push(h);
    });
    if (candidates.length === 0) return;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    pick.vipUntil = now + TUNING.vip.duraS * 1000;
    pick.vipHits = 0;
    pick.apagado = false;
    hud.vipUntilEpoch = pick.vipUntil; // banner con countdown en el HUD (§4)
    playRiser(1.2); // sub-riser de aparición del VIP (§4)
  };

  const applyDanceBuff = useCallback((npcId: string) => {
    const h = npcHypeRef.current.get(npcId);
    if (!h) return;
    h.buffUntil = Date.now() + TUNING.baile.buffDuraS * 1000;
  }, []);

  const reviveApagados = useCallback((toHype: number) => {
    npcHypeRef.current.forEach((h) => {
      if (!h.hyped && h.apagado) {
        h.hype = Math.max(h.hype, toHype);
        h.apagado = h.hype < TUNING.npc.apagadoUmbral;
      }
    });
  }, []);

  const addNpcHypeFlat = useCallback((npcId: string, amount: number) => {
    const h = ensureNpc(npcId);
    const now = Date.now();
    if (h.hyped || now < h.immuneUntil || gloriaActiveRef.current) return;
    // Sin drop desde especiales: clamp a 99 para que el remate sea del jugador
    h.hype = Math.min(MAX_HYPE - 1, h.hype + amount);
    h.apagado = h.hype < TUNING.npc.apagadoUmbral;
  }, [ensureNpc, gloriaActiveRef]);

  const activateSpotlight = useCallback((durationS: number) => {
    spotlightUntilRef.current = Date.now() + durationS * 1000;
  }, []);

  // Hype-bump (§5): nunca daña — +8 ambos, cooldown 5s por pareja
  const notifyPlayerHit = useCallback((playerId: string) => {
    const now = Date.now();
    const last = bumpCooldownRef.current.get(playerId) ?? 0;
    if (now - last < TUNING.multi.hypeBumpCooldownS * 1000) return;
    bumpCooldownRef.current.set(playerId, now);
    scoreActionRef.current('hypeBump', `¡Energizaste a ${playerId}!`);
    notifyHit('bump');
    if (usernameRef.current) {
      sendClubFxRef.current({ kind: 'bump', from: usernameRef.current, to: playerId });
    }
  }, []);

  // ── FX remotos (§5): disparos/granadas ajenos por el MISMO pool + hype-bump ──
  useEffect(() => {
    const unsub = subscribeClubFx((fx: ClubFxPayload) => {
      if (fx.kind === 'shot') {
        // Cosmético: cada cliente simula la trayectoria localmente. checkHits solo
        // acredita hits del shooterId local, así que no hay doble conteo de hype.
        _fxPos.set(fx.pos[0], fx.pos[1], fx.pos[2]);
        _fxDir.set(fx.dir[0], fx.dir[1], fx.dir[2]);
        shoot(_fxPos, _fxDir, fx.from);
      } else if (fx.kind === 'grenade') {
        _fxPos.set(fx.pos[0], fx.pos[1], fx.pos[2]);
        _fxDir.set(fx.dir[0], fx.dir[1], fx.dir[2]);
        throwGrenade(_fxPos, undoGrenadeArc(_fxDir), fx.from, fx.speed);
      } else if (fx.kind === 'bump') {
        // Lado receptor del hype-bump: "<X> te energizó" (+8, cooldown de pareja)
        if (fx.to !== usernameRef.current) return;
        const now = Date.now();
        const last = bumpCooldownRef.current.get(fx.from) ?? 0;
        if (now - last < TUNING.multi.hypeBumpCooldownS * 1000) return;
        bumpCooldownRef.current.set(fx.from, now);
        scoreActionRef.current('hypeBump', `¡${fx.from} te energizó!`);
        notifyHypeBump(fx.from); // flash dorado del DamageOverlay + chime (WS-2)
      }
    });
    return unsub;
  }, [subscribeClubFx, shoot, throwGrenade]);

  // GLORIA (M5): al empezar todos a 100; al terminar 60±10 y sin inmunidades
  useEffect(() => {
    const unsub = subscribe((ev) => {
      if (ev.type === 'gloriaStart') {
        npcHypeRef.current.forEach((h) => {
          h.hyped = false;
          h.hype = MAX_HYPE;
          h.apagado = false;
        });
      } else if (ev.type === 'gloriaEnd') {
        npcHypeRef.current.forEach((h) => {
          h.hype = 60 + (Math.random() * 20 - 10);
          h.apagado = false;
          h.immuneUntil = 0;
        });
      } else if (ev.type === 'ventanaStart') {
        // VIP garantizado durante la ventana (M6)
        spawnVip(Date.now());
      }
    });
    return unsub;
  }, [subscribe]);

  // Valor estable del contexto — refs y callbacks estables
  const contextValue = useRef<HealthContextType>({
    localHypeRef,
    npcHypeRef,
    addHype,
    addNpcHype,
    getHypeAmount,
    isHyped,
    decayHype,
    onHypeRef,
    onHypeDropRef,
    registerPlayerShot,
    tickNpcs,
    ensureNpc,
    applyDanceBuff,
    reviveApagados,
    addNpcHypeFlat,
    activateSpotlight,
    notifyPlayerHit,
    onVipCapturedRef,
  }).current;

  return (
    <HealthContext.Provider value={contextValue}>
      {children}
    </HealthContext.Provider>
  );
};

export const useHealth = () => {
  const ctx = useContext(HealthContext);
  if (!ctx) throw new Error('useHealth must be used within HealthProvider');
  return ctx;
};

export { MAX_HYPE };
