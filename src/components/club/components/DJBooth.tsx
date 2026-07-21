'use client';

// Booth del DJ (WS-3): antes ~100 meshes sueltos (uno por perilla) = ~100 draw calls.
// Ahora toda la utilería es DATA que se vuelca en 4 InstancedMesh estáticos
// (cajas/cilindros × cuerpo/neón) + 1 mesh con la textura de madera = 5 draw calls.
// Se elimina el detalle invisible desde la cámara de juego (puntos del plato,
// surcos del vinilo, headshell); el look neón (pantallas, VUs, botones) se conserva.

import React, { Suspense, useEffect, useMemo } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  GEO_BOX,
  GEO_CYL,
  MAT_BODY,
  MAT_NEON,
  NEON,
  buildStaticInstances,
  StaticInst,
} from '../materials';

// Colores de cuerpo (van por instancia sobre MAT_BODY)
const DARK = '#1a1a1a';
const SURFACE = '#222222';
const SILVER = '#888888';
const CHROME = '#aaaaaa';
const RUBBER = '#0a0a0a';
const VINYL = '#111111';

const BASE_Y = 1.5; // el grupo original vivía en [0, 1.5, 0]
const EQUIP_Y = BASE_Y + 1.15; // bandeja de equipos

interface Buckets {
  bodyBox: StaticInst[];
  bodyCyl: StaticInst[];
  neonBox: StaticInst[];
  neonCyl: StaticInst[];
}

// Technics SL-1200 en x0 (sin puntos del plato ni surcos: invisibles en juego)
function pushTechnics(b: Buckets, x0: number): void {
  const y = EQUIP_Y;
  b.bodyBox.push({ p: [x0, y, 0], s: [0.9, 0.08, 0.7], c: SILVER });
  b.bodyCyl.push({ p: [x0 + 0.05, y + 0.045, 0.02], s: [0.28, 0.01, 0.28], c: DARK });
  b.bodyCyl.push({ p: [x0 + 0.05, y + 0.055, 0.02], s: [0.26, 0.02, 0.26], c: CHROME });
  b.bodyCyl.push({ p: [x0 + 0.05, y + 0.07, 0.02], s: [0.22, 0.005, 0.22], c: VINYL });
  b.neonCyl.push({ p: [x0 + 0.05, y + 0.076, 0.02], s: [0.06, 0.003, 0.06], c: '#882200', i: 0.9 });
  b.bodyCyl.push({ p: [x0 - 0.3, y + 0.06, -0.2], s: [0.04, 0.04, 0.04], c: SILVER });
  b.bodyBox.push({ p: [x0 - 0.15, y + 0.09, -0.05], s: [0.015, 0.015, 0.35], r: [0, 0.4, 0], c: CHROME });
  b.bodyBox.push({ p: [x0 - 0.35, y + 0.045, 0.1], s: [0.08, 0.01, 0.3], c: DARK });
  b.bodyBox.push({ p: [x0 - 0.35, y + 0.055, 0.1], s: [0.04, 0.02, 0.05], c: CHROME });
  b.bodyCyl.push({ p: [x0 - 0.3, y + 0.05, 0.28], s: [0.025, 0.015, 0.025], c: SILVER });
  b.neonBox.push({ p: [x0 - 0.05, y + 0.06, -0.28], s: [0.02, 0.02, 0.02], c: NEON.cyan, i: 1.5 });
}

// Pioneer CDJ-3000 en x0
function pushCDJ(b: Buckets, x0: number): void {
  const y = EQUIP_Y;
  b.bodyBox.push({ p: [x0, y, 0], s: [0.7, 0.12, 0.65], c: DARK });
  b.bodyBox.push({ p: [x0, y + 0.065, 0], s: [0.68, 0.01, 0.63], c: SURFACE });
  // Jog wheel: pozo + aro cromado + aro display cian + centro oscuro
  b.bodyCyl.push({ p: [x0, y + 0.075, 0.08], s: [0.2, 0.01, 0.2], c: DARK });
  b.bodyCyl.push({ p: [x0, y + 0.08, 0.08], s: [0.19, 0.03, 0.19], c: CHROME });
  b.neonCyl.push({ p: [x0, y + 0.0975, 0.08], s: [0.135, 0.004, 0.135], c: NEON.cyan, i: 0.8 });
  b.bodyCyl.push({ p: [x0, y + 0.1005, 0.08], s: [0.11, 0.005, 0.11], c: '#111122' });
  // Pantalla + bisel
  b.bodyBox.push({ p: [x0, y + 0.073, -0.2], s: [0.37, 0.008, 0.14], c: DARK });
  b.neonBox.push({ p: [x0, y + 0.075, -0.2], s: [0.35, 0.01, 0.12], c: '#001122', i: 2 });
  // Performance pads 2×4
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 2; row++) {
      b.bodyBox.push({
        p: [x0 - 0.12 + col * 0.08, y + 0.075, 0.24 + row * 0.045],
        s: [0.06, 0.015, 0.035],
        c: '#333333',
      });
    }
  }
  // Play / cue
  b.neonBox.push({ p: [x0 - 0.2, y + 0.075, 0.15], s: [0.06, 0.02, 0.04], c: NEON.green, i: 0.8 });
  b.neonBox.push({ p: [x0 + 0.2, y + 0.075, 0.15], s: [0.06, 0.02, 0.04], c: NEON.pink, i: 0.8 });
  // Browse knob + USB
  b.bodyCyl.push({ p: [x0 + 0.25, y + 0.09, -0.15], s: [0.03, 0.04, 0.03], c: CHROME });
  b.neonBox.push({ p: [x0 + 0.28, y + 0.075, -0.25], s: [0.04, 0.01, 0.015], c: NEON.cyan, i: 1 });
}

