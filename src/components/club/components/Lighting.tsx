'use client';

// Iluminación (WS-3): 7 → 4 luces (ambient, punto central, spot del DJ, 1 spot
// barredor). La pérdida de los 2 puntos de acento y el 2° barredor se compensa
// con el emissive base de MAT_BODY y subiendo levemente el ambient.
// Reactividad a la Energía del Club (M4/M5): lee stageRef/gloriaActiveRef por
// frame y lerpéa un factor global — Bajón 40%, media 70%, full 100%, GLORIA 110%.

import React, { useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useEnergy } from '../EnergyContext';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
};

/**
 * Consumo OPCIONAL de EnergyContext: el EnergyProvider lo monta WS-1 en
 * NightclubScene; hasta ese merge la escena debe seguir funcionando (factor 1).
 * useEnergy llama useContext SIEMPRE antes de lanzar, así que el orden de hooks
 * es estable aunque el provider no exista.
 */
export function useEnergyOptional(): ReturnType<typeof useEnergy> | null {
  try {
    return useEnergy();
  } catch {
    return null;
  }
}

// Intensidades base (con factor 1.0)
const BASE = {
  ambient: 1.35,
  mainPoint: 60,
  djSpot: 40,
  sweep: 25,
};

// Factor por etapa de energía
const STAGE_FACTOR = { full: 1.0, media: 0.7, bajon: 0.4 } as const;
const GLORIA_FACTOR = 1.1;

interface LightingProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const Lighting: React.FC<LightingProps> = ({ isPlayingRef }) => {
  const ambientRef = useRef<THREE.AmbientLight>(null);
  const mainPointRef = useRef<THREE.PointLight>(null);
  const djSpotRef = useRef<THREE.SpotLight>(null);
  const sweepRef = useRef<THREE.SpotLight>(null);
  const frozenTimeRef = useRef<number>(0);
  const factorRef = useRef(1);

  const energy = useEnergyOptional();

  useFrame(({ clock }, delta) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const time = frozenTimeRef.current;

    // Barrido del spot móvil (misma trayectoria que el spot 1 anterior)
    if (sweepRef.current) {
      sweepRef.current.target.position.x = Math.sin(time * 0.5) * 10;
      sweepRef.current.target.position.z = Math.cos(time * 0.5) * 10;
      sweepRef.current.target.updateMatrixWorld();
    }

    // Factor de energía con lerp suave (sin setState: refs puros)
    let target = 1;
    if (energy) {
      target = energy.gloriaActiveRef.current ? GLORIA_FACTOR : STAGE_FACTOR[energy.stageRef.current];
    }
    const dt = Math.min(delta, 0.05);
    factorRef.current += (target - factorRef.current) * Math.min(1, dt * 3);
    const f = factorRef.current;

    if (ambientRef.current) ambientRef.current.intensity = BASE.ambient * f;
    if (mainPointRef.current) mainPointRef.current.intensity = BASE.mainPoint * f;
    if (djSpotRef.current) djSpotRef.current.intensity = BASE.djSpot * f;
    if (sweepRef.current) sweepRef.current.intensity = BASE.sweep * f;
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={BASE.ambient} color="#222233" />
      <pointLight ref={mainPointRef} position={[0, 12, 0]} intensity={BASE.mainPoint} color="#ffffff" distance={60} decay={2} />
      {/* Spot del DJ — sin sombras por perf */}
      <spotLight
        ref={djSpotRef}
        position={[0, 8, 0]}
        angle={0.6}
        penumbra={0.4}
        intensity={BASE.djSpot}
        color={COLORS.neonPink}
        target-position={[0, 1.5, 0]}
      />
      {/* Spot barredor único */}
      <spotLight
        ref={sweepRef}
        position={[-10, 10, -5]}
        angle={0.35}
        penumbra={0.5}
        intensity={BASE.sweep}
        color={COLORS.cyberBlue}
      />
    </>
  );
};
