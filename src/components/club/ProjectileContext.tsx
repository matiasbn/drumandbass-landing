'use client';

import React, { createContext, useContext, useCallback, useRef, ReactNode } from 'react';
import * as THREE from 'three';

export type ProjectileType = 'shot' | 'grenade';

export interface Projectile {
  id: number;
  shooterId: string;
  position: THREE.Vector3;
  direction: THREE.Vector3;
  speed: number;
  birth: number;
  color: string;
  type: ProjectileType;
  exploded?: boolean;
}

export interface Explosion {
  id: number;
  position: THREE.Vector3;
  birth: number;
  color: string;
}

interface ProjectileContextType {
  projectilesRef: React.MutableRefObject<Projectile[]>;
  explosionsRef: React.MutableRefObject<Explosion[]>;
  shoot: (position: THREE.Vector3, direction: THREE.Vector3, shooterId: string) => void;
  throwGrenade: (position: THREE.Vector3, direction: THREE.Vector3, shooterId: string, speed?: number) => void;
  checkHits: (playerPositions: Map<string, { x: number; y: number; z: number }>, localId: string, getSurfaceY: (x: number, z: number) => number) => { directHits: string[]; grenadeHits: string[] };
}

const ProjectileContext = createContext<ProjectileContextType | null>(null);

let nextId = 0;

const PROJECTILE_COLORS = ['#ff0055', '#00ccff', '#00ff41', '#ffff00', '#ff8800', '#ff00ff'];
const GRENADE_GRAVITY = 9.8;
const GRENADE_SPEED = 12;
const GRENADE_BLAST_RADIUS = 3.0;

export const ProjectileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const projectilesRef = useRef<Projectile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);

  const addExplosion = useCallback((pos: THREE.Vector3, color: string) => {
    const exp: Explosion = { id: nextId++, position: pos.clone(), birth: Date.now(), color };
    explosionsRef.current = [...explosionsRef.current, exp];
    setTimeout(() => {
      explosionsRef.current = explosionsRef.current.filter(e => e.id !== exp.id);
    }, 1500);
  }, []);

  const shoot = useCallback((position: THREE.Vector3, direction: THREE.Vector3, shooterId: string) => {
    const proj: Projectile = {
      id: nextId++,
      shooterId,
      position: position.clone(),
      direction: direction.clone().normalize(),
      speed: 15,
      birth: Date.now(),
      color: PROJECTILE_COLORS[Math.floor(Math.random() * PROJECTILE_COLORS.length)],
      type: 'shot',
    };
    projectilesRef.current = [...projectilesRef.current, proj];
  }, []);

  const throwGrenade = useCallback((position: THREE.Vector3, direction: THREE.Vector3, shooterId: string, speed?: number) => {
    const dir = direction.clone().normalize();
    // Add upward arc to the throw
    dir.y += 0.5;
    dir.normalize();
    const proj: Projectile = {
      id: nextId++,
      shooterId,
      position: position.clone(),
      direction: dir,
      speed: speed ?? GRENADE_SPEED,
      birth: Date.now(),
      color: '#ffcc00',
      type: 'grenade',
    };
    projectilesRef.current = [...projectilesRef.current, proj];
  }, []);

  const checkHits = useCallback((
    playerPositions: Map<string, { x: number; y: number; z: number }>,
    localId: string,
    getSurfaceY: (x: number, z: number) => number,
  ) => {
    const directHits: string[] = [];
    const grenadeHits: string[] = [];
    const now = Date.now();
    const alive: Projectile[] = [];

    for (const proj of projectilesRef.current) {
      const age = (now - proj.birth) / 1000;
      if (age > 4) continue; // expired

      if (proj.type === 'grenade') {
        // Grenade physics: parabolic arc with gravity
        const px = proj.position.x + proj.direction.x * proj.speed * age;
        const py = proj.position.y + proj.direction.y * proj.speed * age - 0.5 * GRENADE_GRAVITY * age * age;
        const pz = proj.position.z + proj.direction.z * proj.speed * age;

        const surfaceY = getSurfaceY(px, pz);

        // Check if grenade hit the ground
        if (py <= surfaceY && age > 0.1) {
          // Explode! Check all players in blast radius
          if (proj.shooterId === localId) {
            const explosionPos = new THREE.Vector3(px, surfaceY, pz);
            playerPositions.forEach((pos, playerId) => {
              if (playerId === proj.shooterId) return;
              const dx = pos.x - px;
              const dz = pos.z - pz;
              const dist = Math.sqrt(dx * dx + dz * dz);
              if (dist < GRENADE_BLAST_RADIUS) {
                grenadeHits.push(playerId);
              }
            });
            addExplosion(explosionPos, proj.color);
          } else {
            addExplosion(new THREE.Vector3(px, surfaceY, pz), proj.color);
          }
          continue; // Don't keep this grenade
        }

        // Check direct hit on player before ground
        let directHit = false;
        playerPositions.forEach((pos, playerId) => {
          if (playerId === proj.shooterId) return;
          const dx = pos.x - px;
          const dy = (pos.y || 0) - py;
          const dz = pos.z - pz;
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 1.2) {
            if (proj.shooterId === localId) {
              grenadeHits.push(playerId);
            }
            directHit = true;
          }
        });

        if (directHit) {
          addExplosion(new THREE.Vector3(px, py, pz), proj.color);
          continue;
        }

        alive.push(proj);
      } else {
        // Shot: straight line
        if (age > 2) continue;
        const px = proj.position.x + proj.direction.x * proj.speed * age;
        const py = proj.position.y + proj.direction.y * proj.speed * age;
        const pz = proj.position.z + proj.direction.z * proj.speed * age;

        let hit = false;
        playerPositions.forEach((pos, playerId) => {
          if (playerId === proj.shooterId) return;
          const dx = pos.x - px;
          const dy = (pos.y || 0) - py;
          const dz = pos.z - pz;
          if (Math.sqrt(dx * dx + dy * dy + dz * dz) < 1.0) {
            if (proj.shooterId === localId) {
              directHits.push(playerId);
            }
            hit = true;
          }
        });

        if (hit) {
          addExplosion(new THREE.Vector3(px, py, pz), proj.color);
        } else {
          alive.push(proj);
        }
      }
    }

    if (alive.length !== projectilesRef.current.length) {
      projectilesRef.current = alive;
    }

    return { directHits, grenadeHits };
  }, [addExplosion]);

  // Stable context value — all fields are refs or stable callbacks
  const contextValue = useRef<ProjectileContextType>({
    projectilesRef,
    explosionsRef,
    shoot,
    throwGrenade,
    checkHits,
  }).current;

  return (
    <ProjectileContext.Provider value={contextValue}>
      {children}
    </ProjectileContext.Provider>
  );
};

export const useProjectiles = () => {
  const ctx = useContext(ProjectileContext);
  if (!ctx) throw new Error('useProjectiles must be used within ProjectileProvider');
  return ctx;
};
