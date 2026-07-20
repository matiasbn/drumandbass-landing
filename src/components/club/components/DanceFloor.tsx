'use client';

// Pista de baile (WS-3): antes 6 <Instances> de drei (una por color, re-subiendo
// matrices cada frame) + ~25 meshes sueltos de escenario y neón. Ahora:
//   - 1 InstancedMesh con baldosas + base + escenario (color por instancia, subido UNA vez)
//   - 1 InstancedMesh con todo el neón (bordes, franjas, glow inferior)
// = 2 draw calls, cero trabajo por frame.

import React, { useEffect, useMemo } from 'react';
import { MAP } from '../constants';
import { GEO_BOX, MAT_BODY, MAT_NEON, NEON, buildStaticInstances, StaticInst } from '../materials';

const colorArray = [
  '#1a0a2e',
  '#0d1b2a',
  '#1b1128',
  '#0a1628',
  '#12062e',
  '#0f1a24',
];

export const DanceFloor: React.FC = () => {
  const gridSize = MAP.floorSize;
  const tileSize = MAP.tileSize;
  const stageHalf = MAP.stageHalfSize;
  const stageH = MAP.djPlatformHeight;

  const meshes = useMemo(() => {
    // El grupo original vivía en [0, -0.5, 0]: se aplica el offset directo en Y
    const yOff = -0.5;

    // Baldosas perimetrales (fuera del escenario central)
    const tiles: StaticInst[] = [];
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const wx = (x - gridSize / 2 + 0.5) * tileSize;
        const wz = (z - gridSize / 2 + 0.5) * tileSize;
        if (Math.abs(wx) < stageHalf + 0.5 && Math.abs(wz) < stageHalf + 0.5) continue;
        tiles.push({
          p: [wx, yOff, wz],
          s: [tileSize - 0.05, 0.1, tileSize - 0.05],
          c: colorArray[(x + z) % colorArray.length],
        });
      }
    }

    // Cuerpos: base de suelo + escenario central + tapa
    const body: StaticInst[] = [
      { p: [0, yOff - 0.1, 0], s: [gridSize * tileSize + 0.5, 0.2, gridSize * tileSize + 0.5], c: '#0a0a0f' },
      { p: [0, yOff + stageH / 2, 0], s: [stageHalf * 2, stageH, stageHalf * 2], c: '#0e0e18' },
      { p: [0, yOff + stageH + 0.01, 0], s: [stageHalf * 2, 0.02, stageHalf * 2], c: '#1e1e35' },
    ];

    // Neón: bordes superiores, franjas de pared y glow inferior del escenario
    const neon: StaticInst[] = [
      // Bordes superiores
      { p: [0, yOff + stageH + 0.02, stageHalf], s: [stageHalf * 2, 0.06, 0.06], c: NEON.pink, i: 3 },
      { p: [0, yOff + stageH + 0.02, -stageHalf], s: [stageHalf * 2, 0.06, 0.06], c: NEON.pink, i: 3 },
      { p: [-stageHalf, yOff + stageH + 0.02, 0], s: [0.06, 0.06, stageHalf * 2], c: NEON.cyan, i: 2 },
      { p: [stageHalf, yOff + stageH + 0.02, 0], s: [0.06, 0.06, stageHalf * 2], c: NEON.cyan, i: 2 },
      // Glow inferior (encuentro escenario/suelo)
      { p: [0, yOff + 0.02, stageHalf], s: [stageHalf * 2, 0.04, 0.04], c: NEON.pink, i: 1 },
      { p: [0, yOff + 0.02, -stageHalf], s: [stageHalf * 2, 0.04, 0.04], c: NEON.pink, i: 1 },
      { p: [-stageHalf, yOff + 0.02, 0], s: [0.04, 0.04, stageHalf * 2], c: NEON.cyan, i: 1 },
      { p: [stageHalf, yOff + 0.02, 0], s: [0.04, 0.04, stageHalf * 2], c: NEON.cyan, i: 1 },
    ];
    // Franjas horizontales de las paredes del escenario
    [0.3, 0.8].forEach((y) => {
      neon.push({ p: [0, yOff + y, stageHalf + 0.01], s: [stageHalf * 2, 0.05, 0.01], c: NEON.pink, i: 1.5 });
      neon.push({ p: [0, yOff + y, -(stageHalf + 0.01)], s: [stageHalf * 2, 0.05, 0.01], c: NEON.pink, i: 1.5 });
      neon.push({ p: [-(stageHalf + 0.01), yOff + y, 0], s: [0.01, 0.05, stageHalf * 2], c: NEON.cyan, i: 1.5 });
      neon.push({ p: [stageHalf + 0.01, yOff + y, 0], s: [0.01, 0.05, stageHalf * 2], c: NEON.cyan, i: 1.5 });
    });

    // Baldosas y cuerpos comparten geometría+material → un solo InstancedMesh
    return [
      buildStaticInstances(GEO_BOX, MAT_BODY, [...tiles, ...body]),
      buildStaticInstances(GEO_BOX, MAT_NEON, neon),
    ];
  }, [gridSize, tileSize, stageHalf, stageH]);

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
