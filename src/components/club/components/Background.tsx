'use client';

import React, { useRef, useMemo, Suspense, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
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

  const particleCount = 300;

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
  const { positions, colors } = useMemo(() => {
    const gridExtent = 30;
    const spacing = 3;
    const pts: number[] = [];
    const cols: number[] = [];
    const cBlue = new THREE.Color(COLORS.cyberBlue);
    const cPink = new THREE.Color(COLORS.neonPink);

    for (let x = -gridExtent; x <= gridExtent; x += spacing) {
      pts.push(x, -0.48, -gridExtent, x, -0.48, gridExtent);
      cols.push(cBlue.r, cBlue.g, cBlue.b, cBlue.r, cBlue.g, cBlue.b);
    }
    for (let z = -gridExtent; z <= gridExtent; z += spacing) {
      pts.push(-gridExtent, -0.48, z, gridExtent, -0.48, z);
      cols.push(cPink.r, cPink.g, cPink.b, cPink.r, cPink.g, cPink.b);
    }
    return { positions: new Float32Array(pts), colors: new Float32Array(cols) };
  }, []);

  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <lineBasicMaterial vertexColors transparent opacity={0.4} />
    </lineSegments>
  );
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

const Fireflies: React.FC<{ isPlayingRef: MutableRefObject<boolean> }> = ({ isPlayingRef }) => {
  const ref = useRef<THREE.Points>(null);
  const frozenTimeRef = useRef<number>(0);
  const count = 30;

  const basePositions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 4;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 14 - 2;
    }
    return pos;
  }, []);

  const colors = useMemo(() => {
    const cols = new Float32Array(count * 3);
    const fireflyColors = [new THREE.Color('#aaff00'), new THREE.Color('#ffcc00'), new THREE.Color('#88ff33')];
    for (let i = 0; i < count; i++) {
      const c = fireflyColors[Math.floor(Math.random() * fireflyColors.length)];
      cols[i * 3] = c.r;
      cols[i * 3 + 1] = c.g;
      cols[i * 3 + 2] = c.b;
    }
    return cols;
  }, []);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    if (ref.current) {
      const geo = ref.current.geometry;
      const posAttr = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < count; i++) {
        posAttr.setY(i, basePositions[i * 3 + 1] + Math.sin(frozenTimeRef.current * 0.5 + i * 2) * 0.3);
        posAttr.setX(i, basePositions[i * 3] + Math.sin(frozenTimeRef.current * 0.3 + i) * 0.2);
      }
      posAttr.needsUpdate = true;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[new Float32Array(basePositions), 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.18} vertexColors transparent opacity={0.9} sizeAttenuation />
    </points>
  );
};

const TexturedGround: React.FC = () => {
  const concreteTexture = useTexture('/textures/concrete.jpg');
  concreteTexture.wrapS = concreteTexture.wrapT = THREE.RepeatWrapping;
  concreteTexture.repeat.set(12, 12);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#ffffff" map={concreteTexture} roughness={0.95} />
    </mesh>
  );
};

const GroundPlane: React.FC = () => (
  <Suspense fallback={
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.55, 0]} receiveShadow>
      <planeGeometry args={[100, 100]} />
      <meshStandardMaterial color="#0a0a12" roughness={0.95} />
    </mesh>
  }>
    <TexturedGround />
  </Suspense>
);

export const Background: React.FC<BackgroundProps> = ({ isPlayingRef }) => {
  return (
    <group>
      <Particles isPlayingRef={isPlayingRef} />
      <InfiniteGrid />
      <LightBeams />
      <GroundPlane />
    </group>
  );
};
