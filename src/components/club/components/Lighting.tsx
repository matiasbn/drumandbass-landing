'use client';

import React, { useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
};

interface LightingProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const Lighting: React.FC<LightingProps> = ({ isPlayingRef }) => {
  const spotLight1Ref = useRef<THREE.SpotLight>(null);
  const spotLight2Ref = useRef<THREE.SpotLight>(null);
  const frozenTimeRef = useRef<number>(0);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const time = frozenTimeRef.current;

    if (spotLight1Ref.current) {
      spotLight1Ref.current.target.position.x = Math.sin(time * 0.5) * 10;
      spotLight1Ref.current.target.position.z = Math.cos(time * 0.5) * 10;
      spotLight1Ref.current.target.updateMatrixWorld();
    }
    if (spotLight2Ref.current) {
      spotLight2Ref.current.target.position.x = Math.sin(time * 0.7 + Math.PI) * 10;
      spotLight2Ref.current.target.position.z = Math.cos(time * 0.7 + Math.PI) * 10;
      spotLight2Ref.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <ambientLight intensity={1.2} color="#222233" />
      <pointLight position={[0, 12, 0]} intensity={60} color="#ffffff" distance={60} decay={2} />
      {/* DJ spotlight — no shadow for perf */}
      <spotLight
        position={[0, 8, 0]}
        angle={0.6}
        penumbra={0.4}
        intensity={40}
        color={COLORS.neonPink}
        target-position={[0, 1.5, 0]}
      />
      {/* Sweeping spotlights */}
      <spotLight
        ref={spotLight1Ref}
        position={[-10, 10, -5]}
        angle={0.35}
        penumbra={0.5}
        intensity={25}
        color={COLORS.cyberBlue}
      />
      <spotLight
        ref={spotLight2Ref}
        position={[10, 10, 5]}
        angle={0.35}
        penumbra={0.5}
        intensity={25}
        color={COLORS.neonPink}
      />
      {/* 2 accent lights instead of 4+2 */}
      <pointLight position={[-8, 0.5, -8]} intensity={6} color={COLORS.cyberBlue} distance={12} decay={2} />
      <pointLight position={[8, 0.5, 8]} intensity={6} color={COLORS.matrixGreen} distance={12} decay={2} />
    </>
  );
};
