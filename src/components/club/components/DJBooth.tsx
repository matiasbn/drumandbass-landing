'use client';

import React, { Suspense } from 'react';
import { useTexture } from '@react-three/drei';
import * as THREE from 'three';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
  warningOrange: '#ff8800',
};

const MAT = {
  darkBody: { color: '#1a1a1a', emissive: '#1a1a1a', emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.1 },
  surface: { color: '#222222', emissive: '#222222', emissiveIntensity: 0.5, roughness: 0.3, metalness: 0.2 },
  silver: { color: '#888888', emissive: '#555555', emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.4 },
  chrome: { color: '#aaaaaa', emissive: '#666666', emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.5 },
  screen: { color: '#111122', emissive: '#111122', emissiveIntensity: 0.8, roughness: 0.1, metalness: 0 },
  rubber: { color: '#0a0a0a', emissive: '#0a0a0a', emissiveIntensity: 0.4, roughness: 0.9, metalness: 0 },
  vinyl: { color: '#111111', emissive: '#111111', emissiveIntensity: 0.35, roughness: 0.5, metalness: 0 },
};

// Technics SL-1200 turntable
const Technics: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    {/* Base housing */}
    <mesh>
      <boxGeometry args={[0.9, 0.08, 0.7]} />
      <meshStandardMaterial {...MAT.silver} />
    </mesh>
    {/* Platter well */}
    <mesh position={[0.05, 0.045, 0.02]}>
      <cylinderGeometry args={[0.28, 0.28, 0.01, 16]} />
      <meshStandardMaterial {...MAT.darkBody} />
    </mesh>
    {/* Platter */}
    <mesh position={[0.05, 0.055, 0.02]}>
      <cylinderGeometry args={[0.26, 0.26, 0.02, 16]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
    {/* Platter dots */}
    {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
      <mesh key={`dot-${i}`} position={[0.05 + 0.22 * Math.cos((i / 8) * Math.PI * 2), 0.07, 0.02 + 0.22 * Math.sin((i / 8) * Math.PI * 2)]}>
        <cylinderGeometry args={[0.008, 0.008, 0.005, 6]} />
        <meshStandardMaterial {...MAT.darkBody} />
      </mesh>
    ))}
    {/* Vinyl record */}
    <mesh position={[0.05, 0.07, 0.02]}>
      <cylinderGeometry args={[0.22, 0.22, 0.005, 16]} />
      <meshStandardMaterial {...MAT.vinyl} />
    </mesh>
    {/* Record grooves */}
    <mesh position={[0.05, 0.075, 0.02]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.08, 0.21, 16]} />
      <meshStandardMaterial color="#0d0d0d" emissive="#0d0d0d" emissiveIntensity={0.3} side={2} />
    </mesh>
    {/* Label */}
    <mesh position={[0.05, 0.076, 0.02]}>
      <cylinderGeometry args={[0.06, 0.06, 0.003, 16]} />
      <meshStandardMaterial color="#882200" emissive="#882200" emissiveIntensity={0.5} />
    </mesh>
    {/* Spindle */}
    <mesh position={[0.05, 0.08, 0.02]}>
      <cylinderGeometry args={[0.008, 0.008, 0.02, 8]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
    {/* Tonearm base */}
    <mesh position={[-0.3, 0.06, -0.2]}>
      <cylinderGeometry args={[0.04, 0.04, 0.04, 12]} />
      <meshStandardMaterial {...MAT.silver} />
    </mesh>
    {/* Tonearm */}
    <mesh position={[-0.15, 0.09, -0.05]} rotation={[0, 0.4, 0]}>
      <boxGeometry args={[0.015, 0.015, 0.35]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
    {/* Headshell */}
    <mesh position={[-0.02, 0.09, 0.08]} rotation={[0, 0.4, 0]}>
      <boxGeometry args={[0.03, 0.01, 0.04]} />
      <meshStandardMaterial {...MAT.silver} />
    </mesh>
    {/* Pitch fader area */}
    <mesh position={[-0.35, 0.045, 0.1]}>
      <boxGeometry args={[0.08, 0.01, 0.3]} />
      <meshStandardMaterial {...MAT.darkBody} />
    </mesh>
    {/* Pitch slider */}
    <mesh position={[-0.35, 0.055, 0.1]}>
      <boxGeometry args={[0.04, 0.02, 0.05]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
    {/* Start/stop button */}
    <mesh position={[-0.3, 0.05, 0.28]}>
      <cylinderGeometry args={[0.025, 0.025, 0.015, 12]} />
      <meshStandardMaterial {...MAT.silver} />
    </mesh>
    {/* Target light */}
    <mesh position={[-0.05, 0.06, -0.28]}>
      <boxGeometry args={[0.02, 0.02, 0.02]} />
      <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={1.5} />
    </mesh>
  </group>
);

// Pioneer CDJ-3000
const CDJ3000: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    {/* Main body */}
    <mesh>
      <boxGeometry args={[0.7, 0.12, 0.65]} />
      <meshStandardMaterial {...MAT.darkBody} />
    </mesh>
    {/* Top panel */}
    <mesh position={[0, 0.065, 0]}>
      <boxGeometry args={[0.68, 0.01, 0.63]} />
      <meshStandardMaterial {...MAT.surface} />
    </mesh>
    {/* Jog wheel well */}
    <mesh position={[0, 0.075, 0.08]}>
      <cylinderGeometry args={[0.2, 0.2, 0.01, 16]} />
      <meshStandardMaterial {...MAT.darkBody} />
    </mesh>
    {/* Jog wheel outer ring */}
    <mesh position={[0, 0.08, 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
      <torusGeometry args={[0.17, 0.025, 8, 16]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
    {/* Jog wheel center display */}
    <mesh position={[0, 0.085, 0.08]}>
      <cylinderGeometry args={[0.14, 0.14, 0.005, 16]} />
      <meshStandardMaterial {...MAT.screen} />
    </mesh>
    {/* Jog display ring */}
    <mesh position={[0, 0.088, 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.11, 0.13, 16]} />
      <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={0.8} side={2} />
    </mesh>
    {/* Screen */}
    <mesh position={[0, 0.075, -0.2]}>
      <boxGeometry args={[0.35, 0.01, 0.12]} />
      <meshStandardMaterial color="#001122" emissive="#001122" emissiveIntensity={1.2} />
    </mesh>
    {/* Screen bezel */}
    <mesh position={[0, 0.073, -0.2]}>
      <boxGeometry args={[0.37, 0.008, 0.14]} />
      <meshStandardMaterial {...MAT.darkBody} />
    </mesh>
    {/* Performance pads (2x4 grid) */}
    {[0, 1, 2, 3].map((col) => [0, 1].map((row) => (
      <mesh key={`pad-${col}-${row}`} position={[-0.12 + col * 0.08, 0.075, 0.24 + row * 0.045]}>
        <boxGeometry args={[0.06, 0.015, 0.035]} />
        <meshStandardMaterial color="#333333" emissive="#333333" emissiveIntensity={0.5} roughness={0.6} metalness={0} />
      </mesh>
    ))).flat()}
    {/* Play/cue buttons */}
    <mesh position={[-0.2, 0.075, 0.15]}>
      <boxGeometry args={[0.06, 0.02, 0.04]} />
      <meshStandardMaterial color={COLORS.matrixGreen} emissive={COLORS.matrixGreen} emissiveIntensity={0.8} />
    </mesh>
    <mesh position={[0.2, 0.075, 0.15]}>
      <boxGeometry args={[0.06, 0.02, 0.04]} />
      <meshStandardMaterial color={COLORS.neonPink} emissive={COLORS.neonPink} emissiveIntensity={0.8} />
    </mesh>
    {/* Browse knob */}
    <mesh position={[0.25, 0.09, -0.15]}>
      <cylinderGeometry args={[0.03, 0.03, 0.04, 12]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
    {/* USB slot indicator */}
    <mesh position={[0.28, 0.075, -0.25]}>
      <boxGeometry args={[0.04, 0.01, 0.015]} />
      <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={1} />
    </mesh>
  </group>
);

// Pioneer DJM-A9 mixer
const DJMA9: React.FC<{ position: [number, number, number] }> = ({ position }) => (
  <group position={position}>
    {/* Main body */}
    <mesh>
      <boxGeometry args={[0.75, 0.12, 0.65]} />
      <meshStandardMaterial {...MAT.darkBody} />
    </mesh>
    {/* Top panel */}
    <mesh position={[0, 0.065, 0]}>
      <boxGeometry args={[0.73, 0.01, 0.63]} />
      <meshStandardMaterial {...MAT.surface} />
    </mesh>
    {/* Screen */}
    <mesh position={[0, 0.075, -0.22]}>
      <boxGeometry args={[0.3, 0.01, 0.08]} />
      <meshStandardMaterial color="#001122" emissive="#001122" emissiveIntensity={1.2} />
    </mesh>
    {/* 4 channel faders */}
    {[-0.22, -0.08, 0.08, 0.22].map((x, i) => (
      <group key={`ch-${i}`}>
        {/* Fader track */}
        <mesh position={[x, 0.075, 0.18]}>
          <boxGeometry args={[0.04, 0.01, 0.2]} />
          <meshStandardMaterial {...MAT.darkBody} />
        </mesh>
        {/* Fader knob */}
        <mesh position={[x, 0.085, 0.18 - i * 0.02]}>
          <boxGeometry args={[0.035, 0.025, 0.03]} />
          <meshStandardMaterial {...MAT.chrome} />
        </mesh>
      </group>
    ))}
    {/* EQ knobs per channel (3 per channel x 4 channels) */}
    {[-0.22, -0.08, 0.08, 0.22].map((x, ch) =>
      [-0.08, -0.03, 0.02].map((z, eq) => (
        <mesh key={`eq-${ch}-${eq}`} position={[x, 0.085, z]}>
          <cylinderGeometry args={[0.02, 0.02, 0.03, 10]} />
          <meshStandardMaterial {...MAT.chrome} />
        </mesh>
      ))
    ).flat()}
    {/* Crossfader track */}
    <mesh position={[0, 0.075, 0.28]}>
      <boxGeometry args={[0.35, 0.01, 0.03]} />
      <meshStandardMaterial {...MAT.darkBody} />
    </mesh>
    {/* Crossfader knob */}
    <mesh position={[0, 0.085, 0.28]}>
      <boxGeometry args={[0.04, 0.025, 0.025]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
    {/* VU meters (LED strips per channel) */}
    {[-0.15, 0.15].map((x, idx) => (
      <group key={`vu-${idx}`} position={[x, 0.075, -0.12]}>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <mesh key={i} position={[0, 0.005, i * 0.012]}>
            <boxGeometry args={[0.025, 0.01, 0.008]} />
            <meshStandardMaterial
              color={i < 4 ? COLORS.matrixGreen : i < 6 ? COLORS.warningOrange : COLORS.neonPink}
              emissive={i < 4 ? COLORS.matrixGreen : i < 6 ? COLORS.warningOrange : COLORS.neonPink}
              emissiveIntensity={i < 4 ? 1.2 : 0.5}
            />
          </mesh>
        ))}
      </group>
    ))}
    {/* Master knob */}
    <mesh position={[0.3, 0.09, -0.22]}>
      <cylinderGeometry args={[0.025, 0.025, 0.04, 12]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
    {/* Booth knob */}
    <mesh position={[-0.3, 0.09, -0.22]}>
      <cylinderGeometry args={[0.025, 0.025, 0.04, 12]} />
      <meshStandardMaterial {...MAT.chrome} />
    </mesh>
    {/* Send/return buttons */}
    {[-0.28, -0.22, 0.22, 0.28].map((x, i) => (
      <mesh key={`btn-${i}`} position={[x, 0.08, -0.1]}>
        <boxGeometry args={[0.03, 0.015, 0.03]} />
        <meshStandardMaterial
          color={i < 2 ? COLORS.cyberBlue : COLORS.neonPink}
          emissive={i < 2 ? COLORS.cyberBlue : COLORS.neonPink}
          emissiveIntensity={0.6}
        />
      </mesh>
    ))}
  </group>
);

const DJBoothInner: React.FC = () => {
  const [woodTexture, metalTexture] = useTexture(['/textures/wood.jpg', '/textures/metal.jpg']);
  woodTexture.wrapS = woodTexture.wrapT = THREE.RepeatWrapping;
  woodTexture.repeat.set(3, 1);
  metalTexture.wrapS = metalTexture.wrapT = THREE.RepeatWrapping;
  metalTexture.repeat.set(4, 1);

  return (
    <group position={[0, 0, -5]}>
      {/* Booth cabinet - wider to fit all equipment */}
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[5, 1, 1.5]} />
        <meshStandardMaterial
          color="#aa8866"
          map={woodTexture}
          emissive="#221100"
          emissiveIntensity={0.3}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>

      {/* Front metal panel */}
      <mesh position={[0, 0.5, 0.76]} castShadow>
        <boxGeometry args={[5, 0.9, 0.05]} />
        <meshStandardMaterial color="#888888" map={metalTexture} emissive="#111111" emissiveIntensity={0.2} metalness={0.6} roughness={0.3} />
      </mesh>

      {/* Neon edge strips */}
      <mesh position={[0, 0.9, 0.79]}>
        <boxGeometry args={[4.8, 0.06, 0.02]} />
        <meshStandardMaterial color={COLORS.neonPink} emissive={COLORS.neonPink} emissiveIntensity={3} />
      </mesh>
      <mesh position={[0, 0.1, 0.79]}>
        <boxGeometry args={[4.8, 0.06, 0.02]} />
        <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={3} />
      </mesh>

      {/* Top surface */}
      <mesh position={[0, 1.05, 0]} receiveShadow>
        <boxGeometry args={[5.1, 0.1, 1.7]} />
        <meshStandardMaterial color="#1a1a1a" emissive="#111111" emissiveIntensity={0.4} metalness={0.3} roughness={0.2} />
      </mesh>

      {/* Front/back edge trim */}
      <mesh position={[0, 1.05, 0.85]}>
        <boxGeometry args={[5.15, 0.12, 0.05]} />
        <meshStandardMaterial color="#888888" emissive="#444444" emissiveIntensity={0.4} metalness={0.6} roughness={0.2} />
      </mesh>
      <mesh position={[0, 1.05, -0.85]}>
        <boxGeometry args={[5.15, 0.12, 0.05]} />
        <meshStandardMaterial color="#888888" emissive="#444444" emissiveIntensity={0.4} metalness={0.6} roughness={0.2} />
      </mesh>

      {/* Equipment layout: Technics | CDJ | DJM-A9 | CDJ | Technics */}
      <Technics position={[-2.0, 1.15, 0]} />
      <CDJ3000 position={[-0.9, 1.15, 0]} />
      <DJMA9 position={[0, 1.15, 0]} />
      <CDJ3000 position={[0.9, 1.15, 0]} />
      <Technics position={[2.0, 1.15, 0]} />
    </group>
  );
};

export const DJBooth: React.FC = () => (
  <Suspense fallback={null}>
    <DJBoothInner />
  </Suspense>
);
