'use client';

// Plataformas (WS-3): antes cada plataforma/escalón eran 5-9 meshes sueltos
// (~130 draw calls). Ahora todo el set (bases, tapas, bordes neón y franjas de
// pared) se vuelca en 2 InstancedMesh estáticos = 2 draw calls.
// PLATFORMS y getSurfaceHeight NO cambian: colliders.ts y la física dependen de ellos.

import React, { useEffect, useMemo } from 'react';
import { MAP } from '../constants';
import { GEO_BOX, MAT_BODY, MAT_NEON, buildStaticInstances, StaticInst } from '../materials';

interface Platform {
  id: string;
  position: [number, number, number]; // center
  size: [number, number, number]; // width, height, depth
  color: string;
  emissive: string;
  emissiveIntensity?: number;
  isStair?: boolean; // stairs don't render edge glow
}

const stageH = MAP.djPlatformHeight;
const stageHalf = MAP.stageHalfSize;
const deckHeight = 3.0;
const upperHeight = 5.5; // segundo piso (nivel VIP alto)

// Generate stair steps — each step is a thin slab at its height
function makeStairsX(
  id: string,
  startX: number,
  endX: number,
  z: number,
  zSize: number,
  startY: number,
  endY: number,
  steps: number,
  emissive: string,
): Platform[] {
  const result: Platform[] = [];
  const stepWidth = Math.abs(endX - startX) / steps;
  const stepRise = (endY - startY) / steps;
  const dir = endX > startX ? 1 : -1;
  for (let i = 0; i < steps; i++) {
    const cx = startX + dir * (i + 0.5) * stepWidth;
    const topY = startY + (i + 1) * stepRise;
    const stepThickness = 0.3;
    result.push({
      id: `${id}-step-${i}`,
      position: [cx, topY - stepThickness / 2, z],
      size: [stepWidth + 0.02, stepThickness, zSize],
      color: '#1a1a2e',
      emissive,
      emissiveIntensity: 0.6,
      isStair: true,
    });
  }
  return result;
}

function makeStairsZ(
  id: string,
  z: number,
  zDir: number,
  xCenter: number,
  xSize: number,
  startY: number,
  endY: number,
  steps: number,
  emissive: string,
): Platform[] {
  const result: Platform[] = [];
  const stepDepth = 0.6;
  const stepRise = (endY - startY) / steps;
  for (let i = 0; i < steps; i++) {
    const cz = z + zDir * (i + 0.5) * stepDepth;
    const topY = startY + (i + 1) * stepRise;
    const stepThickness = 0.3;
    result.push({
      id: `${id}-step-${i}`,
      position: [xCenter, topY - stepThickness / 2, cz],
      size: [xSize, stepThickness, stepDepth],
      color: '#1a1a2e',
      emissive,
      emissiveIntensity: 0.6,
      isStair: true,
    });
  }
  return result;
}

