'use client';

import React, { MutableRefObject } from 'react';
import { Dancer } from './Dancer';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
  warningOrange: '#ff8800',
};

const NPC_NAMES = [
  'Kiara', 'Dex', 'Zuri', 'Mako', 'Lyra', 'Riot', 'Nova', 'Blaze',
  'Jinx', 'Vega', 'Echo', 'Pulse', 'Nyx', 'Flux', 'Raze', 'Kira',
];

// DJ booth is now at center [0, 1.5, 0]
const faceDJ = (x: number, z: number) => Math.atan2(-x, -z);

const dancerConfigs = [
  // Original 8 — spread evenly
  { position: [-10, 0, -8] as [number, number, number], color: COLORS.neonPink, offset: 0, speed: 1.1 },
  { position: [8, 0, 10] as [number, number, number], color: COLORS.cyberBlue, offset: 0.5, speed: 0.9 },
  { position: [-5, 0, 12] as [number, number, number], color: COLORS.matrixGreen, offset: 1, speed: 1.2 },
  { position: [12, 0, -3] as [number, number, number], color: COLORS.warningOrange, offset: 1.5, speed: 0.85 },
  { position: [-12, 0, 5] as [number, number, number], color: COLORS.neonPink, offset: 2, speed: 1.0 },
  { position: [3, 0, -11] as [number, number, number], color: COLORS.cyberBlue, offset: 2.5, speed: 1.15 },
  { position: [10, 0, 8] as [number, number, number], color: COLORS.matrixGreen, offset: 3, speed: 0.95 },
  { position: [-8, 0, -10] as [number, number, number], color: COLORS.warningOrange, offset: 3.5, speed: 1.05 },
  // New 8 — fill gaps across the dance floor
  { position: [6, 0, -9] as [number, number, number], color: COLORS.neonPink, offset: 4, speed: 0.95 },
  { position: [-3, 0, 7] as [number, number, number], color: COLORS.cyberBlue, offset: 4.5, speed: 1.1 },
  { position: [11, 0, 3] as [number, number, number], color: COLORS.matrixGreen, offset: 5, speed: 0.9 },
  { position: [-9, 0, -2] as [number, number, number], color: COLORS.warningOrange, offset: 5.5, speed: 1.05 },
  { position: [1, 0, -6] as [number, number, number], color: COLORS.neonPink, offset: 6, speed: 1.15 },
  { position: [-6, 0, 10] as [number, number, number], color: COLORS.cyberBlue, offset: 6.5, speed: 0.85 },
  { position: [9, 0, -7] as [number, number, number], color: COLORS.matrixGreen, offset: 7, speed: 1.0 },
  { position: [-11, 0, -5] as [number, number, number], color: COLORS.warningOrange, offset: 7.5, speed: 0.9 },
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
