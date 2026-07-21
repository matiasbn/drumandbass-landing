'use client';

import React, { useRef, useMemo, useEffect, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useNpcPositions } from '../NpcPositionsContext';
import { useProjectiles } from '../ProjectileContext';
import { useHealth } from '../HealthContext';
import { useEnergy } from '../EnergyContext';
import { playerState } from '../playerState';
import { TUNING } from '../tuning';
import { getSurfaceHeight } from './Platforms';
import { earthquakeActiveUntil } from './SpecialEffects';
import { makeRoundedUnitBox, getCharacterTexture } from './characterAssets';

// ─── NPC configuration ───────────────────────────────────────────────
const NPC_COUNT = 16;

const NPC_NAMES = [
  'Kiara', 'Dex', 'Zuri', 'Mako', 'Lyra', 'Riot', 'Nova', 'Blaze',
  'Jinx', 'Vega', 'Echo', 'Pulse', 'Nyx', 'Flux', 'Raze', 'Kira',
];

// Ids estables `npc-<nombre>` precomputados (cero allocs de string por frame)
const NPC_IDS = NPC_NAMES.map((n) => `npc-${n}`);

const COLORS: [string, string, string, string] = ['#ff0055', '#00ccff', '#00ff41', '#ff8800'];

const INIT_POSITIONS: [number, number, number][] = [
  [-10, 0, -8], [8, 0, 10], [-5, 0, 12], [12, 0, -3],
  [-12, 0, 5], [3, 0, -11], [10, 0, 8], [-8, 0, -10],
  [6, 0, -9], [-3, 0, 7], [11, 0, 3], [-9, 0, -2],
  [1, 0, -6], [-6, 0, 10], [9, 0, -7], [-11, 0, -5],
];

const ANIM_OFFSETS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5];
const ANIM_SPEEDS = [1.1, 0.9, 1.2, 0.85, 1.0, 1.15, 0.95, 1.05, 0.95, 1.1, 0.9, 1.05, 1.15, 0.85, 1.0, 0.9];

// ─── Constants ───────────────────────────────────────────────────────
const SHOOT_INTERVAL_MIN = 4;
const SHOOT_INTERVAL_MAX = 10;
const WANDER_BOUNDS = { minX: -17, maxX: 17, minZ: -17, maxZ: 17 };
const MOVE_SPEED = 1.15; // más ágiles (antes 0.5)
const ARRIVAL_THRESHOLD = 0.3;
const DANCE_COUNT = 4;
const DANCE_DURATION_MIN = 2;
const DANCE_DURATION_MAX = 5;
const IDLE_DURATION_MIN = 0.4; // menos tiempo parados → deambulan más
const IDLE_DURATION_MAX = 1.6;

// ─── Hype bar constants ──────────────────────────────────────────────
const BAR_WIDTH = 0.8;
const BAR_HEIGHT = 0.08;
const barCyan = new THREE.Color(0x00ccff);
const barPurple = new THREE.Color(0x9933ff);
const barGold = new THREE.Color(0xffdd00);
const barTmp = new THREE.Color();

// ─── Colores de estado (M3/M7/M11) — compartidos, cero allocs por frame ─
const colWhite = new THREE.Color(0xffffff); // flash del hit (80ms)
const colGold = new THREE.Color(0xffd700); // VIP dorado
const colApagado = new THREE.Color(0x8a7f95); // tono tenue del APAGADO (visible, no negro)
const colBuff = new THREE.Color(0xb0ffd0); // aura sutil del buff de baile
const colSkin = new THREE.Color(0xe0c4a8);
const colLegs = new THREE.Color(0x4a4658); // pantalón oscuro pero visible (no negro con basic mat)
const colTmp = new THREE.Color();
const colTmp2 = new THREE.Color();

// ─── Shared math objects (avoid GC) ─────────────────────────────────
const _mat4 = new THREE.Matrix4();
const _pos = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _euler = new THREE.Euler();
const _shootDir = new THREE.Vector3();
const _shootPos = new THREE.Vector3();

function pickRandomTarget() {
  return {
    x: WANDER_BOUNDS.minX + Math.random() * (WANDER_BOUNDS.maxX - WANDER_BOUNDS.minX),
    z: WANDER_BOUNDS.minZ + Math.random() * (WANDER_BOUNDS.maxZ - WANDER_BOUNDS.minZ),
  };
}