const PLATFORMS: Platform[] = [
  // Center stage is handled by DanceFloor, but we need it in surface detection
  // Represented as a virtual platform for getSurfaceHeight only (not rendered here)

  // Left elevated deck
  {
    id: 'deck-left',
    position: [-12, deckHeight / 2, 0],
    size: [5, deckHeight, 10],
    color: '#1a0a2e',
    emissive: '#ff0055',
    emissiveIntensity: 0.4,
  },
  // Right elevated deck
  {
    id: 'deck-right',
    position: [12, deckHeight / 2, 0],
    size: [5, deckHeight, 10],
    color: '#0d1b2a',
    emissive: '#00ccff',
    emissiveIntensity: 0.4,
  },

  // Stairs: stage → left deck
  ...makeStairsX('stairs-left', -stageHalf, -9.5, 0, 3, stageH, deckHeight, 5, '#ff0055'),
  // Stairs: stage → right deck
  ...makeStairsX('stairs-right', stageHalf, 9.5, 0, 3, stageH, deckHeight, 5, '#00ccff'),

  // Front stairs: ground → stage (steps descend as you walk away from stage)
  ...makeStairsZ('stairs-front', stageHalf, 1, 0, 4, stageH, 0, 5, '#ff0055'),
  // Back stairs: ground → stage (steps descend as you walk away from stage)
  ...makeStairsZ('stairs-back', -stageHalf, -1, 0, 4, stageH, 0, 5, '#ff0055'),

  // Jump pads on stage
  { id: 'pad-n', position: [0, stageH + 0.2, -5], size: [2, 0.4, 2], color: '#12062e', emissive: '#ff8800', emissiveIntensity: 0.6 },
  { id: 'pad-s', position: [0, stageH + 0.2, 5], size: [2, 0.4, 2], color: '#12062e', emissive: '#ff8800', emissiveIntensity: 0.6 },

  // ── Niveles nuevos (mapa ampliado) ──────────────────────────────────
  // Plataformas de esquina traseras, a la altura de los decks.
  { id: 'corner-bl', position: [-15, deckHeight / 2, -15], size: [6, deckHeight, 6], color: '#0d1b2a', emissive: '#00ff41', emissiveIntensity: 0.4 },
  { id: 'corner-br', position: [15, deckHeight / 2, -15], size: [6, deckHeight, 6], color: '#1a0a2e', emissive: '#ff8800', emissiveIntensity: 0.4 },
  // Plataformas de esquina delanteras.
  { id: 'corner-fl', position: [-15, deckHeight / 2, 15], size: [6, deckHeight, 6], color: '#1a0a2e', emissive: '#ff00ff', emissiveIntensity: 0.4 },
  { id: 'corner-fr', position: [15, deckHeight / 2, 15], size: [6, deckHeight, 6], color: '#0d1b2a', emissive: '#00ccff', emissiveIntensity: 0.4 },
  // Segundo piso: plataforma alta central al fondo (el nivel "VIP" arriba).
  { id: 'upper-back', position: [0, upperHeight / 2, -15.5], size: [10, upperHeight, 5], color: '#12062e', emissive: '#00ccff', emissiveIntensity: 0.55 },
  // Escaleras que suben del deck izquierdo al segundo piso.
  ...makeStairsX('stairs-upper', -12.5, -6, -15.5, 4, deckHeight, upperHeight, 5, '#00ccff'),
];

export { PLATFORMS };

// Virtual center stage for surface detection
const CENTER_STAGE = {
  position: [0, stageH / 2, 0] as [number, number, number],
  size: [stageHalf * 2, stageH, stageHalf * 2] as [number, number, number],
};

// DJ booth collision zone — players can't walk through the DJ equipment
// Booth is at [0, 1.5, 0], cabinet is 4 wide x 1 tall x 1.5 deep
const DJ_BOOTH = {
  position: [0, stageH + 0.5, 0] as [number, number, number],
  size: [4.5, 1.0, 2.0] as [number, number, number],
};

/**
 * Returns the surface height at a given (x, z) position.
 * Checks center stage + all platforms. Returns highest top Y the position is over.
 * Returns 0 (ground level) if not on any platform.
 */
export function getSurfaceHeight(x: number, z: number): number {
  let maxY = 0;

  // Check center stage
  const csHalfW = CENTER_STAGE.size[0] / 2;
  const csHalfD = CENTER_STAGE.size[2] / 2;
  const csTopY = CENTER_STAGE.position[1] + CENTER_STAGE.size[1] / 2;
  if (x >= -csHalfW && x <= csHalfW && z >= -csHalfD && z <= csHalfD) {
    maxY = csTopY;
  }

  // Check DJ booth collision zone
  const djHalfW = DJ_BOOTH.size[0] / 2;
  const djHalfD = DJ_BOOTH.size[2] / 2;
  const djTopY = DJ_BOOTH.position[1] + DJ_BOOTH.size[1] / 2;
  if (
    x >= DJ_BOOTH.position[0] - djHalfW &&
    x <= DJ_BOOTH.position[0] + djHalfW &&
    z >= DJ_BOOTH.position[2] - djHalfD &&
    z <= DJ_BOOTH.position[2] + djHalfD
  ) {
    if (djTopY > maxY) maxY = djTopY;
  }

  // Check all platforms
  for (const p of PLATFORMS) {
    const halfW = p.size[0] / 2;
    const halfD = p.size[2] / 2;
    const topY = p.position[1] + p.size[1] / 2;
    if (
      x >= p.position[0] - halfW &&
      x <= p.position[0] + halfW &&
      z >= p.position[2] - halfD &&
      z <= p.position[2] + halfD
    ) {
      if (topY > maxY) maxY = topY;
    }
  }
  return maxY;
}

