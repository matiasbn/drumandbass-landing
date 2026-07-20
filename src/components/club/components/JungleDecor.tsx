'use client';

// Decoración jungla (WS-3): 8 meshes sueltos → 1 InstancedMesh estático.
// Las hojas (planos finos) se representan como cajas aplanadas para compartir
// la geometría unitaria — desde la cámara de juego son indistinguibles.

import React, { useEffect, useMemo, MutableRefObject } from 'react';
import { GEO_BOX, MAT_NEON, buildStaticInstances, StaticInst } from '../materials';

const JUNGLE_GREENS = ['#00ff41', '#22cc33', '#118822', '#44ff66', '#009930'];

interface JungleDecorProps {
  isPlayingRef: MutableRefObject<boolean>;
}

// Columnas verdes de las esquinas
const COLUMN_CONFIGS: { pos: [number, number, number]; color: string }[] = [
  { pos: [-14, 2, -14], color: JUNGLE_GREENS[0] },
  { pos: [14, 2, -14], color: JUNGLE_GREENS[1] },
  { pos: [-14, 2, 14], color: JUNGLE_GREENS[3] },
  { pos: [14, 2, 14], color: JUNGLE_GREENS[4] },
];

// Matas de follaje (2 hojas por mata)
const FOLIAGE_POSITIONS: [number, number, number][] = [
  [-15, -0.45, -10],
  [15, -0.45, 10],
];

const FOLIAGE_BLADES: { angle: number; height: number; lean: number }[] = [
  { angle: 0, height: 0.5, lean: 0.5 },
  { angle: Math.PI, height: 0.4, lean: 0.6 },
];

export const JungleDecor: React.FC<JungleDecorProps> = () => {
  const mesh = useMemo(() => {
    const items: StaticInst[] = [];

    COLUMN_CONFIGS.forEach((c) => {
      items.push({ p: c.pos, s: [0.15, 5, 0.15], c: c.color, i: 0.85 });
    });

    FOLIAGE_POSITIONS.forEach((pos) => {
      FOLIAGE_BLADES.forEach((b, i) => {
        items.push({
          p: [pos[0] + Math.sin(b.angle) * 0.12, pos[1] + b.height / 2, pos[2] + Math.cos(b.angle) * 0.12],
          s: [0.08, b.height, 0.006],
          r: [b.lean * Math.cos(b.angle), b.angle, b.lean * Math.sin(b.angle)],
          c: JUNGLE_GREENS[i % JUNGLE_GREENS.length],
          i: 0.8,
        });
      });
    });

    return buildStaticInstances(GEO_BOX, MAT_NEON, items);
  }, []);

  useEffect(() => {
    return () => {
      mesh.dispose();
    };
  }, [mesh]);

  return <primitive object={mesh} />;
};
