'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectiles } from '../ProjectileContext';
import { useMultiplayer } from '../MultiplayerContext';
import { useCamera } from '../CameraContext';
import { TUNING } from '../tuning';
import { isOnBeat } from '../beatClock';
import { playerState } from '../playerState';
import { hud, notifyShotFired, addTrauma } from '../juice';
import { playPew, playBoom, playSparkTap, playKickDrum } from '../sounds';

const GRENADE_GRAVITY = TUNING.granada.gravedad;
const SHOT_POOL_SIZE = 40; // subido 30→40 para absorber disparos broadcast (§5)
const GRENADE_POOL_SIZE = 10;
const EXPLOSION_POOL_SIZE = 10;
const PARTICLE_COUNT = 40;

// Pools de juice (§4)
const MUZZLE_POOL_SIZE = 8; // muzzle flash 60ms
const RING_POOL_SIZE = 6; // shockwave rings de explosión
const SPARK_POOL_SIZE = 8; // chispas de pared (4 partículas c/u)
const SPARK_PARTICLES = 4;
const SPARK_LIFE_S = 0.25;
const ARC_DOTS = 12; // arco punteado de granada (M9)

const GRENADE_COLOR = '#ffcc00'; // color fijo de granada en ProjectileContext
const BEAT_GOLD = '#ffd700'; // tracer/muzzle dorados en beat-shot (M2)

const CONFETTI_COLORS = ['#ff0055', '#00ccff', '#00ff41', '#ffff00', '#ff8800', '#ff00ff'];

// Pre-computed confetti color array for explosions
const confettiColorArray = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const c = new THREE.Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
  confettiColorArray[i * 3] = c.r;
  confettiColorArray[i * 3 + 1] = c.g;
  confettiColorArray[i * 3 + 2] = c.b;
}

// Patrones de velocidad de chispas — fijos por slot, calculados una vez (cero allocs por evento)
const SPARK_DIRS: Float32Array[] = Array.from({ length: SPARK_POOL_SIZE }, () => {
  const v = new Float32Array(SPARK_PARTICLES * 3);
  for (let i = 0; i < SPARK_PARTICLES; i++) {
    const theta = Math.random() * Math.PI * 2;
    const up = 0.5 + Math.random() * 1.5;
    const speed = 1.5 + Math.random() * 1.5;
    v[i * 3] = Math.cos(theta) * speed;
    v[i * 3 + 1] = up;
    v[i * 3 + 2] = Math.sin(theta) * speed;
  }
  return v;
});

/** Pool of shot meshes (sphere + trail box) */
const ShotPool: React.FC<{ count: number; meshRefs: React.MutableRefObject<(THREE.Mesh | null)[]>; trailRefs: React.MutableRefObject<(THREE.Mesh | null)[]>; matRefs: React.MutableRefObject<(THREE.MeshBasicMaterial | null)[]>; trailMatRefs: React.MutableRefObject<(THREE.MeshBasicMaterial | null)[]> }> = ({ count, meshRefs, trailRefs, matRefs, trailMatRefs }) => {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <React.Fragment key={`shot-${i}`}>
          <mesh ref={el => { meshRefs.current[i] = el; }} position={[0, -100, 0]} visible={false}>
            <sphereGeometry args={[0.12, 8, 8]} />
            <meshBasicMaterial ref={el => { matRefs.current[i] = el; }} color="#ff0055" transparent opacity={0.9} />
          </mesh>
          <mesh ref={el => { trailRefs.current[i] = el; }} position={[0, -100, 0]} visible={false}>
            <boxGeometry args={[0.06, 0.06, 0.5]} />
            <meshBasicMaterial ref={el => { trailMatRefs.current[i] = el; }} color="#ff0055" transparent opacity={0.4} />
          </mesh>
        </React.Fragment>
      ))}
    </>
  );
};

/** Pool of grenade groups */
const GrenadePool: React.FC<{ count: number; groupRefs: React.MutableRefObject<(THREE.Group | null)[]>; labelMatRefs: React.MutableRefObject<(THREE.MeshBasicMaterial | null)[]>; glowMatRefs: React.MutableRefObject<(THREE.MeshBasicMaterial | null)[]> }> = ({ count, groupRefs, labelMatRefs, glowMatRefs }) => {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <group key={`gren-${i}`} ref={el => { groupRefs.current[i] = el; }} position={[0, -100, 0]} visible={false}>
          <mesh>
            <cylinderGeometry args={[0.08, 0.08, 0.35, 8]} />
            <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.2, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.06, 6]} />
            <meshStandardMaterial color="#999999" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.15, 8]} />
            <meshBasicMaterial ref={el => { labelMatRefs.current[i] = el; }} color="#ffcc00" transparent opacity={0.9} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.15, 4, 4]} />
            <meshBasicMaterial ref={el => { glowMatRefs.current[i] = el; }} color="#ffcc00" transparent opacity={0.3} />
          </mesh>
        </group>
      ))}
    </>
  );
};

