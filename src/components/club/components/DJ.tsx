'use client';

import React, { useRef, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COLORS = {
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
};

interface DJProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const DJ: React.FC<DJProps> = ({ isPlayingRef }) => {
  const headRef = useRef<THREE.Mesh>(null);
  const leftArmRef = useRef<THREE.Group>(null);
  const rightArmRef = useRef<THREE.Group>(null);
  const frozenTimeRef = useRef<number>(0);

  useFrame(({ clock }) => {
    const isPlaying = isPlayingRef.current;

    if (isPlaying) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    const time = frozenTimeRef.current;

    if (headRef.current) {
      headRef.current.position.y = 2.2 + Math.sin(time * 4) * 0.05;
      headRef.current.rotation.y = Math.sin(time * 2) * 0.2;
    }

    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = Math.sin(time * 6) * 0.3 - 0.5;
      leftArmRef.current.rotation.z = -0.3 + Math.sin(time * 3) * 0.1;
    }

    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = Math.sin(time * 4 + 1) * 0.2 - 0.4;
      rightArmRef.current.rotation.z = 0.3 + Math.cos(time * 5) * 0.15;
    }
  });

  return (
    <group position={[0, 0, -4.8]}>
      <mesh position={[0, 1.4, 0]} castShadow>
        <boxGeometry args={[0.6, 0.8, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      <mesh ref={headRef} position={[0, 2.2, 0]} castShadow>
        <boxGeometry args={[0.4, 0.45, 0.35]} />
        <meshStandardMaterial color="#e0c4a8" />
      </mesh>

      <group position={[0, 2.25, 0]}>
        <mesh>
          <torusGeometry args={[0.25, 0.03, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
        <mesh position={[-0.28, -0.1, 0]}>
          <boxGeometry args={[0.08, 0.15, 0.1]} />
          <meshStandardMaterial color={COLORS.neonPink} emissive={COLORS.neonPink} emissiveIntensity={0.3} />
        </mesh>
        <mesh position={[0.28, -0.1, 0]}>
          <boxGeometry args={[0.08, 0.15, 0.1]} />
          <meshStandardMaterial color={COLORS.neonPink} emissive={COLORS.neonPink} emissiveIntensity={0.3} />
        </mesh>
      </group>

      <mesh position={[0, 2.25, 0.18]}>
        <boxGeometry args={[0.35, 0.08, 0.02]} />
        <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={0.5} transparent opacity={0.8} />
      </mesh>

      <group ref={leftArmRef} position={[-0.45, 1.6, 0]}>
        <mesh position={[-0.15, -0.2, 0.1]} castShadow>
          <boxGeometry args={[0.15, 0.4, 0.15]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[-0.25, -0.5, 0.25]} castShadow>
          <boxGeometry args={[0.12, 0.35, 0.12]} />
          <meshStandardMaterial color="#e0c4a8" />
        </mesh>
        <mesh position={[-0.3, -0.7, 0.35]} castShadow>
          <boxGeometry args={[0.1, 0.12, 0.08]} />
          <meshStandardMaterial color="#e0c4a8" />
        </mesh>
      </group>

      <group ref={rightArmRef} position={[0.45, 1.6, 0]}>
        <mesh position={[0.15, -0.2, 0.1]} castShadow>
          <boxGeometry args={[0.15, 0.4, 0.15]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
        <mesh position={[0.25, -0.5, 0.25]} castShadow>
          <boxGeometry args={[0.12, 0.35, 0.12]} />
          <meshStandardMaterial color="#e0c4a8" />
        </mesh>
        <mesh position={[0.3, -0.7, 0.35]} castShadow>
          <boxGeometry args={[0.1, 0.12, 0.08]} />
          <meshStandardMaterial color="#e0c4a8" />
        </mesh>
      </group>

      <mesh position={[-0.15, 0.5, 0]} castShadow>
        <boxGeometry args={[0.2, 0.8, 0.25]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[0.15, 0.5, 0]} castShadow>
        <boxGeometry args={[0.2, 0.8, 0.25]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
    </group>
  );
};
