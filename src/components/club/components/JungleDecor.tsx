'use client';

import React, { useRef, useMemo, MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const JUNGLE_GREENS = ['#00ff41', '#22cc33', '#118822', '#44ff66', '#009930'];

interface JungleDecorProps {
  isPlayingRef: MutableRefObject<boolean>;
}

// A single bamboo pole with leaves at joints
const BambooPole: React.FC<{
  position: [number, number, number];
  height: number;
  lean: [number, number];
  color: string;
}> = ({ position, height, lean, color }) => {
  const segments = Math.floor(height / 0.8);
  return (
    <group position={position} rotation={[lean[0], 0, lean[1]]}>
      {/* Main stalk */}
      <mesh position={[0, height / 2, 0]}>
        <cylinderGeometry args={[0.06, 0.08, height, 6]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          metalness={0.2}
          roughness={0.7}
        />
      </mesh>
      {/* Joint rings */}
      {Array.from({ length: segments }).map((_, i) => (
        <mesh key={i} position={[0, (i + 1) * 0.8, 0]}>
          <cylinderGeometry args={[0.09, 0.09, 0.05, 6]} />
          <meshStandardMaterial color="#116622" emissive="#116622" emissiveIntensity={0.2} />
        </mesh>
      ))}
      {/* Leaves at top */}
      {[0, 1.2, 2.4, 3.6].map((rot, i) => (
        <mesh
          key={`leaf-${i}`}
          position={[Math.sin(rot) * 0.3, height - 0.2 + i * 0.1, Math.cos(rot) * 0.3]}
          rotation={[0.3 + i * 0.1, rot, 0.5]}
        >
          <planeGeometry args={[0.5, 0.15]} />
          <meshStandardMaterial
            color="#22cc33"
            emissive="#22cc33"
            emissiveIntensity={0.4}
            side={THREE.DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}
    </group>
  );
};

// Hanging vine using tube geometry
const HangingVine: React.FC<{
  points: THREE.Vector3[];
  color: string;
  isPlayingRef: MutableRefObject<boolean>;
  swayOffset: number;
}> = ({ points, color, isPlayingRef, swayOffset }) => {
  const vineRef = useRef<THREE.Group>(null);
  const frozenTimeRef = useRef<number>(0);

  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    if (vineRef.current) {
      vineRef.current.rotation.z = Math.sin(frozenTimeRef.current * 0.8 + swayOffset) * 0.03;
      vineRef.current.rotation.x = Math.cos(frozenTimeRef.current * 0.6 + swayOffset) * 0.02;
    }
  });

  return (
    <group ref={vineRef}>
      <mesh>
        <tubeGeometry args={[curve, 10, 0.025, 5, false]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.25}
          roughness={0.8}
        />
      </mesh>
      {/* Small leaves along the vine */}
      {[0.3, 0.5, 0.7].map((t, i) => {
        const p = curve.getPoint(t);
        return (
          <mesh key={i} position={p} rotation={[0, i * 1.5, Math.PI * 0.3]}>
            <planeGeometry args={[0.2, 0.1]} />
            <meshStandardMaterial
              color="#33dd44"
              emissive="#33dd44"
              emissiveIntensity={0.3}
              side={THREE.DoubleSide}
              transparent
              opacity={0.8}
            />
          </mesh>
        );
      })}
    </group>
  );
};

// Ground-level fern/foliage cluster
const FoliageCluster: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  const blades = useMemo(() => {
    return Array.from({ length: 6 }).map((_, i) => ({
      angle: (i / 6) * Math.PI * 2 + Math.random() * 0.3,
      height: 0.3 + Math.random() * 0.4,
      lean: 0.4 + Math.random() * 0.3,
    }));
  }, []);

  return (
    <group position={position}>
      {blades.map((b, i) => (
        <mesh
          key={i}
          position={[Math.sin(b.angle) * 0.12, b.height / 2, Math.cos(b.angle) * 0.12]}
          rotation={[b.lean * Math.cos(b.angle), b.angle, b.lean * Math.sin(b.angle)]}
        >
          <planeGeometry args={[0.08, b.height]} />
          <meshStandardMaterial
            color={JUNGLE_GREENS[i % JUNGLE_GREENS.length]}
            emissive={JUNGLE_GREENS[i % JUNGLE_GREENS.length]}
            emissiveIntensity={0.3}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

// Tiki-style torch with glowing flame
const TikiTorch: React.FC<{
  position: [number, number, number];
  isPlayingRef: MutableRefObject<boolean>;
  flameColor: string;
}> = ({ position, isPlayingRef, flameColor }) => {
  const flameRef = useRef<THREE.Mesh>(null);
  const frozenTimeRef = useRef<number>(0);

  useFrame(({ clock }) => {
    if (isPlayingRef.current) {
      frozenTimeRef.current = clock.getElapsedTime();
    }
    if (flameRef.current) {
      flameRef.current.scale.y = 1 + Math.sin(frozenTimeRef.current * 6 + position[0]) * 0.3;
      flameRef.current.scale.x = 1 + Math.sin(frozenTimeRef.current * 5 + position[2]) * 0.15;
    }
  });

  return (
    <group position={position}>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.04, 0.06, 2, 6]} />
        <meshStandardMaterial color="#3d2b1f" roughness={0.9} />
      </mesh>
      <mesh position={[0, 2.05, 0]}>
        <cylinderGeometry args={[0.12, 0.08, 0.15, 8]} />
        <meshStandardMaterial color="#2a1f14" roughness={0.85} />
      </mesh>
      <mesh ref={flameRef} position={[0, 2.25, 0]}>
        <coneGeometry args={[0.08, 0.3, 6]} />
        <meshStandardMaterial
          color={flameColor}
          emissive={flameColor}
          emissiveIntensity={3}
          transparent
          opacity={0.85}
        />
      </mesh>
      <pointLight position={[0, 2.3, 0]} intensity={3} color={flameColor} distance={4} decay={2} />
    </group>
  );
};

export const JungleDecor: React.FC<JungleDecorProps> = ({ isPlayingRef }) => {
  // Bamboo poles around the DJ/stage area and dancefloor edges
  const bambooConfig = useMemo(() => [
    // Behind DJ
    { pos: [-5, -0.5, -7] as [number, number, number], h: 6, lean: [0, 0.05] as [number, number], color: JUNGLE_GREENS[0] },
    { pos: [5, -0.5, -7] as [number, number, number], h: 5.5, lean: [0, -0.06] as [number, number], color: JUNGLE_GREENS[1] },
    { pos: [-8, -0.5, -6] as [number, number, number], h: 5.2, lean: [0.02, 0.06] as [number, number], color: JUNGLE_GREENS[2] },
    { pos: [8, -0.5, -6] as [number, number, number], h: 4.7, lean: [-0.02, -0.04] as [number, number], color: JUNGLE_GREENS[3] },
    // Sides of dancefloor
    { pos: [-7.5, -0.5, -2] as [number, number, number], h: 6.5, lean: [0.03, 0.04] as [number, number], color: JUNGLE_GREENS[4] },
    { pos: [7.5, -0.5, -2] as [number, number, number], h: 6.2, lean: [-0.02, -0.05] as [number, number], color: JUNGLE_GREENS[0] },
    { pos: [-7.5, -0.5, 2] as [number, number, number], h: 5.5, lean: [0.04, 0.03] as [number, number], color: JUNGLE_GREENS[1] },
    { pos: [7.5, -0.5, 2] as [number, number, number], h: 5.8, lean: [-0.03, -0.04] as [number, number], color: JUNGLE_GREENS[2] },
    // Front corners
    { pos: [-7.5, -0.5, 6] as [number, number, number], h: 5, lean: [0.03, 0.05] as [number, number], color: JUNGLE_GREENS[3] },
    { pos: [7.5, -0.5, 6] as [number, number, number], h: 4.8, lean: [-0.02, -0.05] as [number, number], color: JUNGLE_GREENS[4] },
    // Extra near DJ
    { pos: [0, -0.5, -7.5] as [number, number, number], h: 4.5, lean: [0.04, 0] as [number, number], color: JUNGLE_GREENS[0] },
    { pos: [-3, -0.5, -7] as [number, number, number], h: 5, lean: [0.02, 0.03] as [number, number], color: JUNGLE_GREENS[3] },
    { pos: [3, -0.5, -7] as [number, number, number], h: 4.8, lean: [-0.02, -0.03] as [number, number], color: JUNGLE_GREENS[4] },
  ], []);

  // Vines hanging from truss rig
  const vineConfigs = useMemo(() => [
    { points: [new THREE.Vector3(-6, 8, -2.5), new THREE.Vector3(-6.3, 5.5, -3), new THREE.Vector3(-5.8, 3, -3.5)], color: '#22aa33', offset: 0 },
    { points: [new THREE.Vector3(6, 8, -2.5), new THREE.Vector3(6.2, 5, -3.2), new THREE.Vector3(5.6, 2.5, -3.8)], color: '#33cc44', offset: 1.5 },
    { points: [new THREE.Vector3(-3, 8, -6), new THREE.Vector3(-3.4, 6, -6.2), new THREE.Vector3(-3.8, 4.5, -5.8)], color: '#28bb38', offset: 3 },
    { points: [new THREE.Vector3(3, 8, -6), new THREE.Vector3(2.6, 6.5, -6.3), new THREE.Vector3(2.2, 5, -6)], color: '#22cc33', offset: 4.5 },
    { points: [new THREE.Vector3(-2, 8, 1), new THREE.Vector3(-2.3, 6, 1.2), new THREE.Vector3(-2.6, 4, 0.7)], color: '#33dd44', offset: 2 },
    { points: [new THREE.Vector3(2, 8, 1), new THREE.Vector3(2.4, 5.5, 0.9), new THREE.Vector3(2.8, 3.5, 1.3)], color: '#22aa33', offset: 5 },
    { points: [new THREE.Vector3(0, 8, -6), new THREE.Vector3(0.3, 6, -6.5), new THREE.Vector3(-0.2, 4, -6.2)], color: '#33cc44', offset: 1 },
    { points: [new THREE.Vector3(-8, 8, -2.5), new THREE.Vector3(-8.2, 6, -2), new THREE.Vector3(-8, 4, -1.5)], color: '#28bb38', offset: 3.5 },
    { points: [new THREE.Vector3(8, 8, -2.5), new THREE.Vector3(8.3, 6, -3), new THREE.Vector3(8, 4, -2)], color: '#22aa33', offset: 4 },
    { points: [new THREE.Vector3(-5, 8, 1), new THREE.Vector3(-5.2, 6.5, 0.5), new THREE.Vector3(-5.5, 5, 0)], color: '#33dd44', offset: 2.5 },
  ], []);

  // Ground foliage positions - around dancefloor perimeter
  const foliagePositions: [number, number, number][] = useMemo(() => [
    [-7.5, -0.45, -5.5],
    [7.5, -0.45, -5.5],
    [-7.5, -0.45, -1.5],
    [7.5, -0.45, -1.5],
    [-7.5, -0.45, 2.5],
    [7.5, -0.45, 2.5],
    [-7.5, -0.45, 5.5],
    [7.5, -0.45, 5.5],
    [-4.5, -0.45, -6.5],
    [4.5, -0.45, -6.5],
    [0, -0.45, -7],
    [-2, -0.45, 7],
    [2, -0.45, 7],
  ], []);

  return (
    <group>
      {/* Bamboo poles */}
      {bambooConfig.map((b, i) => (
        <BambooPole key={`bamboo-${i}`} position={b.pos} height={b.h} lean={b.lean} color={b.color} />
      ))}

      {/* Hanging vines */}
      {vineConfigs.map((v, i) => (
        <HangingVine
          key={`vine-${i}`}
          points={v.points}
          color={v.color}
          isPlayingRef={isPlayingRef}
          swayOffset={v.offset}
        />
      ))}

      {/* Ground foliage */}
      {foliagePositions.map((pos, i) => (
        <FoliageCluster key={`foliage-${i}`} position={pos} />
      ))}

    </group>
  );
};
