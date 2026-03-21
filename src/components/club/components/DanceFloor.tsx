'use client';

import React, { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';

// Moody cyberpunk palette — deep tones with subtle glow
const colorArray = [
  '#1a0a2e', // deep purple
  '#0d1b2a', // midnight blue
  '#1b1128', // dark plum
  '#0a1628', // navy
  '#12062e', // indigo
  '#0f1a24', // dark slate
];

export const DanceFloor: React.FC = () => {
  const gridSize = 14;
  const tileSize = 1;

  const tileData = useMemo(() => {
    const data: { position: [number, number, number]; colorIndex: number }[] = [];
    for (let x = 0; x < gridSize; x++) {
      for (let z = 0; z < gridSize; z++) {
        data.push({
          position: [
            (x - gridSize / 2 + 0.5) * tileSize,
            0,
            (z - gridSize / 2 + 0.5) * tileSize,
          ],
          colorIndex: (x + z) % colorArray.length,
        });
      }
    }
    return data;
  }, []);

  const tilesByColor = useMemo(() => {
    const grouped: Record<number, [number, number, number][]> = {};
    colorArray.forEach((_, i) => { grouped[i] = []; });
    tileData.forEach(({ position, colorIndex }) => {
      grouped[colorIndex].push(position);
    });
    return grouped;
  }, [tileData]);

  return (
    <group position={[0, -0.5, 0]}>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[gridSize * tileSize + 0.5, 0.2, gridSize * tileSize + 0.5]} />
        <meshStandardMaterial color="#0a0a0f" metalness={0.7} roughness={0.3} />
      </mesh>

      {colorArray.map((color, colorIndex) => (
        <Instances key={colorIndex} limit={49}>
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
    </group>
  );
};
