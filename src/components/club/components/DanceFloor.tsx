'use client';

import React, { useMemo } from 'react';
import { Instances, Instance } from '@react-three/drei';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
  warningOrange: '#ff8800',
};

const colorArray = [COLORS.matrixGreen, COLORS.cyberBlue, COLORS.neonPink, COLORS.warningOrange];

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
    const grouped: Record<number, [number, number, number][]> = { 0: [], 1: [], 2: [], 3: [] };
    tileData.forEach(({ position, colorIndex }) => {
      grouped[colorIndex].push(position);
    });
    return grouped;
  }, [tileData]);

  return (
    <group position={[0, -0.5, 0]}>
      <mesh position={[0, -0.1, 0]} receiveShadow>
        <boxGeometry args={[gridSize * tileSize + 0.5, 0.2, gridSize * tileSize + 0.5]} />
        <meshStandardMaterial color="#111111" metalness={0.9} roughness={0.1} />
      </mesh>

      {colorArray.map((color, colorIndex) => (
        <Instances key={colorIndex} limit={49}>
          <boxGeometry args={[tileSize - 0.05, 0.1, tileSize - 0.05]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.2}
            metalness={0.8}
            roughness={0.2}
          />
          {tilesByColor[colorIndex].map((pos, i) => (
            <Instance key={i} position={pos} />
          ))}
        </Instances>
      ))}
    </group>
  );
};
