'use client';

import React, { useRef, useMemo, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
  warningOrange: '#ff8800',
};

interface BackgroundProps {
  isPlayingRef: MutableRefObject<boolean>;
}

const Particles: React.FC<{ isPlayingRef: MutableRefObject<boolean> }> = ({ isPlayingRef }) => {
  const particlesRef = useRef<THREE.Points>(null);
  const frozenTimeRef = useRef<number>(0);

  const particleCount = 150;

  const positions = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 50;
      pos[i * 3 + 1] = Math.random() * 15;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 50;
    }
    return pos;
  }, []);

  const colors = useMemo(() => {
    const cols = new Float32Array(particleCount * 3);
    const colorOptions = [
      new THREE.Color(COLORS.matrixGreen),
      new THREE.Color(COLORS.cyberBlue),
      new THREE.Color(COLORS.neonPink),
      new THREE.Color(COLORS.warningOrange),
    ];
    for (let i = 0; i < particleCount; i++) {
      const color = colorOptions[Math.floor(Math.random() * colorOptions.length)];
      cols[i * 3] = color.r;
      cols[i * 3 + 1] = color.g;
      cols[i * 3 + 2] = color.b;
    }
    return cols;
  }, []);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = frozenTimeRef.current * 0.02;
    }
  });

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[colors, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
      />
    </points>
  );
};

const InfiniteGrid: React.FC = () => {
  const gridLines = useMemo(() => {
    const lines: React.JSX.Element[] = [];
    const gridExtent = 30;
    const spacing = 3;

    for (let x = -gridExtent; x <= gridExtent; x += spacing) {
      lines.push(
        <mesh key={`z-line-${x}`} position={[x, -0.48, 0]}>
          <boxGeometry args={[0.03, 0.01, gridExtent * 2]} />
          <meshBasicMaterial color={COLORS.cyberBlue} transparent opacity={0.4} />
        </mesh>
      );
    }

    for (let z = -gridExtent; z <= gridExtent; z += spacing) {
      lines.push(
        <mesh key={`x-line-${z}`} position={[0, -0.48, z]}>
          <boxGeometry args={[gridExtent * 2, 0.01, 0.03]} />
          <meshBasicMaterial color={COLORS.neonPink} transparent opacity={0.4} />
        </mesh>
      );
    }

    return lines;
  }, []);

  return <group>{gridLines}</group>;
};

const LightBeams: React.FC = () => {
  const beamPositions = useMemo(() => {
    const positions: [number, number, number][] = [];
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const radius = 18 + Math.random() * 5;
      positions.push([
        Math.cos(angle) * radius,
        6,
        Math.sin(angle) * radius,
      ]);
    }
    return positions;
  }, []);

  const colorArray = [COLORS.cyberBlue, COLORS.neonPink, COLORS.matrixGreen, COLORS.warningOrange];

  return (
    <group>
      {beamPositions.map((pos, i) => (
        <mesh key={i} position={pos}>
          <boxGeometry args={[0.15, 14, 0.15]} />
          <meshBasicMaterial
            color={colorArray[i % colorArray.length]}
            transparent
            opacity={0.15}
          />
        </mesh>
      ))}
    </group>
  );
};

export const Background: React.FC<BackgroundProps> = ({ isPlayingRef }) => {
  return (
    <group>
      <Particles isPlayingRef={isPlayingRef} />
      <InfiniteGrid />
      <LightBeams />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#080810" />
      </mesh>
    </group>
  );
};
