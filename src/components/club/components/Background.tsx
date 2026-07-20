'use client';

// Fondo del club (WS-3): partículas (÷2 en calidad baja), grid de líneas,
// 6 vigas de luz lejanas ahora en 1 InstancedMesh, y suelo texturizado.
// ≈ 4 draw calls.

import React, { useRef, useMemo, useEffect, Suspense, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { NEON } from '../materials';
import { useQuality } from '../quality';

const COLORS = {
  matrixGreen: NEON.green,
  cyberBlue: NEON.cyan,
  neonPink: NEON.pink,
  warningOrange: NEON.orange,
};

interface BackgroundProps {
  isPlayingRef: MutableRefObject<boolean>;
}

const Particles: React.FC<{ isPlayingRef: MutableRefObject<boolean> }> = ({ isPlayingRef }) => {
  const particlesRef = useRef<THREE.Points>(null);
  const frozenTimeRef = useRef<number>(0);
  const quality = useQuality();

  // Calidad baja: partículas ÷2
  const particleCount = quality === 'baja' ? 75 : 150;

  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 80;
      pos[i * 3 + 1] = Math.random() * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 80;
    }
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
    return { positions: pos, colors: cols };
  }, [particleCount]);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    if (particlesRef.current) {
      particlesRef.current.rotation.y = frozenTimeRef.current * 0.02;
    }
  });

  return (
    <points ref={particlesRef} key={particleCount}>
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
    const spacing = 4;
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

// 6 vigas de luz lejanas → 1 InstancedMesh (antes 6 meshes)
const LightBeams: React.FC = () => {
  const mesh = useMemo(() => {
    const colorArray = [COLORS.cyberBlue, COLORS.neonPink, COLORS.matrixGreen, COLORS.warningOrange];
    const geo = new THREE.BoxGeometry(0.15, 14, 0.15);
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.15 });
    const im = new THREE.InstancedMesh(geo, mat, 6);
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const radius = 28 + Math.random() * 8;
      m.makeTranslation(Math.cos(angle) * radius, 6, Math.sin(angle) * radius);
      im.setMatrixAt(i, m);
      im.setColorAt(i, c.set(colorArray[i % colorArray.length]));
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    im.frustumCulled = false;
    return im;
  }, []);

  useEffect(() => {
    return () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    };
  }, [mesh]);

  return <primitive object={mesh} />;
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