// ─── Per-NPC state stored in plain arrays ────────────────────────────
interface NpcState {
  posX: Float32Array;
  posZ: Float32Array;
  rotY: Float32Array;
  targetX: Float32Array;
  targetZ: Float32Array;
  waitTimer: Float32Array;
  danceMove: Uint8Array;
  danceTimer: Float32Array;
  isDancing: Uint8Array; // 0/1 bool
  spinStartRot: Float32Array;
  danceStartTime: Float32Array;
  shootTimer: Float32Array;
  hypeDropStart: Float32Array;
  wasHyped: Uint8Array; // 0/1 bool
  scaleVal: Float32Array; // current scale for hype animation
  /** Reloj de animación POR instancia (s): se congela en el hit-stop (M3/juice) */
  animClock: Float32Array;
}

function createNpcState(): NpcState {
  const state: NpcState = {
    posX: new Float32Array(NPC_COUNT),
    posZ: new Float32Array(NPC_COUNT),
    rotY: new Float32Array(NPC_COUNT),
    targetX: new Float32Array(NPC_COUNT),
    targetZ: new Float32Array(NPC_COUNT),
    waitTimer: new Float32Array(NPC_COUNT),
    danceMove: new Uint8Array(NPC_COUNT),
    danceTimer: new Float32Array(NPC_COUNT),
    isDancing: new Uint8Array(NPC_COUNT),
    spinStartRot: new Float32Array(NPC_COUNT),
    danceStartTime: new Float32Array(NPC_COUNT),
    shootTimer: new Float32Array(NPC_COUNT),
    hypeDropStart: new Float32Array(NPC_COUNT),
    wasHyped: new Uint8Array(NPC_COUNT),
    scaleVal: new Float32Array(NPC_COUNT),
    animClock: new Float32Array(NPC_COUNT),
  };

  for (let i = 0; i < NPC_COUNT; i++) {
    state.posX[i] = INIT_POSITIONS[i][0];
    state.posZ[i] = INIT_POSITIONS[i][2];
    state.rotY[i] = Math.atan2(-INIT_POSITIONS[i][0], -INIT_POSITIONS[i][2]);
    const t = pickRandomTarget();
    state.targetX[i] = t.x;
    state.targetZ[i] = t.z;
    state.danceTimer[i] = IDLE_DURATION_MIN + Math.random() * IDLE_DURATION_MAX;
    state.shootTimer[i] = SHOOT_INTERVAL_MIN + Math.random() * (SHOOT_INTERVAL_MAX - SHOOT_INTERVAL_MIN);
    state.scaleVal[i] = 1;
  }

  return state;
}

/**
 * Set an instance matrix from position, euler rotation, and scale.
 * Re-uses shared _mat4/_quat to avoid allocations.
 */
function setInstance(mesh: THREE.InstancedMesh, index: number, x: number, y: number, z: number, rx: number, ry: number, rz: number, sx: number, sy: number, sz: number) {
  _euler.set(rx, ry, rz);
  _quat.setFromEuler(_euler);
  _pos.set(x, y, z);
  _scale.set(sx, sy, sz);
  _mat4.compose(_pos, _quat, _scale);
  mesh.setMatrixAt(index, _mat4);
}

// ─── Component ───────────────────────────────────────────────────────
interface InstancedDancersProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const InstancedDancers: React.FC<InstancedDancersProps> = ({ isPlayingRef }) => {
  const { positions: npcPositions } = useNpcPositions();
  const { shoot } = useProjectiles();
  const { npcHypeRef, tickNpcs, ensureNpc, applyDanceBuff } = useHealth();
  const { gloriaActiveRef, stageRef: energyStageRef, subscribe } = useEnergy();
  const shootRef = useRef(shoot);
  shootRef.current = shoot;

  const stateRef = useRef<NpcState | null>(null);
  if (!stateRef.current) stateRef.current = createNpcState();

  const lastTimeRef = useRef(0);

  // CLUB DROP (M4): baile sincronizado 5s — reloj COMPARTIDO (epoch) entre los 16
  const syncDanceUntilRef = useRef(0);
  const syncDanceStartRef = useRef(0);

  useEffect(() => {
    const unsub = subscribe((ev) => {
      if (ev.type === 'clubDrop') {
        const now = Date.now();
        syncDanceStartRef.current = now;
        syncDanceUntilRef.current = now + 5000;
      }
    });
    return unsub;
  }, [subscribe]);

  // InstancedMesh refs — 6 body parts
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const headRef = useRef<THREE.InstancedMesh>(null);
  const leftArmRef = useRef<THREE.InstancedMesh>(null);
  const rightArmRef = useRef<THREE.InstancedMesh>(null);
  const leftLegRef = useRef<THREE.InstancedMesh>(null);
  const rightLegRef = useRef<THREE.InstancedMesh>(null);

