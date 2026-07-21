'use client';

import React, { createContext, useContext, useCallback, useRef, ReactNode } from 'react';
import * as THREE from 'three';
import { TUNING } from './tuning';
import { firstColliderHit } from './colliders';

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
  /** Última posición evaluada (para la colisión por segmento) — interno de checkHits */
  last?: THREE.Vector3;
}

export interface Explosion {
  id: number;
  position: THREE.Vector3;
  birth: number;
  color: string;
}

/** Chispa emitida cuando una bala muere contra un collider (pared/plataforma/booth) */
export interface Spark {
  id: number;
  position: THREE.Vector3;
  birth: number;
  color: string;
}

interface ProjectileContextType {
  projectilesRef: React.MutableRefObject<Projectile[]>;
  explosionsRef: React.MutableRefObject<Explosion[]>;
  /** Chispas de pared — consumibles por Projectiles (se auto-limpian tras ~1s) */
  sparksRef: React.MutableRefObject<Spark[]>;
  shoot: (position: THREE.Vector3, direction: THREE.Vector3, shooterId: string) => void;
  throwGrenade: (position: THREE.Vector3, direction: THREE.Vector3, shooterId: string, speed?: number) => void;
  checkHits: (playerPositions: Map<string, { x: number; y: number; z: number }>, localId: string, getSurfaceY: (x: number, z: number) => number) => { directHits: string[]; grenadeHits: string[] };
}

const ProjectileContext = createContext<ProjectileContextType | null>(null);

let nextId = 0;

const PROJECTILE_COLORS = ['#ff0055', '#00ccff', '#00ff41', '#ffff00', '#ff8800', '#ff00ff'];
const SPARK_LIFE_MS = 1000;

// Temporales reutilizados en checkHits — cero allocations por frame
const _p0 = { x: 0, y: 0, z: 0 };
const _p1 = { x: 0, y: 0, z: 0 };

/**
 * Distancia mínima (al cuadrado) del segmento p0→p1 al centro c, y el t del punto más cercano.
 * Devuelve el t ∈ [0,1] si la distancia mínima es < r², o -1 si no hay impacto.
 */
function segmentHitsSphere(
  p0: { x: number; y: number; z: number },
  p1: { x: number; y: number; z: number },
  cx: number,
  cy: number,
  cz: number,
  radius: number,
): number {
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const dz = p1.z - p0.z;
  const lenSq = dx * dx + dy * dy + dz * dz;
  let t = 0;
  if (lenSq > 1e-12) {
    t = ((cx - p0.x) * dx + (cy - p0.y) * dy + (cz - p0.z) * dz) / lenSq;
    t = Math.max(0, Math.min(1, t));
  }
  const qx = p0.x + dx * t - cx;
  const qy = p0.y + dy * t - cy;
  const qz = p0.z + dz * t - cz;
  return qx * qx + qy * qy + qz * qz < radius * radius ? t : -1;
}

