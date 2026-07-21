'use client';

// Elementos de escenario (WS-3): parlantes, subs, truss, cintas de borde y luces
// robóticas. Antes ~46 meshes sueltos; ahora:
//   - 1 InstancedMesh de cuerpos (cajas: parlantes/subs/truss/bases de luces)
//   - 1 InstancedMesh de conos de parlante (estáticos: el viejo "pulso" escalaba
//     el eje Z de un círculo plano — no tenía efecto visual alguno)
//   - 1 InstancedMesh de cintas neón del borde de la pista
//   - 2 InstancedMesh animados (lentes + haces de las 6 luces robóticas, matrices
//     por frame — las 6 cabezas siempre compartieron la MISMA rotación)
// ≈ 5 draw calls. Los conos y cabezas conservan su coreografía y parpadeo.

import React, { useEffect, useMemo, useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  GEO_BOX,
  GEO_CIRCLE,
  MAT_BODY,
  MAT_NEON,
  NEON,
  buildStaticInstances,
  StaticInst,
} from '../materials';

// --- Configs estáticas (idénticas al layout anterior) ---

const SPEAKER_CONFIGS: { pos: [number, number, number]; rot: [number, number, number] }[] = [
  { pos: [-13, 0.8, 0], rot: [0, Math.PI / 2, 0] },
  { pos: [13, 0.8, 0], rot: [0, -Math.PI / 2, 0] },
  { pos: [0, 0.8, -13], rot: [0, 0, 0] },
  { pos: [0, 0.8, 13], rot: [0, Math.PI, 0] },
];

const SUB_CONFIGS: { pos: [number, number, number]; rot: [number, number, number] }[] = [
  { pos: [-13, 0.5, -13], rot: [0, Math.PI / 4, 0] },
  { pos: [13, 0.5, -13], rot: [0, -Math.PI / 4, 0] },
  { pos: [-13, 0.5, 13], rot: [0, (3 * Math.PI) / 4, 0] },
  { pos: [13, 0.5, 13], rot: [0, (-3 * Math.PI) / 4, 0] },
];

const LIGHT_COUNT = 6;
const LIGHT_COLORS_CYCLE = [NEON.cyan, NEON.pink, NEON.green, NEON.orange];
const LIGHT_CONFIGS: { pos: [number, number, number]; color: string }[] = [];
for (let i = 0; i < LIGHT_COUNT; i++) {
  const angle = (i / LIGHT_COUNT) * Math.PI * 2;
  LIGHT_CONFIGS.push({
    pos: [Math.cos(angle) * 10, 9, Math.sin(angle) * 10],
    color: LIGHT_COLORS_CYCLE[i % LIGHT_COLORS_CYCLE.length],
  });
}

// Offset local de cada cono rotado por el yaw de su caja → posición mundial
function rotatedOffset(pos: [number, number, number], yaw: number, off: [number, number, number]): [number, number, number] {
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  return [pos[0] + off[0] * cos + off[2] * sin, pos[1] + off[1], pos[2] - off[0] * sin + off[2] * cos];
}

function buildStaticData(): { body: StaticInst[]; cones: StaticInst[]; neon: StaticInst[] } {
  const body: StaticInst[] = [];
  const cones: StaticInst[] = [];
  const neon: StaticInst[] = [];

  // Parlantes + conos
  SPEAKER_CONFIGS.forEach((s) => {
    body.push({ p: s.pos, s: [1.1, 1.6, 0.85], r: s.rot, c: '#2a2420' });
    cones.push({ p: rotatedOffset(s.pos, s.rot[1], [0, -0.2, 0.44]), s: [0.32, 0.32, 1], r: s.rot, c: '#444444' });
  });

  // Subwoofers + conos
  SUB_CONFIGS.forEach((s) => {
    body.push({ p: s.pos, s: [1, 1, 1], r: s.rot, c: '#222222' });
    cones.push({ p: rotatedOffset(s.pos, s.rot[1], [0, 0, 0.52]), s: [0.38, 0.38, 1], r: s.rot, c: '#3a3a3a' });
  });

  // Cintas neón del borde de la pista
  neon.push({ p: [-14.5, -0.4, 0], s: [0.06, 0.06, 30], c: NEON.green, i: 1.5 });
  neon.push({ p: [14.5, -0.4, 0], s: [0.06, 0.06, 30], c: NEON.green, i: 1.5 });
  neon.push({ p: [0, -0.4, -14.5], s: [30, 0.06, 0.06], c: NEON.cyan, i: 1.5 });
  neon.push({ p: [0, -0.4, 14.5], s: [30, 0.06, 0.06], c: NEON.cyan, i: 1.5 });

  // Truss: 4 vigas principales
  body.push({ p: [0, 9, 15], s: [34, 0.2, 0.2], c: '#666666' });
  body.push({ p: [0, 9, -15], s: [34, 0.2, 0.2], c: '#666666' });
  body.push({ p: [-16, 9, 0], s: [0.2, 0.2, 30.4], c: '#666666' });
  body.push({ p: [16, 9, 0], s: [0.2, 0.2, 30.4], c: '#666666' });

  // Bases de las luces robóticas
  LIGHT_CONFIGS.forEach((cfg) => {
    body.push({ p: cfg.pos, s: [0.3, 0.25, 0.3], c: '#222222' });
  });

  return { body, cones, neon };
}

interface StageElementsProps {
  isPlayingRef: MutableRefObject<boolean>;
}

// Temporales reutilizados en el frame loop (cero allocations por frame)
const _pos = new THREE.Vector3();
const _off = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _euler = new THREE.Euler();
const _scale = new THREE.Vector3(1, 1, 1);
const _mat = new THREE.Matrix4();

