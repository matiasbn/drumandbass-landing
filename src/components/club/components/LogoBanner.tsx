'use client';

import React from 'react';
import { useTexture } from '@react-three/drei';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
};

export const LogoBanner: React.FC = () => {
  const texture = useTexture('/logo.png');

  return (
    <group position={[0, 0, -5]}>
      <mesh position={[0, 4.5, 0]}>
        <boxGeometry args={[4.2, 2.2, 0.1]} />
        <meshStandardMaterial color="#0a0a0a" emissive={COLORS.cyberBlue} emissiveIntensity={0.05} />
      </mesh>

      <mesh position={[0, 4.5, 0.06]}>
        <planeGeometry args={[3.8, 1.9]} />
        <meshStandardMaterial map={texture} transparent emissive="#ffffff" emissiveIntensity={0.3} emissiveMap={texture} />
      </mesh>

      <mesh position={[0, 5.65, 0.05]}>
        <boxGeometry args={[4.3, 0.08, 0.02]} />
        <meshStandardMaterial color={COLORS.matrixGreen} emissive={COLORS.matrixGreen} emissiveIntensity={1} />
      </mesh>

      <mesh position={[0, 3.35, 0.05]}>
        <boxGeometry args={[4.3, 0.08, 0.02]} />
        <meshStandardMaterial color={COLORS.matrixGreen} emissive={COLORS.matrixGreen} emissiveIntensity={1} />
      </mesh>

      <mesh position={[-2.11, 4.5, 0.05]}>
        <boxGeometry args={[0.08, 2.3, 0.02]} />
        <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={1} />
      </mesh>

      <mesh position={[2.11, 4.5, 0.05]}>
        <boxGeometry args={[0.08, 2.3, 0.02]} />
        <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={1} />
      </mesh>

      <mesh position={[-1.8, 2.5, -0.2]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[1.8, 2.5, -0.2]}>
        <cylinderGeometry args={[0.05, 0.05, 3, 8]} />
        <meshStandardMaterial color="#333333" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  );
};
