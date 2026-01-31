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
    const isPlaying = isPlayingRef.current;

    if (isPlaying) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const time = frozenTimeRef.current;

    if (spotLight1Ref.current) {
      spotLight1Ref.current.target.position.x = Math.sin(time * 0.5) * 4;
      spotLight1Ref.current.target.position.z = Math.cos(time * 0.5) * 4;
      spotLight1Ref.current.target.updateMatrixWorld();
    }
    if (spotLight2Ref.current) {
      spotLight2Ref.current.target.position.x = Math.sin(time * 0.7 + Math.PI) * 4;
      spotLight2Ref.current.target.position.z = Math.cos(time * 0.7 + Math.PI) * 4;
      spotLight2Ref.current.target.updateMatrixWorld();
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} color="#222233" />
      <pointLight position={[0, 10, 0]} intensity={50} color="#ffffff" distance={30} decay={2} />
      <spotLight
        position={[0, 6, -2]}
        angle={0.5}
        penumbra={0.4}
        intensity={40}
        color={COLORS.neonPink}
        castShadow
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        target-position={[0, 1, -4]}
      />
      <spotLight
        ref={spotLight1Ref}
        position={[-5, 8, -2]}
        angle={0.35}
        penumbra={0.5}
        intensity={25}
        color={COLORS.cyberBlue}
      />
      <spotLight
        ref={spotLight2Ref}
        position={[5, 8, -2]}
        angle={0.35}
        penumbra={0.5}
        intensity={25}
        color={COLORS.neonPink}
      />
      <pointLight position={[-4, 0.5, 0]} intensity={8} color={COLORS.cyberBlue} distance={8} decay={2} />
      <pointLight position={[4, 0.5, 0]} intensity={8} color={COLORS.neonPink} distance={8} decay={2} />
      <pointLight position={[0, 0.5, 4]} intensity={8} color={COLORS.matrixGreen} distance={8} decay={2} />
    </>
  );
};
