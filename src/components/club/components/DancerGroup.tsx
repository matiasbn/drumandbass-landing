'use client';

import React, { MutableRefObject } from 'react';
import { Dancer } from './Dancer';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
  warningOrange: '#ff8800',
};

const NPC_NAMES = ['Kiara', 'Dex', 'Zuri', 'Mako', 'Lyra', 'Riot', 'Nova', 'Blaze'];

// DJ booth is at [0, 0, -4]
const DJ_Z = -4;
const faceDJ = (x: number, z: number) => Math.atan2(0 - x, DJ_Z - z);

const dancerConfigs = [
  { position: [-2.5, 0, 1] as [number, number, number], color: COLORS.neonPink, offset: 0, speed: 1.1 },
  { position: [-1.5, 0, 2] as [number, number, number], color: COLORS.cyberBlue, offset: 0.5, speed: 0.9 },
  { position: [0, 0, 2.5] as [number, number, number], color: COLORS.matrixGreen, offset: 1, speed: 1.2 },
  { position: [1.5, 0, 2] as [number, number, number], color: COLORS.warningOrange, offset: 1.5, speed: 0.85 },
  { position: [2.5, 0, 1] as [number, number, number], color: COLORS.neonPink, offset: 2, speed: 1.0 },
  { position: [-2, 0, 3] as [number, number, number], color: COLORS.cyberBlue, offset: 2.5, speed: 1.15 },
  { position: [2, 0, 3] as [number, number, number], color: COLORS.matrixGreen, offset: 3, speed: 0.95 },
  { position: [0, 0, 3.5] as [number, number, number], color: COLORS.warningOrange, offset: 3.5, speed: 1.05 },
];

interface DancerGroupProps {
  isPlayingRef: MutableRefObject<boolean>;
}

export const DancerGroup: React.FC<DancerGroupProps> = ({ isPlayingRef }) => {
  return (
    <group>
      {dancerConfigs.map((config, index) => (
        <Dancer
          key={index}
          position={config.position}
          color={config.color}
          animationOffset={config.offset}
          animationSpeed={config.speed}
          isPlayingRef={isPlayingRef}
          name={NPC_NAMES[index]}
          rotationY={faceDJ(config.position[0], config.position[2])}
        />
      ))}
    </group>
  );
};