// Pioneer DJM-A9 en el centro
function pushDJM(b: Buckets): void {
  const y = EQUIP_Y;
  const x0 = 0;
  b.bodyBox.push({ p: [x0, y, 0], s: [0.75, 0.12, 0.65], c: DARK });
  b.bodyBox.push({ p: [x0, y + 0.065, 0], s: [0.73, 0.01, 0.63], c: SURFACE });
  b.neonBox.push({ p: [x0, y + 0.075, -0.22], s: [0.3, 0.01, 0.08], c: '#001122', i: 2 });
  // 4 canales: fader + perillas EQ
  const chXs = [-0.22, -0.08, 0.08, 0.22];
  chXs.forEach((x, ch) => {
    b.bodyBox.push({ p: [x0 + x, y + 0.075, 0.18], s: [0.04, 0.01, 0.2], c: DARK });
    b.bodyBox.push({ p: [x0 + x, y + 0.085, 0.18 - ch * 0.02], s: [0.035, 0.025, 0.03], c: CHROME });
    [-0.08, -0.03, 0.02].forEach((z) => {
      b.bodyCyl.push({ p: [x0 + x, y + 0.085, z], s: [0.02, 0.03, 0.02], c: CHROME });
    });
  });
  // Crossfader
  b.bodyBox.push({ p: [x0, y + 0.075, 0.28], s: [0.35, 0.01, 0.03], c: DARK });
  b.bodyBox.push({ p: [x0, y + 0.085, 0.28], s: [0.04, 0.025, 0.025], c: CHROME });
  // VU meters (los LEDs son identidad del look — se conservan todos)
  [-0.15, 0.15].forEach((x) => {
    for (let led = 0; led < 7; led++) {
      const c = led < 4 ? NEON.green : led < 6 ? NEON.orange : NEON.pink;
      b.neonBox.push({
        p: [x0 + x, y + 0.08, -0.12 + led * 0.012],
        s: [0.025, 0.01, 0.008],
        c,
        i: led < 4 ? 1.2 : 0.5,
      });
    }
  });
  // Master / booth knobs
  b.bodyCyl.push({ p: [x0 + 0.3, y + 0.09, -0.22], s: [0.025, 0.04, 0.025], c: CHROME });
  b.bodyCyl.push({ p: [x0 - 0.3, y + 0.09, -0.22], s: [0.025, 0.04, 0.025], c: CHROME });
  // Send/return
  [-0.28, -0.22, 0.22, 0.28].forEach((x, idx) => {
    b.neonBox.push({ p: [x0 + x, y + 0.08, -0.1], s: [0.03, 0.015, 0.03], c: idx < 2 ? NEON.cyan : NEON.pink, i: 0.6 });
  });
}

function buildBoothData(): Buckets {
  const b: Buckets = { bodyBox: [], bodyCyl: [], neonBox: [], neonCyl: [] };

  // Mueble (la caja de madera se renderiza aparte con textura)
  b.bodyBox.push({ p: [0, BASE_Y + 0.5, 0.76], s: [4, 0.9, 0.05], c: SILVER }); // panel frontal
  b.bodyBox.push({ p: [0, BASE_Y + 1.05, 0], s: [4.1, 0.1, 1.7], c: DARK }); // superficie
  b.bodyBox.push({ p: [0, BASE_Y + 1.05, 0.85], s: [4.15, 0.12, 0.05], c: SILVER }); // molduras
  b.bodyBox.push({ p: [0, BASE_Y + 1.05, -0.85], s: [4.15, 0.12, 0.05], c: SILVER });
  // Cintas neón del frente (identidad del booth)
  b.neonBox.push({ p: [0, BASE_Y + 0.9, 0.79], s: [3.8, 0.06, 0.02], c: NEON.pink, i: 3 });
  b.neonBox.push({ p: [0, BASE_Y + 0.1, 0.79], s: [3.8, 0.06, 0.02], c: NEON.cyan, i: 3 });

  // Equipos: Technics | CDJ | DJM-A9 | CDJ | Technics
  pushTechnics(b, -2.0);
  pushCDJ(b, -0.9);
  pushDJM(b);
  pushCDJ(b, 0.9);
  pushTechnics(b, 2.0);

  // Goma antideslizante bajo los equipos (detalle barato, 2 instancias)
  b.bodyBox.push({ p: [-1.45, EQUIP_Y - 0.045, 0], s: [0.15, 0.01, 0.6], c: RUBBER });
  b.bodyBox.push({ p: [1.45, EQUIP_Y - 0.045, 0], s: [0.15, 0.01, 0.6], c: RUBBER });

  return b;
}

const WoodCabinet: React.FC = () => {
  const woodTexture = useTexture('/textures/wood.jpg');
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(3, 1);

  return (
    <mesh position={[0, BASE_Y + 0.5, 0]}>
      <boxGeometry args={[4, 1, 1.5]} />
      <meshStandardMaterial
        color="#aa8866"
        map={woodTexture}
        emissive="#221100"
        emissiveIntensity={0.3}
        metalness={0.1}
        roughness={0.8}
      />
    </mesh>
  );
};

export const DJBooth: React.FC = () => {
  const meshes = useMemo(() => {
    const b = buildBoothData();
    return [
      buildStaticInstances(GEO_BOX, MAT_BODY, b.bodyBox),
      buildStaticInstances(GEO_CYL, MAT_BODY, b.bodyCyl),
      buildStaticInstances(GEO_BOX, MAT_NEON, b.neonBox),
      buildStaticInstances(GEO_CYL, MAT_NEON, b.neonCyl),
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
      <Suspense fallback={null}>
        <WoodCabinet />
      </Suspense>
    </group>
  );
};
