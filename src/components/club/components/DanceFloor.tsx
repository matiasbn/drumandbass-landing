'use client';

import React, { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';
import { MAP } from '../constants';

const colorArray = [
  '#1a0a2e',
  '#0d1b2a',
  '#1b1128',
  '#0a1628',
  '#12062e',
  '#0f1a24',
];

export const DanceFloor: React.FC = () => {
  const gridSize = MAP.floorSize;
  const tileSize = MAP.tileSize;
  const stageHalf = MAP.stageHalfSize;

  const tileData = useMemo(() => {
    const data: { position: [number, number, number]; colorIndex: number }[] = [];
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        const wx = (x - gridSize / 2 + 0.5) * tileSize;
        const wz = (z - gridSize / 2 + 0.5) * tileSize;
        // Skip tiles inside the center stage area (rendered separately)
        if (Math.abs(wx) < stageHalf + 0.5 && Math.abs(wz) < stageHalf + 0.5) continue;
        data.push({
          position: [wx, 0, wz],
          colorIndex: (x + z) % colorArray.length,
        });
      }
    }
    return data;
  }, [gridSize, tileSize, stageHalf]);

  const tilesByColor = useMemo(() => {
    const grouped: Record<number, [number, number, number][]> = {};
    colorArray.forEach((_, i) => { grouped[i] = []; });
    tileData.forEach(({ position, colorIndex }) => {
      grouped[colorIndex].push(position);
    });
    return grouped;
  }, [tileData]);

  const maxPerColor = Math.ceil((gridSize * gridSize) / colorArray.length);

  return (
    <group position={[0, -0.5, 0]}>
      {/* Ground base */}
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[gridSize * tileSize + 0.5, 0.2, gridSize * tileSize + 0.5]} />
        <meshStandardMaterial color="#0a0a0f" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Ground floor tiles (around perimeter, outside center stage) */}
      {colorArray.map((color, colorIndex) => (
        <Instances key={colorIndex} limit={maxPerColor}>
          <boxGeometry args={[tileSize - 0.05, 0.1, tileSize - 0.05]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.6}
            metalness={0.3}
            roughness={0.7}
          />
          {tilesByColor[colorIndex].map((pos, i) => (
            <Instance key={i} position={pos} />
          ))}
        </Instances>
      ))}

      {/* Center Stage — full elevated level */}
      <mesh position={[0, MAP.djPlatformHeight / 2, 0]}>
        <boxGeometry args={[stageHalf * 2, MAP.djPlatformHeight, stageHalf * 2]} />
        <meshStandardMaterial color="#0e0e18" metalness={0.5} roughness={0.4} emissive="#0a0a12" emissiveIntensity={0.2} />
      </mesh>
      {/* Stage top surface — lighter than walls for contrast */}
      <mesh position={[0, MAP.djPlatformHeight + 0.01, 0]}>
        <boxGeometry args={[stageHalf * 2, 0.02, stageHalf * 2]} />
        <meshStandardMaterial color="#1e1e35" metalness={0.4} roughness={0.5} emissive="#1a1a2e" emissiveIntensity={0.5} />
      </mesh>

      {/* Top edge glow strips */}
      <mesh position={[0, MAP.djPlatformHeight + 0.02, stageHalf]}>
        <boxGeometry args={[stageHalf * 2, 0.06, 0.06]} />
        <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={3} />
      </mesh>
      <mesh position={[0, MAP.djPlatformHeight + 0.02, -stageHalf]}>
        <boxGeometry args={[stageHalf * 2, 0.06, 0.06]} />
        <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={3} />
      </mesh>
      <mesh position={[-stageHalf, MAP.djPlatformHeight + 0.02, 0]}>
        <boxGeometry args={[0.06, 0.06, stageHalf * 2]} />
        <meshStandardMaterial color="#00ccff" emissive="#00ccff" emissiveIntensity={2} />
      </mesh>
      <mesh position={[stageHalf, MAP.djPlatformHeight + 0.02, 0]}>
        <boxGeometry args={[0.06, 0.06, stageHalf * 2]} />
        <meshStandardMaterial color="#00ccff" emissive="#00ccff" emissiveIntensity={2} />
      </mesh>

      {/* Wall neon stripes — horizontal bands on stage sides for depth */}
      {/* Front face (z+) */}
      {[0.3, 0.8].map((y, i) => (
        <mesh key={`stripe-front-${i}`} position={[0, y, stageHalf + 0.01]}>
          <boxGeometry args={[stageHalf * 2, 0.05, 0.01]} />
          <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={1.5} />
        </mesh>
      ))}
      {/* Back face (z-) */}
      {[0.3, 0.8].map((y, i) => (
        <mesh key={`stripe-back-${i}`} position={[0, y, -(stageHalf + 0.01)]}>
          <boxGeometry args={[stageHalf * 2, 0.05, 0.01]} />
          <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={1.5} />
        </mesh>
      ))}
      {/* Left face (x-) */}
      {[0.3, 0.8].map((y, i) => (
        <mesh key={`stripe-left-${i}`} position={[-(stageHalf + 0.01), y, 0]}>
          <boxGeometry args={[0.01, 0.05, stageHalf * 2]} />
          <meshStandardMaterial color="#00ccff" emissive="#00ccff" emissiveIntensity={1.5} />
        </mesh>
      ))}
      {/* Right face (x+) */}
      {[0.3, 0.8].map((y, i) => (
        <mesh key={`stripe-right-${i}`} position={[stageHalf + 0.01, y, 0]}>
          <boxGeometry args={[0.01, 0.05, stageHalf * 2]} />
          <meshStandardMaterial color="#00ccff" emissive="#00ccff" emissiveIntensity={1.5} />
        </mesh>
      ))}

      {/* Bottom edge glow (where stage meets ground) */}
      <mesh position={[0, 0.02, stageHalf]}>
        <boxGeometry args={[stageHalf * 2, 0.04, 0.04]} />
        <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={1} />
      </mesh>
      <mesh position={[0, 0.02, -stageHalf]}>
        <boxGeometry args={[stageHalf * 2, 0.04, 0.04]} />
        <meshStandardMaterial color="#ff0055" emissive="#ff0055" emissiveIntensity={1} />
      </mesh>
      <mesh position={[-stageHalf, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.04, stageHalf * 2]} />
        <meshStandardMaterial color="#00ccff" emissive="#00ccff" emissiveIntensity={1} />
      </mesh>
      <mesh position={[stageHalf, 0.02, 0]}>
        <boxGeometry args={[0.04, 0.04, stageHalf * 2]} />
        <meshStandardMaterial color="#00ccff" emissive="#00ccff" emissiveIntensity={1} />
      </mesh>
    </group>
  );
};
