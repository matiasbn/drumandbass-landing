'use client';

import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEnergy } from '../EnergyContext';
import { setLevitateUntil } from './SpecialEffects';

// ═══ CLUB DROP: el momento de "lo logramos" ═══════════════════════════
// Cuando la Energía del Club llega al máximo tiene que notarse. Esto monta
// tres capas que sólo existen durante el drop + la GLORIA:
//   1. El PISO cambia de color: un shader radial de ondas concéntricas y
//      radios giratorios que recorre el arcoíris sobre toda la pista.
//   2. HACES DE LUZ verticales girando alrededor del centro (aditivos).
//   3. Un anillo de choque que sale disparado desde el centro.
// Además hace LEVITAR a todos (jugador y bailarines) mientras dura.

const FLOOR_SIZE = 44; // cubre la pista ampliada
const BEAM_COUNT = 10;
const DROP_BURST_S = 5; // parte intensa (celebración) antes de la GLORIA

const floorVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Ondas concéntricas + radios giratorios, recorriendo el arcoíris.
const floorFragment = /* glsl */ `
  uniform float uTime;
  uniform float uIntensity; // 0..1
  varying vec2 vUv;

  vec3 hue(float h) {
    return 0.5 + 0.5 * cos(6.28318 * (h + vec3(0.0, 0.33, 0.67)));
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float r = length(p);
    float ang = atan(p.y, p.x);

    // Ondas que salen del centro
    float wave = sin(r * 16.0 - uTime * 7.0);
    float ring = smoothstep(0.55, 1.0, wave);

    // Radios que giran (aspas de luz)
    float spokes = smoothstep(0.55, 1.0, sin(ang * 8.0 + uTime * 2.2));

    // Pulso general al ritmo
    float pulse = 0.75 + 0.25 * sin(uTime * 9.0);

    vec3 col = hue(r * 0.5 - uTime * 0.18) * (ring * 1.1 + spokes * 0.45) * pulse;
    float fade = smoothstep(1.05, 0.15, r); // se desvanece hacia los bordes
    float a = (ring * 0.75 + spokes * 0.3) * fade * uIntensity;
    gl_FragColor = vec4(col, a);
  }
`;

export const ClubDropSpectacle: React.FC = () => {
  const { subscribe } = useEnergy();

  const groupRef = useRef<THREE.Group>(null);
  const floorMatRef = useRef<THREE.ShaderMaterial>(null);
  const beamsRef = useRef<THREE.Group>(null);
  const ringRef = useRef<THREE.Mesh>(null);
  const ringMatRef = useRef<THREE.MeshBasicMaterial>(null);

  // Estado del espectáculo en refs (cero re-renders)
  const activeRef = useRef(false);
  const startedAtRef = useRef(0);
  const intensityRef = useRef(0); // 0..1 suavizado

  const floorUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uIntensity: { value: 0 } }),
    [],
  );

  // Colores de los haces (paleta neón del club)
  const beamColors = useMemo(
    () => ['#ff0055', '#00ccff', '#00ff41', '#ffee00', '#ff00ff'],
    [],
  );

  useEffect(() => {
    const unsub = subscribe((ev) => {
      if (ev.type === 'clubDrop') {
        activeRef.current = true;
        startedAtRef.current = 0; // lo fija el primer frame
      } else if (ev.type === 'gloriaEnd') {
        activeRef.current = false;
      }
    });
    return unsub;
  }, [subscribe]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const group = groupRef.current;
    if (!group) return;

    if (activeRef.current && startedAtRef.current === 0) startedAtRef.current = t;
    const since = t - startedAtRef.current;

    // Intensidad objetivo: pico en la explosión inicial, sostenida en la GLORIA
    const target = activeRef.current ? (since < DROP_BURST_S ? 1 : 0.62) : 0;
    intensityRef.current += (target - intensityRef.current) * Math.min(1, 3 * 0.016);

    const vis = intensityRef.current > 0.01;
    group.visible = vis;
    if (!vis) return;

    // Todos levitan mientras dura el espectáculo
    if (activeRef.current) setLevitateUntil(t + 0.2);

    // Piso shader
    if (floorMatRef.current) {
      floorMatRef.current.uniforms.uTime.value = t;
      floorMatRef.current.uniforms.uIntensity.value = intensityRef.current;
    }

    // Haces girando
    if (beamsRef.current) {
      beamsRef.current.rotation.y = t * 0.55;
      const s = 0.85 + Math.sin(t * 6) * 0.15;
      beamsRef.current.scale.set(1, s, 1);
    }

    // Anillo de choque: se expande en el primer segundo del drop
    if (ringRef.current && ringMatRef.current) {
      const p = Math.min(1, since / 1.2);
      const radius = p * 26;
      ringRef.current.scale.set(radius, radius, 1);
      ringMatRef.current.opacity = (1 - p) * 0.9 * intensityRef.current;
      ringRef.current.visible = p < 1;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/* 1. El piso cambia de color (shader radial arcoíris) */}
      <mesh position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[FLOOR_SIZE, FLOOR_SIZE]} />
        <shaderMaterial
          ref={floorMatRef}
          vertexShader={floorVertex}
          fragmentShader={floorFragment}
          uniforms={floorUniforms}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 2. Haces de luz verticales girando alrededor del centro */}
      <group ref={beamsRef}>
        {Array.from({ length: BEAM_COUNT }, (_, i) => {
          const ang = (i / BEAM_COUNT) * Math.PI * 2;
          const rad = 9;
          return (
            <mesh
              key={`beam-${i}`}
              position={[Math.cos(ang) * rad, 7, Math.sin(ang) * rad]}
              rotation={[0, 0, Math.cos(ang) * 0.22]}
            >
              <coneGeometry args={[1.5, 15, 10, 1, true]} />
              <meshBasicMaterial
                color={beamColors[i % beamColors.length]}
                transparent
                opacity={0.22}
                side={THREE.DoubleSide}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          );
        })}
      </group>

      {/* 3. Anillo de choque desde el centro */}
      <mesh ref={ringRef} position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.9, 1, 64]} />
        <meshBasicMaterial
          ref={ringMatRef}
          color="#ffffff"
          transparent
          opacity={0}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
};