/** Pool of explosion point systems */
const ExplosionPool: React.FC<{ count: number; pointsRefs: React.MutableRefObject<(THREE.Points | null)[]>; velocitiesStore: React.MutableRefObject<(Float32Array | null)[]> }> = ({ count, pointsRefs, velocitiesStore }) => {
  const posArrays = useMemo(() => Array.from({ length: count }, () => new Float32Array(PARTICLE_COUNT * 3)), [count]);
  const colorArrays = useMemo(() => Array.from({ length: count }, () => new Float32Array(confettiColorArray)), [count]);

  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <points key={`exp-${i}`} ref={(el: THREE.Points | null) => { pointsRefs.current[i] = el; velocitiesStore.current[i] = null; }} position={[0, -100, 0]} visible={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[posArrays[i], 3]} />
            <bufferAttribute attach="attributes-color" args={[colorArrays[i], 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.15} vertexColors transparent opacity={1} depthWrite={false} />
        </points>
      ))}
    </>
  );
};

/** Pool de muzzle flashes: sprites aditivos de 60ms, escala 0.4→0 */
const MuzzlePool: React.FC<{ spriteRefs: React.MutableRefObject<(THREE.Sprite | null)[]>; matRefs: React.MutableRefObject<(THREE.SpriteMaterial | null)[]> }> = ({ spriteRefs, matRefs }) => {
  return (
    <>
      {Array.from({ length: MUZZLE_POOL_SIZE }, (_, i) => (
        <sprite key={`muzzle-${i}`} ref={el => { spriteRefs.current[i] = el; }} position={[0, -100, 0]} visible={false} scale={[0.4, 0.4, 0.4]}>
          <spriteMaterial ref={el => { matRefs.current[i] = el; }} color="#ffffff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} />
        </sprite>
      ))}
    </>
  );
};