  // Instanced hype bars (2 meshes: bg + fill)
  const barBgRef = useRef<THREE.InstancedMesh>(null);
  const barFillRef = useRef<THREE.InstancedMesh>(null);

  // Pre-compute instance colors
  const bodyColors = useMemo(() => {
    const arr = new Float32Array(NPC_COUNT * 3);
    for (let i = 0; i < NPC_COUNT; i++) {
      const c = new THREE.Color(COLORS[i % 4]);
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);

  // Variedad de tonos de piel entre los bots (antes todos el mismo beige).
  const headColors = useMemo(() => {
    const SKIN_TONES = [
      '#f2d3b6', '#e0c4a8', '#c99a70', '#a5734d',
      '#8a5a3c', '#6f4429', '#d9a679', '#f6c8a0',
    ];
    const arr = new Float32Array(NPC_COUNT * 3);
    const c = new THREE.Color();
    for (let i = 0; i < NPC_COUNT; i++) {
      c.set(SKIN_TONES[(i * 3 + 1) % SKIN_TONES.length]); // desalinea de la paleta de cuerpo
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);

  const legColors = useMemo(() => {
    const c = new THREE.Color('#4a4658');
    const arr = new Float32Array(NPC_COUNT * 3);
    for (let i = 0; i < NPC_COUNT; i++) {
      arr[i * 3] = c.r;
      arr[i * 3 + 1] = c.g;
      arr[i * 3 + 2] = c.b;
    }
    return arr;
  }, []);

  // Geometría redondeada compartida (menos cuadrada) y material siempre-visible.
  // meshBasicMaterial (sin luces) + textura: los NPCs no tienen emissive como el
  // jugador, así que dependían de las luces recortadas y salían oscuros. Con
  // basic el color de instancia (vívido) se ve SIEMPRE; la textura da forma y
  // detalle. toneMapped=false para que los neones no se apaguen con el tonemap.
  const roundedGeo = useMemo(() => makeRoundedUnitBox(0.14, 2), []);
  const charMat = useMemo(() => {
    const tex = getCharacterTexture();
    return new THREE.MeshBasicMaterial({ map: tex ?? undefined, toneMapped: false });
  }, []);
  useEffect(() => {
    return () => {
      roundedGeo.dispose();
      charMat.dispose();
    };
  }, [roundedGeo, charMat]);

  // Set instance colors once on mount
  const colorsSet = useRef(false);

  useFrame(({ clock, camera }) => {
    const s = stateRef.current!;
    const body = bodyRef.current;
    const head = headRef.current;
    const lArm = leftArmRef.current;
    const rArm = rightArmRef.current;
    const lLeg = leftLegRef.current;
    const rLeg = rightLegRef.current;
    const barBg = barBgRef.current;
    const barFill = barFillRef.current;

    if (!body || !head || !lArm || !rArm || !lLeg || !rLeg || !barBg || !barFill) return;

    // Set colors once. OJO: siempre con .slice() — los buffers se REESCRIBEN por
    // frame con los colores de estado (M3/M7) y `bodyColors` es la paleta base.
    if (!colorsSet.current) {
      body.instanceColor = new THREE.InstancedBufferAttribute(bodyColors.slice(), 3);
      head.instanceColor = new THREE.InstancedBufferAttribute(headColors.slice(), 3);
      lArm.instanceColor = new THREE.InstancedBufferAttribute(bodyColors.slice(), 3);
      rArm.instanceColor = new THREE.InstancedBufferAttribute(bodyColors.slice(), 3);
      lLeg.instanceColor = new THREE.InstancedBufferAttribute(legColors.slice(), 3);
      rLeg.instanceColor = new THREE.InstancedBufferAttribute(legColors.slice(), 3);
      colorsSet.current = true;
    }

    const elapsed = clock.getElapsedTime();
    const delta = elapsed - lastTimeRef.current;
    lastTimeRef.current = elapsed;
    const dt = Math.min(delta, 0.1);

    const isPlaying = isPlayingRef.current;

    // ── Tick de gameplay (M3/M7): decay, celebraciones, VIP, squash — 1 vez por frame ──
    tickNpcs(dt);

    const nowEpoch = Date.now();
    const gloria = gloriaActiveRef.current;
    const bajon = energyStageRef.current === 'bajon'; // EL BAJÓN: NPCs lentos, amplitud baja
    const syncDance = nowEpoch < syncDanceUntilRef.current; // CLUB DROP: baile sincronizado
    const syncDanceTime = (nowEpoch - syncDanceStartRef.current) / 1000;

    // Buff de baile (M11): ¿el jugador lleva ≥3s bailando?
    const perfNow = performance.now();
    const dancerBuffing = playerState.danceMove > 0 && playerState.dancingSince > 0 &&
      perfNow - playerState.dancingSince >= TUNING.baile.buffTrasS * 1000;
    const buffR2 = TUNING.baile.buffRadio * TUNING.baile.buffRadio;

    // Buffers de instanceColor (creados arriba en el primer frame)
    const bodyCol = body.instanceColor!;
    const headCol = head.instanceColor!;
    const lArmCol = lArm.instanceColor!;
    const rArmCol = rArm.instanceColor!;
    const lLegCol = lLeg.instanceColor!;
    const rLegCol = rLeg.instanceColor!;

    for (let i = 0; i < NPC_COUNT; i++) {
      const npcId = NPC_IDS[i];
      // Estado de hype del NPC (spawn 30–60 la primera vez) — M3
      const h = npcHypeRef.current.get(npcId) ?? ensureNpc(npcId);
      const npcHyped = h.hyped;
      const vip = h.vipUntil > nowEpoch; // M7: dorado, corre x2.5
      const apagado = h.apagado && !npcHyped && !vip; // M3: pose celular

      // Hit-stop (§4): congela SOLO el reloj de animación de esta instancia
      if (isPlaying && nowEpoch >= h.animFreezeUntil) {
        s.animClock[i] += dt;
      }
      const time = s.animClock[i] * ANIM_SPEEDS[i] + ANIM_OFFSETS[i];

      // ── Dance state machine (los estados de gameplay la fuerzan) ──
      if (vip || apagado) {
        // El VIP corre y el APAGADO mira el celular: ninguno baila
        if (s.isDancing[i]) {
          s.isDancing[i] = 0;
          s.danceMove[i] = 0;
          s.danceTimer[i] = IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
          const t = pickRandomTarget();
          s.targetX[i] = t.x;
          s.targetZ[i] = t.z;
          s.waitTimer[i] = 0;
        }
        if (vip && s.waitTimer[i] > 0.2) s.waitTimer[i] = 0.2; // el VIP no se detiene
      } else if (gloria && !s.isDancing[i]) {
        // GLORIA (M5): todos a 100 bailando
        s.isDancing[i] = 1;
        s.danceMove[i] = 1 + Math.floor(Math.random() * (DANCE_COUNT - 1));
        s.danceTimer[i] = DANCE_DURATION_MIN + Math.random() * (DANCE_DURATION_MAX - DANCE_DURATION_MIN);
        s.danceStartTime[i] = s.animClock[i];
        if (s.danceMove[i] === 2) s.spinStartRot[i] = s.rotY[i];
      } else {
        s.danceTimer[i] -= dt;
        if (s.danceTimer[i] <= 0) {
          if (s.isDancing[i]) {
            s.isDancing[i] = 0;
            s.danceMove[i] = 0;
            s.danceTimer[i] = IDLE_DURATION_MIN + Math.random() * (IDLE_DURATION_MAX - IDLE_DURATION_MIN);
            const t = pickRandomTarget();
            s.targetX[i] = t.x;
            s.targetZ[i] = t.z;
            s.waitTimer[i] = 0;
          } else {
            s.isDancing[i] = 1;
            s.danceMove[i] = 1 + Math.floor(Math.random() * (DANCE_COUNT - 1));
            s.danceTimer[i] = DANCE_DURATION_MIN + Math.random() * (DANCE_DURATION_MAX - DANCE_DURATION_MIN);
            s.danceStartTime[i] = s.animClock[i];
            if (s.danceMove[i] === 2) s.spinStartRot[i] = s.rotY[i];
          }
        }
      }

      // ── Wander ──
      // Velocidad por estado: VIP corre (x2.5), APAGADO arrastra los pies, BAJÓN lento
      const speedFactor = vip ? TUNING.vip.speedMult : apagado ? 0.5 : bajon ? 0.7 : 1;
      if (!s.isDancing[i]) {
        if (s.waitTimer[i] > 0) {
          s.waitTimer[i] -= dt;
          if (s.waitTimer[i] <= 0) {
            const t = pickRandomTarget();
            s.targetX[i] = t.x;
            s.targetZ[i] = t.z;
          }
        } else {
          const dx = s.targetX[i] - s.posX[i];
          const dz = s.targetZ[i] - s.posZ[i];
          const dist = Math.sqrt(dx * dx + dz * dz);
          if (dist < ARRIVAL_THRESHOLD) {
            s.waitTimer[i] = 0.2 + Math.random() * 0.8; // pausa corta → deambulan más
          } else {
            const speed = MOVE_SPEED * ANIM_SPEEDS[i] * speedFactor * dt;
            const step = Math.min(speed, dist);
            s.posX[i] += (dx / dist) * step;
            s.posZ[i] += (dz / dist) * step;
            const targetAngle = Math.atan2(dx, dz);
            let angleDiff = targetAngle - s.rotY[i];
            while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
            while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
            s.rotY[i] += angleDiff * Math.min(dt * 3, 1);
          }
        }
      }

      // ── Shooting (cosmético NPC↔NPC) — el apagado está mirando el celular ──
      if (!s.isDancing[i] && !apagado) {
        s.shootTimer[i] -= dt;
        if (s.shootTimer[i] <= 0) {
          const targets: { id: string; x: number; z: number }[] = [];
          npcPositions.current.forEach((pos, id) => {
            if (id !== npcId) targets.push({ id, x: pos.x, z: pos.z });
          });
          if (targets.length > 0) {
            const target = targets[Math.floor(Math.random() * targets.length)];
            const dx = target.x - s.posX[i];
            const dz = target.z - s.posZ[i];
            const dist = Math.sqrt(dx * dx + dz * dz);
            if (dist > 1) {
              _shootDir.set(dx / dist, 0, dz / dist);
              const surfY = getSurfaceHeight(s.posX[i], s.posZ[i]);
              _shootPos.set(s.posX[i] + _shootDir.x * 0.8, surfY + 1.2, s.posZ[i] + _shootDir.z * 0.8);
              shootRef.current(_shootPos, _shootDir, npcId);
            }
          }
          s.shootTimer[i] = SHOOT_INTERVAL_MIN + Math.random() * (SHOOT_INTERVAL_MAX - SHOOT_INTERVAL_MIN);
        }
      }

      // ── Position & hype ──
      const surfaceY = getSurfaceHeight(s.posX[i], s.posZ[i]);
      // Amplitud por estado (M3): el apagado no rebota; en EL BAJÓN baja al 55%
      const amp = apagado ? 0 : bajon ? 0.55 : 1;
      const baseBob = isPlaying ? Math.sin(time * 4) * 0.15 * amp : 0;
      let posY = surfaceY + baseBob;

      // Buff de baile (M11): jugador bailando ≥3s a ≤3u → decay a la mitad 10s
      if (dancerBuffing) {
        const bdx = playerState.position.x - s.posX[i];
        const bdz = playerState.position.z - s.posZ[i];
        const bdy = playerState.position.y - surfaceY;
        if (bdx * bdx + bdz * bdz <= buffR2 && Math.abs(bdy) < 2) {
          applyDanceBuff(npcId);
        }
      }

      if (npcHyped && !s.wasHyped[i]) s.hypeDropStart[i] = elapsed;
      s.wasHyped[i] = npcHyped ? 1 : 0;

      let groupScale = s.scaleVal[i];
      let visible = true;
      let groupRotY = s.rotY[i];

      if (npcHyped) {
        const hypePhase = elapsed - s.hypeDropStart[i];
        s.isDancing[i] = 1;
        s.danceMove[i] = 1;

        if (hypePhase < 1) {
          posY += hypePhase * 4.5;
          groupScale = 1 + hypePhase * 0.5;
          groupRotY += dt * 12;
          s.rotY[i] = groupRotY;
        } else if (hypePhase < 2) {
          posY += 4.5;
          groupScale = 1.5;
          groupRotY += dt * 12;
          s.rotY[i] = groupRotY;
        } else if (hypePhase < 3) {
          const disappearProgress = hypePhase - 2;
          groupScale = Math.max(0.01, 1.5 * (1 - disappearProgress));
          posY += 4.5;
          groupRotY += dt * 12;
          s.rotY[i] = groupRotY;
          if (hypePhase > 2.5) visible = false;
        } else {
          visible = false;
        }
      } else {
        // Lerp scale back to 1
        if (groupScale > 1.01) {
          groupScale += (1 - groupScale) * Math.min(dt * 3, 1);
        } else {
          groupScale = 1;
        }
      }
      s.scaleVal[i] = groupScale;

      // Earthquake bounce
      if (earthquakeActiveUntil > elapsed) {
        posY += Math.abs(Math.sin(elapsed * 8)) * 0.8;
      }

      // Report position
      npcPositions.current.set(npcId, { x: s.posX[i], y: surfaceY, z: s.posZ[i] });

      // ── Dance animations → per-part transforms ──
      let activeDance = s.danceMove[i];
      let danceTime = s.animClock[i] - s.danceStartTime[i];
      // CLUB DROP: baile sincronizado 5s — reloj COMPARTIDO para los 16 (§3 M4)
      if (syncDance && !npcHyped) {
        activeDance = 1;
        danceTime = syncDanceTime;
      }
      const isMoving = !s.isDancing[i] && s.waitTimer[i] <= 0;

      // Compute per-part local rotations based on dance
      let headRX = 0, headRZ = 0, headLocalY = 1.5;
      let laRX = 0, laRZ = -0.3, raRX = 0, raRZ = 0.3;
      let llRX = 0, rlRX = 0;
      let bodyRY = groupRotY;

      if (apagado && !syncDance) {
        // Pose "mirando el celular" (M3): cabeza gacha, brazos al frente — comunica
        // aburrimiento, no hostilidad. Piernas arrastradas si camina.
        headRX = 0.55;
        headLocalY = 1.44;
        laRX = -1.15;
        laRZ = -0.12;
        raRX = -1.15;
        raRZ = 0.12;
        llRX = isMoving ? Math.sin(time * 8) * 0.25 : 0;
        rlRX = isMoving ? Math.sin(time * 8 + Math.PI) * 0.25 : 0;
      } else if (activeDance === 1) {
        // Hands up
        const bodyBounce = Math.abs(Math.sin(danceTime * 5)) * 0.12;
        posY = surfaceY + baseBob + bodyBounce + (npcHyped ? (elapsed - s.hypeDropStart[i] < 1 ? (elapsed - s.hypeDropStart[i]) * 4.5 : 4.5) : 0);
        if (earthquakeActiveUntil > elapsed) posY += Math.abs(Math.sin(elapsed * 8)) * 0.8;
        laRZ = -(Math.PI * 0.7 + Math.sin(danceTime * 5) * 0.5);
        laRX = Math.sin(danceTime * 3.5) * 0.6;
        raRZ = Math.PI * 0.7 + Math.sin(danceTime * 5 + Math.PI) * 0.5;
        raRX = Math.sin(danceTime * 3.5 + 1) * 0.6;
        headRZ = Math.sin(danceTime * 5) * 0.2;
        headRX = Math.sin(danceTime * 10) * 0.1;
        headLocalY = 1.5 + Math.abs(Math.sin(danceTime * 5)) * 0.04;
      } else if (activeDance === 2) {
        // Spin
        const spinProgress = danceTime / (DANCE_DURATION_MIN + 1);
        bodyRY = s.spinStartRot[i] + spinProgress * Math.PI * 2 * 3;
        laRZ = -1.2;
        raRZ = 1.2;
      } else if (activeDance === 3) {
        // Headbang
        headLocalY = 1.5 + Math.sin(danceTime * 12) * 0.08;
        headRX = Math.sin(danceTime * 12) * 0.4;
        laRX = -0.5 + Math.sin(danceTime * 12) * 0.5;
        laRZ = -0.3;
        raRX = -0.5 + Math.sin(danceTime * 12 + Math.PI) * 0.5;
        raRZ = 0.3;
      } else {
        // Idle / walking (amplitud reducida en EL BAJÓN)
        const animSpeed = isMoving ? 8 : 4;
        const animIntensity = (isMoving ? 0.5 : 0.3) * amp;
        headRZ = Math.sin(time * 2) * 0.1;
        headLocalY = 1.5 + Math.sin(time * animSpeed) * 0.03;
        laRZ = -0.3 + Math.sin(time * animSpeed) * animIntensity;
        laRX = Math.sin(time * animSpeed + 0.5) * animIntensity;
        raRZ = 0.3 - Math.sin(time * animSpeed + Math.PI) * animIntensity;
        raRX = Math.sin(time * animSpeed + 1.5) * animIntensity;
        llRX = isMoving ? Math.sin(time * animSpeed) * 0.4 : 0;
        rlRX = isMoving ? Math.sin(time * animSpeed + Math.PI) * 0.4 : 0;
      }

      // Scale factor for visibility
      const sc = visible ? groupScale : 0.001;

      // Squash del hit (§4/WS-2): 1.25x/0.75y al impactar, resuelto en squashMs.
      // squashT (1→0) lo escribe tickNpcs; el coseno mete el "spring" (pasa por
      // un leve estiramiento antes de asentarse en 1).
      let scW = sc;
      let scH = sc;
      if (h.squashT > 0 && !npcHyped) {
        const e = h.squashT * Math.cos((1 - h.squashT) * Math.PI * 1.5); // 1 → −0.33 → 0
        scW = sc * (1 + 0.25 * e);
        scH = sc * (1 - 0.25 * e);
      }

      // ── Set instance matrices ──
      // Body: at [0, 1, 0] relative to group
      setInstance(body, i, s.posX[i], posY + 1 * scH, s.posZ[i], 0, bodyRY, 0, 0.4 * scW, 0.6 * scH, 0.25 * scW);

      // Head: at [0, headLocalY, 0] relative
      setInstance(head, i, s.posX[i] + Math.sin(bodyRY) * 0 , posY + headLocalY * scH, s.posZ[i], headRX, bodyRY, headRZ, 0.3 * scW, 0.35 * scH, 0.28 * scW);

      // Arms: offset from body center, need to account for group rotation
      const cosR = Math.cos(bodyRY);
      const sinR = Math.sin(bodyRY);

      // Left arm at [-0.3, 1.1, 0] local
      const laLocalX = -0.3, laLocalY = 1.1, laLocalZ = 0;
      const laWorldX = s.posX[i] + cosR * laLocalX - sinR * laLocalZ;
      const laWorldZ = s.posZ[i] + sinR * laLocalX + cosR * laLocalZ;
      setInstance(lArm, i, laWorldX, posY + laLocalY * scH, laWorldZ, laRX, bodyRY, laRZ, 0.12 * scW, 0.5 * scH, 0.12 * scW);

      // Right arm at [0.3, 1.1, 0] local
      const raLocalX = 0.3;
      const raWorldX = s.posX[i] + cosR * raLocalX;
      const raWorldZ = s.posZ[i] + sinR * raLocalX;
      setInstance(rArm, i, raWorldX, posY + 1.1 * scH, raWorldZ, raRX, bodyRY, raRZ, 0.12 * scW, 0.5 * scH, 0.12 * scW);

      // Left leg at [-0.1, 0.35, 0] local
      const llLocalX = -0.1;
      const llWorldX = s.posX[i] + cosR * llLocalX;
      const llWorldZ = s.posZ[i] + sinR * llLocalX;
      setInstance(lLeg, i, llWorldX, posY + 0.35 * scH, llWorldZ, llRX, bodyRY, 0, 0.15 * scW, 0.6 * scH, 0.15 * scW);

      // Right leg at [0.1, 0.35, 0] local
      const rlLocalX = 0.1;
      const rlWorldX = s.posX[i] + cosR * rlLocalX;
      const rlWorldZ = s.posZ[i] + sinR * rlLocalX;
      setInstance(rLeg, i, rlWorldX, posY + 0.35 * scH, rlWorldZ, rlRX, bodyRY, 0, 0.15 * scW, 0.6 * scH, 0.15 * scW);

      // ── Colores por estado (M3/M7/M11): flash > VIP > apagado > buff > base ──
      const flash = nowEpoch < h.hitFlashUntil; // flash blanco 80ms del hit (§4)
      colTmp.setRGB(bodyColors[i * 3], bodyColors[i * 3 + 1], bodyColors[i * 3 + 2]);
      if (flash) {
        colTmp.copy(colWhite);
        colTmp2.copy(colWhite);
      } else if (vip) {
        colTmp.copy(colGold); // VIP dorado (M7)
        colTmp2.copy(colSkin).lerp(colGold, 0.35);
      } else if (apagado) {
        colTmp.lerp(colApagado, 0.4); // atenuado pero aún con color (M3)
        colTmp2.copy(colSkin).lerp(colApagado, 0.25);
      } else if (nowEpoch < h.buffUntil) {
        colTmp.lerp(colBuff, 0.25 + 0.12 * Math.sin(elapsed * 6)); // aura del buff (M11)
        colTmp2.copy(colSkin);
      } else {
        colTmp2.copy(colSkin);
      }
      bodyCol.setXYZ(i, colTmp.r, colTmp.g, colTmp.b);
      lArmCol.setXYZ(i, colTmp.r, colTmp.g, colTmp.b);
      rArmCol.setXYZ(i, colTmp.r, colTmp.g, colTmp.b);
      headCol.setXYZ(i, colTmp2.r, colTmp2.g, colTmp2.b);
      if (flash) {
        lLegCol.setXYZ(i, 1, 1, 1);
        rLegCol.setXYZ(i, 1, 1, 1);
      } else {
        lLegCol.setXYZ(i, colLegs.r, colLegs.g, colLegs.b);
        rLegCol.setXYZ(i, colLegs.r, colLegs.g, colLegs.b);
      }

      // ── Hype bar ──
      const hype = h.hype;
      const maxHype = h.maxHype;
      const ratio = Math.max(0, Math.min(1, hype / maxHype));
      const barY = posY + 2.1 * sc;

      if (ratio <= 0 && !npcHyped) {
        // Hide bars by scaling to 0
        setInstance(barBg, i, 0, -100, 0, 0, 0, 0, 0.001, 0.001, 0.001);
        setInstance(barFill, i, 0, -100, 0, 0, 0, 0, 0.001, 0.001, 0.001);
      } else {
        // Billboard: face camera
        const barRY = Math.atan2(camera.position.x - s.posX[i], camera.position.z - s.posZ[i]);
        const displayRatio = npcHyped ? 1 : ratio;
        const barScale = npcHyped ? 1 + 0.15 * Math.sin(elapsed * 6) : 1;

        setInstance(barBg, i, s.posX[i], barY, s.posZ[i], 0, barRY, 0,
          (BAR_WIDTH + 0.04) * barScale, (BAR_HEIGHT + 0.04) * barScale, 1);

        // Fill bar: scale X by ratio, offset X to left-align
        const fillOffsetX = -(BAR_WIDTH * (1 - displayRatio)) / 2;
        const fillWorldX = s.posX[i] + Math.sin(barRY) * fillOffsetX;
        const fillWorldZ = s.posZ[i] + Math.cos(barRY) * fillOffsetX;
        setInstance(barFill, i, fillWorldX, barY, fillWorldZ, 0, barRY, 0,
          BAR_WIDTH * Math.max(0.001, displayRatio) * barScale, BAR_HEIGHT * barScale, 1);

        // Color the fill bar
        if (ratio <= 0.5) {
          barTmp.copy(barCyan).lerp(barPurple, ratio / 0.5);
        } else {
          barTmp.copy(barPurple).lerp(barGold, (ratio - 0.5) / 0.5);
        }
        if (npcHyped) barTmp.copy(barGold);

        if (barFill.instanceColor) {
          barFill.instanceColor.setXYZ(i, barTmp.r, barTmp.g, barTmp.b);
          barFill.instanceColor.needsUpdate = true;
        }
      }
    }

    // Flag matrices as needing GPU upload
    body.instanceMatrix.needsUpdate = true;
    head.instanceMatrix.needsUpdate = true;
    lArm.instanceMatrix.needsUpdate = true;
    rArm.instanceMatrix.needsUpdate = true;
    lLeg.instanceMatrix.needsUpdate = true;
    rLeg.instanceMatrix.needsUpdate = true;
    barBg.instanceMatrix.needsUpdate = true;
    barFill.instanceMatrix.needsUpdate = true;

    // Colores por estado: subir los buffers (16 instancias — costo trivial)
    bodyCol.needsUpdate = true;
    headCol.needsUpdate = true;
    lArmCol.needsUpdate = true;
    rArmCol.needsUpdate = true;
    lLegCol.needsUpdate = true;
    rLegCol.needsUpdate = true;
  });

  return (
    <group>
      {/* Body/cabeza/extremidades: geometría redondeada + material compartidos.
          El color por instancia (vívido, con estados M3/M7) va sobre instanceColor. */}
      <instancedMesh ref={bodyRef} args={[roundedGeo, charMat, NPC_COUNT]} frustumCulled={false} />
      <instancedMesh ref={headRef} args={[roundedGeo, charMat, NPC_COUNT]} frustumCulled={false} />
      <instancedMesh ref={leftArmRef} args={[roundedGeo, charMat, NPC_COUNT]} frustumCulled={false} />
      <instancedMesh ref={rightArmRef} args={[roundedGeo, charMat, NPC_COUNT]} frustumCulled={false} />
      <instancedMesh ref={leftLegRef} args={[roundedGeo, charMat, NPC_COUNT]} frustumCulled={false} />
      <instancedMesh ref={rightLegRef} args={[roundedGeo, charMat, NPC_COUNT]} frustumCulled={false} />

      {/* Hype bar backgrounds */}
      <instancedMesh ref={barBgRef} args={[undefined, undefined, NPC_COUNT]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.7} depthTest={false} />
      </instancedMesh>

      {/* Hype bar fills */}
      <instancedMesh ref={barFillRef} args={[undefined, undefined, NPC_COUNT]} frustumCulled={false}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial color="#00ccff" transparent opacity={1} depthTest={false} />
      </instancedMesh>
    </group>
  );
};
