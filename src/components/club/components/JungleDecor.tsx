'use client';

import React, { MutableRefObject } from 'react';
import * as THREE from 'three';

const JUNGLE_GREENS = ['#00ff41', '#22cc33', '#118822', '#44ff66', '#009930'];

interface JungleDecorProps {
  isPlayingRef: MutableRefObject<boolean>;
}

// Static positions for corner columns
const COLUMN_CONFIGS: { pos: [number, number, number]; color: string }[] = [
  { pos: [-14, 2, -14], color: JUNGLE_GREENS[0] },
  { pos: [14, 2, -14], color: JUNGLE_GREENS[1] },
  { pos: [-14, 2, 14], color: JUNGLE_GREENS[3] },
  { pos: [14, 2, 14], color: JUNGLE_GREENS[4] },
];

// Static positions for foliage clusters (2 clusters)
const FOLIAGE_POSITIONS: [number, number, number][] = [
  [-15, -0.45, -10],
  [15, -0.45, 10],
];

// Static foliage blade data for each cluster (2 blades per cluster)
const FOLIAGE_BLADES: { angle: number; height: number; lean: number }[] = [
  { angle: 0, height: 0.5, lean: 0.5 },
  { angle: Math.PI, height: 0.4, lean: 0.6 },
];

const FoliageCluster: React.FC<{ position: [number, number, number] }> = ({ position }) => {
  return (
    <group position={position}>
      {FOLIAGE_BLADES.map((b, i) => (
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

export const JungleDecor: React.FC<JungleDecorProps> = () => {
  return (
    <group>
      {/* 4 simple green column boxes at corners */}
      {COLUMN_CONFIGS.map((c, i) => (
        <mesh key={`col-${i}`} position={c.pos}>
          <boxGeometry args={[0.15, 5, 0.15]} />
          <meshStandardMaterial
            color={c.color}
            emissive={c.color}
            emissiveIntensity={0.3}
            metalness={0.2}
            roughness={0.7}
          />
        </mesh>
      ))}

      {/* 2 foliage clusters with 2 planes each = 4 meshes */}
      {FOLIAGE_POSITIONS.map((pos, i) => (
        <FoliageCluster key={`foliage-${i}`} position={pos} />
      ))}
    </group>
  );
};