/** Pool de shockwave rings: anillos planos que expanden 0→radio en 400ms */
const RingPool: React.FC<{ meshRefs: React.MutableRefObject<(THREE.Mesh | null)[]>; matRefs: React.MutableRefObject<(THREE.MeshBasicMaterial | null)[]> }> = ({ meshRefs, matRefs }) => {
  return (
    <>
      {Array.from({ length: RING_POOL_SIZE }, (_, i) => (
        <mesh key={`ring-${i}`} ref={el => { meshRefs.current[i] = el; }} position={[0, -100, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
          <ringGeometry args={[0.82, 1, 28]} />
          <meshBasicMaterial ref={el => { matRefs.current[i] = el; }} color="#ffcc00" transparent opacity={0.8} blending={THREE.AdditiveBlending} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
};

/** Pool de chispas de pared: 4 partículas por slot, vida 250ms */
const SparkPool: React.FC<{ pointsRefs: React.MutableRefObject<(THREE.Points | null)[]> }> = ({ pointsRefs }) => {
  const posArrays = useMemo(() => Array.from({ length: SPARK_POOL_SIZE }, () => new Float32Array(SPARK_PARTICLES * 3)), []);
  return (
    <>
      {Array.from({ length: SPARK_POOL_SIZE }, (_, i) => (
        <points key={`spark-${i}`} ref={(el: THREE.Points | null) => { pointsRefs.current[i] = el; }} position={[0, -100, 0]} visible={false}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[posArrays[i], 3]} />
          </bufferGeometry>
          <pointsMaterial size={0.08} color="#ffffff" transparent opacity={1} depthWrite={false} blending={THREE.AdditiveBlending} />
        </points>
      ))}
    </>
  );
};

export const Projectiles: React.FC = () => {
  const { projectilesRef, explosionsRef, sparksRef } = useProjectiles();
  const { username } = useMultiplayer();
  const { cameraYawRef, cameraPitchRef } = useCamera();

  const usernameRef = useRef(username);
  usernameRef.current = username;

  // Shot pool refs
  const shotMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shotTrailRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shotMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const shotTrailMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  // Grenade pool refs
  const grenadeGroupRefs = useRef<(THREE.Group | null)[]>([]);
  const grenadeLabelMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const grenadeGlowMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);

  // Explosion pool refs
  const explosionPointsRefs = useRef<(THREE.Points | null)[]>([]);
  const explosionVelocities = useRef<(Float32Array | null)[]>([]);
  // Track which explosion id is bound to which pool slot
  const explosionSlotMap = useRef<Map<number, number>>(new Map());

  // Muzzle flash pool
  const muzzleSpriteRefs = useRef<(THREE.Sprite | null)[]>([]);
  const muzzleMatRefs = useRef<(THREE.SpriteMaterial | null)[]>([]);
  const muzzleMeta = useRef(Array.from({ length: MUZZLE_POOL_SIZE }, () => ({ start: -1e12 })));
  const muzzleNextSlot = useRef(0);

  // Shockwave ring pool
  const ringMeshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const ringMatRefs = useRef<(THREE.MeshBasicMaterial | null)[]>([]);
  const ringMeta = useRef(Array.from({ length: RING_POOL_SIZE }, () => ({ start: -1e12, target: 1 })));
  const ringNextSlot = useRef(0);

  // Spark pool
  const sparkPointsRefs = useRef<(THREE.Points | null)[]>([]);
  const sparkMeta = useRef(Array.from({ length: SPARK_POOL_SIZE }, () => ({ start: -1e12 })));
  const sparkNextSlot = useRef(0);

  // Detección de entidades nuevas por id monotónico (nextId global de ProjectileContext)
  const lastProjIdRef = useRef(-1);
  const lastExplosionIdRef = useRef(-1);
  const lastSparkIdRef = useRef(-1);

  // Disparos marcados como beat-shot al nacer (tracer/muzzle dorados)
  const beatShotIds = useRef<Set<number>>(new Set());

  // Arco punteado de granada — geometría/material compartidos entre los 12 puntos
  const arcDotRefs = useRef<(THREE.Mesh | null)[]>([]);
  const arcGeom = useMemo(() => new THREE.SphereGeometry(0.045, 6, 6), []);
  const arcMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: '#ffcc00', transparent: true, opacity: 0.85, depthWrite: false }),
    [],
  );
  useEffect(() => {
    return () => {
      arcGeom.dispose();
      arcMat.dispose();
    };
  }, [arcGeom, arcMat]);

  useFrame(() => {
    const now = Date.now();
    const projectiles = projectilesRef.current;
    const explosions = explosionsRef.current;
    const sparks = sparksRef.current;

    // --- Detección de disparos NUEVOS: pew + muzzle flash + marca de beat-shot ---
    let maxProjId = lastProjIdRef.current;
    for (const p of projectiles) {
      if (p.id <= lastProjIdRef.current) continue;
      if (p.id > maxProjId) maxProjId = p.id;
      if (p.type === 'shot') {
        const isLocal = p.shooterId === usernameRef.current;
        const beat = isOnBeat();
        if (beat) beatShotIds.current.add(p.id);
        // Sonido: pew con pitch ±10%; los disparos remotos suenan más suaves (§5 cosmético)
        playPew(isLocal ? 1 : 0.55);
        if (isLocal) {
          notifyShotFired(); // kick de cámara + crosshair de cooldown
          if (beat) playKickDrum(); // el beat-shot se OYE al instante
        }
        // Muzzle flash pooled 60ms en el punto de spawn
        const slot = muzzleNextSlot.current;
        muzzleNextSlot.current = (slot + 1) % MUZZLE_POOL_SIZE;
        muzzleMeta.current[slot].start = now;
        const spr = muzzleSpriteRefs.current[slot];
        const sprMat = muzzleMatRefs.current[slot];
        if (spr) {
          spr.position.set(
            p.position.x + p.direction.x * 0.25,
            p.position.y + p.direction.y * 0.25,
            p.position.z + p.direction.z * 0.25,
          );
        }
        if (sprMat) sprMat.color.set(beat ? BEAT_GOLD : p.color);
      }
    }
    lastProjIdRef.current = maxProjId;
    if (beatShotIds.current.size > 128) beatShotIds.current.clear();

    // --- Update shots ---
    let shotIdx = 0;
    let grenadeIdx = 0;

    for (const p of projectiles) {
      const age = (now - p.birth) / 1000;

      if (p.type === 'shot') {
        if (age > TUNING.arma.shotLifeS + 0.1 || shotIdx >= SHOT_POOL_SIZE) continue;
        const mesh = shotMeshRefs.current[shotIdx];
        const trail = shotTrailRefs.current[shotIdx];
        const mat = shotMatRefs.current[shotIdx];
        const tMat = shotTrailMatRefs.current[shotIdx];
        if (mesh && trail) {
          const px = p.position.x + p.direction.x * p.speed * age;
          const py = p.position.y + p.direction.y * p.speed * age;
          const pz = p.position.z + p.direction.z * p.speed * age;
          const gold = beatShotIds.current.has(p.id);

          mesh.position.set(px, py, pz);
          mesh.visible = true;
          // Squash & stretch por velocidad: se estira a lo largo del vuelo y se
          // achata perpendicular; pop de spawn en los primeros 60ms
          mesh.lookAt(px + p.direction.x, py + p.direction.y, pz + p.direction.z);
          const stretch = 1 + p.speed * 0.035;
          const pop = age < 0.06 ? 0.5 + 0.5 * (age / 0.06) : 1;
          mesh.scale.set(0.8 * pop, 0.8 * pop, stretch * pop);
          if (mat) mat.color.set(gold ? BEAT_GOLD : p.color);

          const tx = px - p.direction.x * 0.5;
          const ty = py - p.direction.y * 0.5;
          const tz = pz - p.direction.z * 0.5;
          trail.position.set(tx, ty, tz);
          trail.lookAt(px, py, pz);
          trail.scale.set(1, 1, 1 + p.speed * 0.05);
          trail.visible = true;
          if (tMat) tMat.color.set(gold ? BEAT_GOLD : p.color);
        }
        shotIdx++;
      } else {
        if (age > 4 || grenadeIdx >= GRENADE_POOL_SIZE) continue;
        const group = grenadeGroupRefs.current[grenadeIdx];
        const lMat = grenadeLabelMatRefs.current[grenadeIdx];
        const gMat = grenadeGlowMatRefs.current[grenadeIdx];
        if (group) {
          const px = p.position.x + p.direction.x * p.speed * age;
          const py = p.position.y + p.direction.y * p.speed * age - 0.5 * GRENADE_GRAVITY * age * age;
          const pz = p.position.z + p.direction.z * p.speed * age;
          group.position.set(px, py, pz);
          group.rotation.x = age * 8;
          group.rotation.z = age * 5;
          group.visible = true;
          if (lMat) lMat.color.set(p.color);
          if (gMat) gMat.color.set(p.color);
        }
        grenadeIdx++;
      }
    }

    // Hide unused shot pool meshes
    for (let i = shotIdx; i < SHOT_POOL_SIZE; i++) {
      const mesh = shotMeshRefs.current[i];
      const trail = shotTrailRefs.current[i];
      if (mesh) mesh.visible = false;
      if (trail) trail.visible = false;
    }
    // Hide unused grenade pool groups
    for (let i = grenadeIdx; i < GRENADE_POOL_SIZE; i++) {
      const group = grenadeGroupRefs.current[i];
      if (group) group.visible = false;
    }

    // --- Muzzle flashes: 60ms, escala 0.4→0, opacidad 0.9→0 ---
    for (let i = 0; i < MUZZLE_POOL_SIZE; i++) {
      const spr = muzzleSpriteRefs.current[i];
      if (!spr) continue;
      const t = (now - muzzleMeta.current[i].start) / TUNING.juice.muzzleMs;
      if (t >= 0 && t < 1) {
        const s = 0.4 * (1 - t);
        spr.scale.set(s, s, s);
        spr.visible = true;
        const m = muzzleMatRefs.current[i];
        if (m) m.opacity = 0.9 * (1 - t);
      } else {
        spr.visible = false;
      }
    }

    // --- Explosiones NUEVAS: shockwave ring + boom + trauma (solo granadas) ---
    let maxExpId = lastExplosionIdRef.current;
    for (const e of explosions) {
      if (e.id <= lastExplosionIdRef.current) continue;
      if (e.id > maxExpId) maxExpId = e.id;
      const isGrenade = e.color === GRENADE_COLOR;
      const slot = ringNextSlot.current;
      ringNextSlot.current = (slot + 1) % RING_POOL_SIZE;
      ringMeta.current[slot].start = now;
      // Granada: ring al radio del blast (3u); hit de disparo: onda chica
      ringMeta.current[slot].target = isGrenade ? TUNING.granada.blastRadio : 1.2;
      const ring = ringMeshRefs.current[slot];
      if (ring) ring.position.set(e.position.x, Math.max(0.06, e.position.y - 0.8), e.position.z);
      const rMat = ringMatRefs.current[slot];
      if (rMat) rMat.color.set(e.color);
      if (isGrenade) {
        playBoom('medio');
        addTrauma(TUNING.juice.traumaExplosion);
      }
    }
    lastExplosionIdRef.current = maxExpId;

    // Shockwave rings: expanden 0→target en 400ms con ease-out, opacidad 0.8→0
    for (let i = 0; i < RING_POOL_SIZE; i++) {
      const ring = ringMeshRefs.current[i];
      if (!ring) continue;
      const t = (now - ringMeta.current[i].start) / 400;
      if (t >= 0 && t < 1) {
        const ease = 1 - (1 - t) * (1 - t);
        const s = Math.max(0.001, ringMeta.current[i].target * ease);
        ring.scale.set(s, s, s);
        ring.visible = true;
        const m = ringMatRefs.current[i];
        if (m) m.opacity = 0.8 * (1 - t);
      } else {
        ring.visible = false;
      }
    }

    // --- Chispas de pared NUEVAS (evento de Fase 0 en sparksRef): tap + partículas ---
    let maxSparkId = lastSparkIdRef.current;
    for (const s of sparks) {
      if (s.id <= lastSparkIdRef.current) continue;
      if (s.id > maxSparkId) maxSparkId = s.id;
      const slot = sparkNextSlot.current;
      sparkNextSlot.current = (slot + 1) % SPARK_POOL_SIZE;
      sparkMeta.current[slot].start = now;
      const pts = sparkPointsRefs.current[slot];
      if (pts) {
        pts.position.set(s.position.x, s.position.y, s.position.z);
        (pts.material as THREE.PointsMaterial).color.set(s.color);
      }
      playSparkTap();
    }
    lastSparkIdRef.current = maxSparkId;

    // Chispas: 4 partículas salen despedidas con gravedad, vida 250ms
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      const pts = sparkPointsRefs.current[i];
      if (!pts) continue;
      const t = (now - sparkMeta.current[i].start) / (SPARK_LIFE_S * 1000);
      if (t >= 0 && t < 1) {
        const tt = t * SPARK_LIFE_S;
        const dirs = SPARK_DIRS[i];
        const attr = pts.geometry.attributes.position as THREE.BufferAttribute;
        for (let k = 0; k < SPARK_PARTICLES; k++) {
          attr.setXYZ(
            k,
            dirs[k * 3] * tt,
            dirs[k * 3 + 1] * tt - 4.9 * tt * tt,
            dirs[k * 3 + 2] * tt,
          );
        }
        attr.needsUpdate = true;
        pts.visible = true;
        (pts.material as THREE.PointsMaterial).opacity = 1 - t;
      } else {
        pts.visible = false;
      }
    }

    // --- Arco punteado de granada (M9): visible mientras hud.grenadeCharge ∈ [0,1] ---
    const charge = hud.grenadeCharge;
    const arcVisible = charge >= 0;
    if (arcVisible) {
      // Misma dirección que el lanzamiento real (aimDirection + arco 0.5 hacia arriba)
      const yaw = cameraYawRef.current;
      const pitch = cameraPitchRef.current;
      const cosP = Math.cos(pitch);
      let dx = Math.sin(yaw) * cosP;
      let dy = -Math.sin(pitch) + 0.5;
      let dz = Math.cos(yaw) * cosP;
      const inv = 1 / Math.sqrt(dx * dx + dy * dy + dz * dz);
      dx *= inv;
      dy *= inv;
      dz *= inv;
      const v = TUNING.granada.velMin + charge * (TUNING.granada.velMax - TUNING.granada.velMin);
      const sx = playerState.position.x + dx * 0.8;
      const sy = playerState.position.y + 1.2 + dy * 0.8;
      const sz = playerState.position.z + dz * 0.8;
      for (let i = 0; i < ARC_DOTS; i++) {
        const dot = arcDotRefs.current[i];
        if (!dot) continue;
        const t = (i + 1) * 0.09;
        const y = sy + dy * v * t - 0.5 * GRENADE_GRAVITY * t * t;
        if (y < 0) {
          dot.visible = false;
          continue;
        }
        dot.position.set(sx + dx * v * t, y, sz + dz * v * t);
        const s = 1 - i * 0.055; // se desvanece a lo largo del arco
        dot.scale.set(s, s, s);
        dot.visible = true;
      }
    } else {
      for (let i = 0; i < ARC_DOTS; i++) {
        const dot = arcDotRefs.current[i];
        if (dot) dot.visible = false;
      }
    }

    // --- Update explosions ---
    // Track which slots are still in use
    const activeSlots = new Set<number>();

    for (const e of explosions) {
      const age = (now - e.birth) / 1000;
      if (age > 1.5) continue;

      // Find or assign a pool slot
      let slot = explosionSlotMap.current.get(e.id);
      if (slot === undefined) {
        // Find a free slot
        for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
          if (!activeSlots.has(i)) {
            let taken = false;
            explosionSlotMap.current.forEach((s) => { if (s === i) taken = true; });
            if (!taken) { slot = i; break; }
          }
        }
        if (slot === undefined) continue; // no free slots
        explosionSlotMap.current.set(e.id, slot);
        // Reset velocities for this new explosion
        explosionVelocities.current[slot] = null;
      }
      activeSlots.add(slot);

      const points = explosionPointsRefs.current[slot];
      if (!points) continue;

      points.position.set(e.position.x, e.position.y, e.position.z);
      points.visible = true;

      // Initialize velocities if needed
      let vels = explosionVelocities.current[slot];
      if (!vels) {
        vels = new Float32Array(PARTICLE_COUNT * 3);
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.random() * Math.PI;
          const speed = 2 + Math.random() * 4;
          vels[i * 3] = Math.sin(phi) * Math.cos(theta) * speed;
          vels[i * 3 + 1] = Math.cos(phi) * speed * 0.8 + 2;
          vels[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * speed;
        }
        explosionVelocities.current[slot] = vels;
      }

      const positions = points.geometry.attributes.position;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const vx = vels[i * 3];
        const vy = vels[i * 3 + 1];
        const vz = vels[i * 3 + 2];
        positions.setXYZ(i, vx * age, vy * age - 4.9 * age * age, vz * age);
      }
      (positions as THREE.BufferAttribute).needsUpdate = true;

      const mat = points.material as THREE.PointsMaterial;
      mat.opacity = Math.max(0, 1 - age / 1.5);
    }

    // Hide unused explosion slots & clean up expired entries
    const expiredIds: number[] = [];
    explosionSlotMap.current.forEach((slot, id) => {
      if (!activeSlots.has(slot)) {
        const pts = explosionPointsRefs.current[slot];
        if (pts) pts.visible = false;
        expiredIds.push(id);
      }
    });
    for (const id of expiredIds) {
      explosionSlotMap.current.delete(id);
    }
    // Also hide any slots not tracked at all
    for (let i = 0; i < EXPLOSION_POOL_SIZE; i++) {
      if (!activeSlots.has(i)) {
        const pts = explosionPointsRefs.current[i];
        if (pts) pts.visible = false;
      }
    }
  });

  return (
    <group>
      <ShotPool count={SHOT_POOL_SIZE} meshRefs={shotMeshRefs} trailRefs={shotTrailRefs} matRefs={shotMatRefs} trailMatRefs={shotTrailMatRefs} />
      <GrenadePool count={GRENADE_POOL_SIZE} groupRefs={grenadeGroupRefs} labelMatRefs={grenadeLabelMatRefs} glowMatRefs={grenadeGlowMatRefs} />
      <ExplosionPool count={EXPLOSION_POOL_SIZE} pointsRefs={explosionPointsRefs} velocitiesStore={explosionVelocities} />
      <MuzzlePool spriteRefs={muzzleSpriteRefs} matRefs={muzzleMatRefs} />
      <RingPool meshRefs={ringMeshRefs} matRefs={ringMatRefs} />
      <SparkPool pointsRefs={sparkPointsRefs} />
      {/* Arco punteado de granada — 12 puntos con geometría/material compartidos */}
      {Array.from({ length: ARC_DOTS }, (_, i) => (
        <mesh key={`arc-${i}`} ref={el => { arcDotRefs.current[i] = el; }} geometry={arcGeom} material={arcMat} position={[0, -100, 0]} visible={false} />
      ))}
    </group>
  );
};