export const ProjectileProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const projectilesRef = useRef<Projectile[]>([]);
  const explosionsRef = useRef<Explosion[]>([]);
  const sparksRef = useRef<Spark[]>([]);

  const addExplosion = useCallback((pos: THREE.Vector3, color: string) => {
    const exp: Explosion = { id: nextId++, position: pos.clone(), birth: Date.now(), color };
    explosionsRef.current = [...explosionsRef.current, exp];
    setTimeout(() => {
      explosionsRef.current = explosionsRef.current.filter(e => e.id !== exp.id);
    }, 1500);
  }, []);

  const addSpark = useCallback((x: number, y: number, z: number, color: string) => {
    sparksRef.current.push({ id: nextId++, position: new THREE.Vector3(x, y, z), birth: Date.now(), color });
  }, []);

  const shoot = useCallback((position: THREE.Vector3, direction: THREE.Vector3, shooterId: string) => {
    const proj: Projectile = {
      id: nextId++,
      shooterId,
      position: position.clone(),
      direction: direction.clone().normalize(),
      speed: TUNING.arma.shotSpeed,
      birth: Date.now(),
      color: PROJECTILE_COLORS[Math.floor(Math.random() * PROJECTILE_COLORS.length)],
      type: 'shot',
      last: position.clone(),
    };
    projectilesRef.current = [...projectilesRef.current, proj];
  }, []);

  const throwGrenade = useCallback((position: THREE.Vector3, direction: THREE.Vector3, shooterId: string, speed?: number) => {
    const dir = direction.clone().normalize();
    // Arco hacia arriba en el lanzamiento
    dir.y += 0.5;
    dir.normalize();
    const proj: Projectile = {
      id: nextId++,
      shooterId,
      position: position.clone(),
      direction: dir,
      speed: speed ?? TUNING.granada.velMax,
      birth: Date.now(),
      color: '#ffcc00',
      type: 'grenade',
      last: position.clone(),
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

    // Purgar chispas viejas (consumidas visualmente por Projectiles)
    if (sparksRef.current.length > 0 && now - sparksRef.current[0].birth > SPARK_LIFE_MS) {
      sparksRef.current = sparksRef.current.filter(s => now - s.birth <= SPARK_LIFE_MS);
    }

    for (const proj of projectilesRef.current) {
      const age = (now - proj.birth) / 1000;
      if (age > 4) continue; // expirado (granadas)

      if (proj.type === 'grenade') {
        // Física de granada: parábola con gravedad
        const g = TUNING.granada.gravedad;
        const px = proj.position.x + proj.direction.x * proj.speed * age;
        const py = proj.position.y + proj.direction.y * proj.speed * age - 0.5 * g * age * age;
        const pz = proj.position.z + proj.direction.z * proj.speed * age;

        // Segmento recorrido desde el último frame
        const last = proj.last ?? proj.position;
        _p0.x = last.x; _p0.y = last.y; _p0.z = last.z;
        _p1.x = px; _p1.y = py; _p1.z = pz;

        const surfaceY = getSurfaceY(px, pz);

        // ¿Tocó el suelo o un collider estático (pared/plataforma/booth)?
        const tWall = age > 0.1 ? firstColliderHit(_p0, _p1) : -1;
        const hitGround = py <= surfaceY && age > 0.1;

        if (hitGround || tWall >= 0) {
          // Punto de explosión: impacto contra collider o punto de contacto con el suelo
          let ex = px, ey = Math.max(py, surfaceY), ez = pz;
          if (!hitGround && tWall >= 0) {
            ex = _p0.x + (_p1.x - _p0.x) * tWall;
            ey = _p0.y + (_p1.y - _p0.y) * tWall;
            ez = _p0.z + (_p1.z - _p0.z) * tWall;
          }
          // Blast ESFÉRICO 3D — incluye NPCs/jugadores en plataformas
          if (proj.shooterId === localId) {
            const r = TUNING.granada.blastRadio;
            playerPositions.forEach((pos, playerId) => {
              if (playerId === proj.shooterId) return;
              const dx = pos.x - ex;
              const dy = pos.y - ey;
              const dz = pos.z - ez;
              if (dx * dx + dy * dy + dz * dz < r * r) {
                grenadeHits.push(playerId);
              }
            });
          }
          addExplosion(new THREE.Vector3(ex, ey, ez), proj.color);
          continue;
        }

        // Impacto directo sobre un personaje antes de tocar el suelo (por segmento)
        let directHit = false;
        playerPositions.forEach((pos, playerId) => {
          if (directHit || playerId === proj.shooterId) return;
          const radius = playerId.startsWith('npc-') ? TUNING.arma.npcHitRadius : TUNING.arma.playerHitRadius;
          if (segmentHitsSphere(_p0, _p1, pos.x, pos.y, pos.z, radius + 0.2) >= 0) {
            if (proj.shooterId === localId) {
              // Impacto directo de granada: blast esférico centrado en el objetivo
              const r = TUNING.granada.blastRadio;
              playerPositions.forEach((other, otherId) => {
                if (otherId === proj.shooterId) return;
                const dx = other.x - pos.x;
                const dy = other.y - pos.y;
                const dz = other.z - pos.z;
                if (dx * dx + dy * dy + dz * dz < r * r) {
                  grenadeHits.push(otherId);
                }
              });
            }
            directHit = true;
          }
        });

        if (directHit) {
          addExplosion(new THREE.Vector3(px, py, pz), proj.color);
          continue;
        }

        if (proj.last) proj.last.set(px, py, pz);
        else proj.last = new THREE.Vector3(px, py, pz);
        alive.push(proj);
      } else {
        // Disparo: línea recta, colisión por SEGMENTO (posición anterior → actual)
        if (age > TUNING.arma.shotLifeS) continue;
        const px = proj.position.x + proj.direction.x * proj.speed * age;
        const py = proj.position.y + proj.direction.y * proj.speed * age;
        const pz = proj.position.z + proj.direction.z * proj.speed * age;

        const last = proj.last ?? proj.position;
        _p0.x = last.x; _p0.y = last.y; _p0.z = last.z;
        _p1.x = px; _p1.y = py; _p1.z = pz;

        // Personaje más temprano cortado por el segmento
        let tChar = -1;
        let charId: string | null = null;
        playerPositions.forEach((pos, playerId) => {
          if (playerId === proj.shooterId) return;
          const radius = playerId.startsWith('npc-') ? TUNING.arma.npcHitRadius : TUNING.arma.playerHitRadius;
          const t = segmentHitsSphere(_p0, _p1, pos.x, pos.y, pos.z, radius);
          if (t >= 0 && (tChar < 0 || t < tChar)) {
            tChar = t;
            charId = playerId;
          }
        });

        // Collider estático más temprano (paredes / plataformas / booth)
        const tWall = firstColliderHit(_p0, _p1);

        if (tWall >= 0 && (tChar < 0 || tWall < tChar)) {
          // La bala muere en la pared → chispa consumible por Projectiles
          addSpark(
            _p0.x + (_p1.x - _p0.x) * tWall,
            _p0.y + (_p1.y - _p0.y) * tWall,
            _p0.z + (_p1.z - _p0.z) * tWall,
            proj.color,
          );
          continue;
        }

        if (tChar >= 0 && charId) {
          if (proj.shooterId === localId) {
            directHits.push(charId);
          }
          addExplosion(new THREE.Vector3(px, py, pz), proj.color);
          continue;
        }

        if (proj.last) proj.last.set(px, py, pz);
        else proj.last = new THREE.Vector3(px, py, pz);
        alive.push(proj);
      }
    }

    if (alive.length !== projectilesRef.current.length) {
      projectilesRef.current = alive;
    }

    return { directHits, grenadeHits };
  }, [addExplosion, addSpark]);

  // Valor estable del contexto — todos los campos son refs o callbacks estables
  const contextValue = useRef<ProjectileContextType>({
    projectilesRef,
    explosionsRef,
    sparksRef,
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
