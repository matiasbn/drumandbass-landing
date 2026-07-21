// Colisionadores estáticos del club (M1): AABBs derivados de MAP + Platforms + booth.
// Los proyectiles chequean por SEGMENTO contra esta lista (la bala muere en la pared con chispa).

import { MAP } from './constants';
import { PLATFORMS } from './components/Platforms';

export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  /** Etiqueta de debug ("wall-north", "deck-left", …) */
  id: string;
}

const WALL_HEIGHT = 20; // suficiente para el alcance máximo de una bala (vida 1.2s)
const WALL_THICKNESS = 1;

function box(id: string, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): AABB {
  return {
    id,
    minX: cx - sx / 2,
    maxX: cx + sx / 2,
    minY: cy - sy / 2,
    maxY: cy + sy / 2,
    minZ: cz - sz / 2,
    maxZ: cz + sz / 2,
  };
}

const { minX, maxX, minZ, maxZ } = MAP.bounds;
const wallCY = WALL_HEIGHT / 2;
const spanX = maxX - minX + WALL_THICKNESS * 2;
const spanZ = maxZ - minZ + WALL_THICKNESS * 2;

const stageH = MAP.djPlatformHeight;
const stageHalf = MAP.stageHalfSize;

/** Lista estática de AABBs: paredes del MAP, escenario central, booth del DJ y cajas de Platforms. */
export const STATIC_COLLIDERS: AABB[] = [
  // Paredes perimetrales (desde MAP.bounds)
  box('wall-north', (minX + maxX) / 2, wallCY, minZ - WALL_THICKNESS / 2, spanX, WALL_HEIGHT, WALL_THICKNESS),
  box('wall-south', (minX + maxX) / 2, wallCY, maxZ + WALL_THICKNESS / 2, spanX, WALL_HEIGHT, WALL_THICKNESS),
  box('wall-west', minX - WALL_THICKNESS / 2, wallCY, (minZ + maxZ) / 2, WALL_THICKNESS, WALL_HEIGHT, spanZ),
  box('wall-east', maxX + WALL_THICKNESS / 2, wallCY, (minZ + maxZ) / 2, WALL_THICKNESS, WALL_HEIGHT, spanZ),

  // Escenario central (virtual en Platforms.tsx — replicado desde MAP)
  box('center-stage', 0, stageH / 2, 0, stageHalf * 2, stageH, stageHalf * 2),

  // Zona del booth del DJ (misma caja que usa getSurfaceHeight en Platforms.tsx)
  box('dj-booth', 0, stageH + 0.5, 0, 4.5, 1.0, 2.0),

  // Todas las cajas de Platforms (decks, escaleras, jump pads)
  ...PLATFORMS.map((p) => box(p.id, p.position[0], p.position[1], p.position[2], p.size[0], p.size[1], p.size[2])),
];

interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/**
 * Intersección segmento p0→p1 vs AABB (método de slabs).
 * Devuelve t ∈ [0,1] del punto de ENTRADA al AABB, o -1 si no hay intersección.
 * Si p0 ya está dentro del AABB devuelve 0. Cero allocations.
 */
export function segmentHitsAABB(p0: Vec3Like, p1: Vec3Like, aabb: AABB): number {
  let tMin = 0;
  let tMax = 1;

  // Eje X
  let d = p1.x - p0.x;
  if (Math.abs(d) < 1e-9) {
    if (p0.x < aabb.minX || p0.x > aabb.maxX) return -1;
  } else {
    const inv = 1 / d;
    let t1 = (aabb.minX - p0.x) * inv;
    let t2 = (aabb.maxX - p0.x) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return -1;
  }

  // Eje Y
  d = p1.y - p0.y;
  if (Math.abs(d) < 1e-9) {
    if (p0.y < aabb.minY || p0.y > aabb.maxY) return -1;
  } else {
    const inv = 1 / d;
    let t1 = (aabb.minY - p0.y) * inv;
    let t2 = (aabb.maxY - p0.y) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return -1;
  }

  // Eje Z
  d = p1.z - p0.z;
  if (Math.abs(d) < 1e-9) {
    if (p0.z < aabb.minZ || p0.z > aabb.maxZ) return -1;
  } else {
    const inv = 1 / d;
    let t1 = (aabb.minZ - p0.z) * inv;
    let t2 = (aabb.maxZ - p0.z) * inv;
    if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
    if (t1 > tMin) tMin = t1;
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return -1;
  }

  return tMin;
}

/**
 * Primer collider estático que corta el segmento p0→p1.
 * Devuelve el t más temprano ∈ [0,1], o -1 si el segmento no toca nada.
 */
export function firstColliderHit(p0: Vec3Like, p1: Vec3Like): number {
  let best = -1;
  for (let i = 0; i < STATIC_COLLIDERS.length; i++) {
    const t = segmentHitsAABB(p0, p1, STATIC_COLLIDERS[i]);
    if (t >= 0 && (best < 0 || t < best)) best = t;
  }
  return best;
}
