'use client';

import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useProjectiles } from '../ProjectileContext';

const GRENADE_GRAVITY = 9.8;
const SHOT_POOL_SIZE = 30;
const GRENADE_POOL_SIZE = 10;
const EXPLOSION_POOL_SIZE = 10;
const PARTICLE_COUNT = 40;

const CONFETTI_COLORS = ['#ff0055', '#00ccff', '#00ff41', '#ffff00', '#ff8800', '#ff00ff'];

const HIDDEN = new THREE.Vector3(0, -100, 0);

// Pre-computed confetti color array for explosions
const confettiColorArray = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  const c = new THREE.Color(CONFETTI_COLORS[i % CONFETTI_COLORS.length]);
  confettiColorArray[i * 3] = c.r;
  confettiColorArray[i * 3 + 1] = c.g;
  confettiColorArray[i * 3 + 2] = c.b;
}

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
        <points key={`exp-${i}`} ref={el => { pointsRefs.current[i] = el; velocitiesStore.current[i] = null; }} position={[0, -100, 0]} visible={false}>
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

export const Projectiles: React.FC = () => {
  const { projectilesRef, explosionsRef } = useProjectiles();

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

  useFrame(() => {
    const now = Date.now();
    const projectiles = projectilesRef.current;
    const explosions = explosionsRef.current;

    // --- Update shots ---
    let shotIdx = 0;
    let grenadeIdx = 0;

    for (const p of projectiles) {
      const age = (now - p.birth) / 1000;

      if (p.type === 'shot') {
        if (age > 2 || shotIdx >= SHOT_POOL_SIZE) continue;
        const mesh = shotMeshRefs.current[shotIdx];
        const trail = shotTrailRefs.current[shotIdx];
        const mat = shotMatRefs.current[shotIdx];
        const tMat = shotTrailMatRefs.current[shotIdx];
        if (mesh && trail) {
          const px = p.position.x + p.direction.x * p.speed * age;
          const py = p.position.y + p.direction.y * p.speed * age;
          const pz = p.position.z + p.direction.z * p.speed * age;
          mesh.position.set(px, py, pz);
          mesh.visible = true;
          if (mat) mat.color.set(p.color);

          const tx = px - p.direction.x * 0.5;
          const ty = py - p.direction.y * 0.5;
          const tz = pz - p.direction.z * 0.5;
          trail.position.set(tx, ty, tz);
          trail.lookAt(px, py, pz);
          trail.visible = true;
          if (tMat) tMat.color.set(p.color);
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
    </group>
  );
};