export const StageElements: React.FC<StageElementsProps> = ({ isPlayingRef }) => {
  const frozenTimeRef = useRef<number>(0);
  // Estado de la coreografía "lerp" (caso 2) — compartido por las 6 cabezas
  const lerpRotRef = useRef({ x: 0, y: 0 });

  const staticMeshes = useMemo(() => {
    const { body, cones, neon } = buildStaticData();
    return [
      buildStaticInstances(GEO_BOX, MAT_BODY, body),
      buildStaticInstances(GEO_CIRCLE, MAT_BODY, cones),
      buildStaticInstances(GEO_BOX, MAT_NEON, neon),
    ];
  }, []);

  // Lentes y haces: instanciados pero animados (matrices por frame)
  const animated = useMemo(() => {
    const lensGeo = new THREE.CylinderGeometry(0.1, 0.12, 0.1, 12);
    const beamGeo = new THREE.ConeGeometry(2.5, 7.5, 8, 1, true);
    const lensMat = new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false, transparent: true, opacity: 0.9 });
    const beamMat = new THREE.MeshBasicMaterial({
      color: '#ffffff',
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const lens = new THREE.InstancedMesh(lensGeo, lensMat, LIGHT_COUNT);
    const beam = new THREE.InstancedMesh(beamGeo, beamMat, LIGHT_COUNT);
    const c = new THREE.Color();
    for (let i = 0; i < LIGHT_COUNT; i++) {
      lens.setColorAt(i, c.set(LIGHT_CONFIGS[i].color).multiplyScalar(2.5));
      beam.setColorAt(i, c.set(LIGHT_CONFIGS[i].color));
    }
    if (lens.instanceColor) lens.instanceColor.needsUpdate = true;
    if (beam.instanceColor) beam.instanceColor.needsUpdate = true;
    lens.frustumCulled = false;
    beam.frustumCulled = false;
    return { lens, beam, lensGeo, beamGeo, lensMat, beamMat };
  }, []);

  useEffect(() => {
    return () => {
      staticMeshes.forEach((m) => m.dispose());
      animated.lens.dispose();
      animated.beam.dispose();
      animated.lensGeo.dispose();
      animated.beamGeo.dispose();
      animated.lensMat.dispose();
      animated.beamMat.dispose();
    };
  }, [staticMeshes, animated]);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const t = frozenTimeRef.current;

    // Coreografía de cabezas (idéntica a la versión por-mesh; las 6 en sincronía)
    const cycle = Math.floor(t / 8) % 4;
    const local = (t % 8) / 8;
    let rotX = 0;
    let rotY = 0;
    let rotZ = 0;
    switch (cycle) {
      case 0:
        rotY = Math.sin(local * Math.PI * 2) * 0.7;
        rotX = -0.3;
        break;
      case 1:
        rotY = Math.sin(local * Math.PI * 4) * 0.6;
        rotX = Math.sin(local * Math.PI * 2) * 0.4;
        break;
      case 2: {
        const step = Math.floor(local * 5);
        const targets = [-0.6, 0.3, -0.2, 0.6, 0];
        lerpRotRef.current.y += (targets[step] - lerpRotRef.current.y) * 0.15;
        lerpRotRef.current.x += (-0.25 - lerpRotRef.current.x) * 0.15;
        rotY = lerpRotRef.current.y;
        rotX = lerpRotRef.current.x;
        break;
      }
      case 3:
        rotY = Math.sin(local * Math.PI * 3) * 0.5;
        rotX = Math.cos(local * Math.PI * 3) * 0.35 - 0.1;
        rotZ = Math.sin(local * Math.PI * 2) * 0.08;
        break;
    }
    if (cycle !== 2) {
      lerpRotRef.current.x = rotX;
      lerpRotRef.current.y = rotY;
    }
    _euler.set(rotX, rotY, rotZ);
    _quat.setFromEuler(_euler);

    // Parpadeo (blink corto + doble blink largo, igual que antes)
    const blinkCycle = t % 6;
    const blinkOff = blinkCycle > 5.5 && blinkCycle < 5.8;
    const dblCycle = t % 15;
    const dblBlink = (dblCycle > 12.0 && dblCycle < 12.15) || (dblCycle > 12.3 && dblCycle < 12.45);
    const visible = !blinkOff && !dblBlink;
    animated.beamMat.opacity = visible ? 0.12 : 0.01;
    animated.lensMat.color.setScalar(visible ? 1 : 0.08);

    // Matrices de lente y haz: pos = base + (0,-0.08,0) + R·offset
    for (let i = 0; i < LIGHT_COUNT; i++) {
      const base = LIGHT_CONFIGS[i].pos;

      _off.set(0, -0.15, 0).applyQuaternion(_quat);
      _pos.set(base[0], base[1] - 0.08, base[2]).add(_off);
      _mat.compose(_pos, _quat, _scale);
      animated.lens.setMatrixAt(i, _mat);

      _off.set(0, -4, 0).applyQuaternion(_quat);
      _pos.set(base[0], base[1] - 0.08, base[2]).add(_off);
      _mat.compose(_pos, _quat, _scale);
      animated.beam.setMatrixAt(i, _mat);
    }
    animated.lens.instanceMatrix.needsUpdate = true;
    animated.beam.instanceMatrix.needsUpdate = true;
  });

  return (
    <group>
      {staticMeshes.map((m, idx) => (
        <primitive key={idx} object={m} />
      ))}
      <primitive object={animated.lens} />
      <primitive object={animated.beam} />
    </group>
  );
};