// Vuelca una plataforma en los buckets instanciados (misma geometría/offsets que
// el viejo PlatformMesh: base + tapa + bordes neón + franjas de pared en decks).
function pushPlatform(body: StaticInst[], neon: StaticInst[], platform: Platform): void {
  const { position, size, color, emissive, isStair } = platform;
  const topY = position[1] + size[1] / 2;
  const bottomY = position[1] - size[1] / 2;
  const isTall = size[1] >= 1.0;

  body.push({ p: position, s: size, c: color });

  if (!isStair) {
    body.push({ p: [position[0], topY + 0.01, position[2]], s: [size[0], 0.02, size[2]], c: '#1e1e35' });
    // Bordes brillantes del perímetro superior
    neon.push({ p: [position[0], topY + 0.02, position[2] + size[2] / 2], s: [size[0], 0.04, 0.04], c: emissive, i: 2 });
    neon.push({ p: [position[0], topY + 0.02, position[2] - size[2] / 2], s: [size[0], 0.04, 0.04], c: emissive, i: 2 });
    neon.push({ p: [position[0] - size[0] / 2, topY + 0.02, position[2]], s: [0.04, 0.04, size[2]], c: emissive, i: 2 });
    neon.push({ p: [position[0] + size[0] / 2, topY + 0.02, position[2]], s: [0.04, 0.04, size[2]], c: emissive, i: 2 });
  } else {
    // Escalón: borde frontal brillante en cada peldaño
    neon.push({ p: [position[0], topY + 0.01, position[2] + size[2] / 2], s: [size[0], 0.03, 0.03], c: emissive, i: 2.5 });
    neon.push({ p: [position[0], topY + 0.01, position[2] - size[2] / 2], s: [size[0], 0.03, 0.03], c: emissive, i: 2.5 });
    neon.push({ p: [position[0] - size[0] / 2, topY + 0.01, position[2]], s: [0.03, 0.03, size[2]], c: emissive, i: 2.5 });
    neon.push({ p: [position[0] + size[0] / 2, topY + 0.01, position[2]], s: [0.03, 0.03, size[2]], c: emissive, i: 2.5 });
  }

  // Franjas neón horizontales en las paredes de los decks
  if (isTall && !isStair) {
    for (let y = bottomY + 0.5; y < topY - 0.2; y += 0.8) {
      neon.push({ p: [position[0], y, position[2] + size[2] / 2 + 0.01], s: [size[0], 0.05, 0.01], c: emissive, i: 1.5 });
      neon.push({ p: [position[0], y, position[2] - size[2] / 2 - 0.01], s: [size[0], 0.05, 0.01], c: emissive, i: 1.5 });
      neon.push({ p: [position[0] - size[0] / 2 - 0.01, y, position[2]], s: [0.01, 0.05, size[2]], c: emissive, i: 1.5 });
      neon.push({ p: [position[0] + size[0] / 2 + 0.01, y, position[2]], s: [0.01, 0.05, size[2]], c: emissive, i: 1.5 });
    }
  }
}

export const Platforms: React.FC = () => {
  const meshes = useMemo(() => {
    const body: StaticInst[] = [];
    const neon: StaticInst[] = [];
    PLATFORMS.forEach((platform) => pushPlatform(body, neon, platform));
    return [
      buildStaticInstances(GEO_BOX, MAT_BODY, body),
      buildStaticInstances(GEO_BOX, MAT_NEON, neon),
    ];
  }, []);

  useEffect(() => {
    return () => meshes.forEach((m) => m.dispose());
  }, [meshes]);

  return (
    <group>
      {meshes.map((m, idx) => (
        <primitive key={idx} object={m} />
      ))}
    </group>
  );
};
