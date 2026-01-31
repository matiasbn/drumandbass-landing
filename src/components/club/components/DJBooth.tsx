'use client';

import React from 'react';

const COLORS = {
  matrixGreen: '#00ff41',
  cyberBlue: '#00ccff',
  neonPink: '#ff0055',
  warningOrange: '#ff8800',
};

export const DJBooth: React.FC = () => {
  return (
    <group position={[0, 0, -4]}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.2, 1, 1.5]} />
        <meshStandardMaterial color="#2d1f1a" metalness={0.2} roughness={0.8} />
      </mesh>

      <mesh position={[0, 0.5, 0.76]} castShadow>
        <boxGeometry args={[4.2, 0.9, 0.05]} />
        <meshStandardMaterial color="#3a3a3a" metalness={0.9} roughness={0.3} />
      </mesh>

      <mesh position={[0, 0.9, 0.79]}>
        <boxGeometry args={[4, 0.05, 0.02]} />
        <meshStandardMaterial color={COLORS.neonPink} emissive={COLORS.neonPink} emissiveIntensity={2} />
      </mesh>
      <mesh position={[0, 0.1, 0.79]}>
        <boxGeometry args={[4, 0.05, 0.02]} />
        <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={2} />
      </mesh>

      <mesh position={[0, 1.05, 0]} receiveShadow>
        <boxGeometry args={[4.3, 0.1, 1.7]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.95} roughness={0.05} />
      </mesh>

      <mesh position={[0, 1.05, 0.85]}>
        <boxGeometry args={[4.35, 0.12, 0.05]} />
        <meshStandardMaterial color="#888888" metalness={1} roughness={0.1} />
      </mesh>
      <mesh position={[0, 1.05, -0.85]}>
        <boxGeometry args={[4.35, 0.12, 0.05]} />
        <meshStandardMaterial color="#888888" metalness={1} roughness={0.1} />
      </mesh>

      {/* Left turntable */}
      <group position={[-1.2, 1.15, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.04, 32]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.05, 32]} />
          <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, (i / 6) * Math.PI * 2]} position={[0.35 * Math.cos((i / 6) * Math.PI * 2), 0.03, 0.35 * Math.sin((i / 6) * Math.PI * 2)]}>
            <cylinderGeometry args={[0.015, 0.015, 0.02, 8]} />
            <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.015, 32]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.1} roughness={0.4} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.12, 0.34, 32]} />
          <meshStandardMaterial color="#151515" metalness={0.2} roughness={0.5} side={2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.008, 32]} />
          <meshStandardMaterial color={COLORS.cyberBlue} emissive={COLORS.cyberBlue} emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0.35, 0.08, -0.3]} rotation={[0, 0.3, 0]}>
          <boxGeometry args={[0.02, 0.02, 0.35]} />
          <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Right turntable */}
      <group position={[1.2, 1.15, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 0.04, 32]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.42, 0.42, 0.05, 32]} />
          <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
        </mesh>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <mesh key={i} rotation={[-Math.PI / 2, 0, (i / 6) * Math.PI * 2]} position={[0.35 * Math.cos((i / 6) * Math.PI * 2), 0.03, 0.35 * Math.sin((i / 6) * Math.PI * 2)]}>
            <cylinderGeometry args={[0.015, 0.015, 0.02, 8]} />
            <meshStandardMaterial color="#888888" metalness={0.8} roughness={0.2} />
          </mesh>
        ))}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
          <cylinderGeometry args={[0.35, 0.35, 0.015, 32]} />
          <meshStandardMaterial color="#0a0a0a" metalness={0.1} roughness={0.4} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
          <ringGeometry args={[0.12, 0.34, 32]} />
          <meshStandardMaterial color="#151515" metalness={0.2} roughness={0.5} side={2} />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.055, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.008, 32]} />
          <meshStandardMaterial color={COLORS.matrixGreen} emissive={COLORS.matrixGreen} emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[-0.35, 0.08, -0.3]} rotation={[0, -0.3, 0]}>
          <boxGeometry args={[0.02, 0.02, 0.35]} />
          <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* Mixer */}
      <group position={[0, 1.15, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.9, 0.12, 0.65]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.065, 0]}>
          <boxGeometry args={[0.85, 0.02, 0.6]} />
          <meshStandardMaterial color="#2a2a2a" metalness={0.8} roughness={0.3} />
        </mesh>
        {[-0.25, 0, 0.25].map((x, i) => (
          <group key={`fader-${i}`} position={[x, 0.08, 0.15]}>
            <mesh>
              <boxGeometry args={[0.08, 0.02, 0.25]} />
              <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.02, -0.05 + i * 0.03]}>
              <boxGeometry args={[0.06, 0.03, 0.04]} />
              <meshStandardMaterial color="#555555" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
        <mesh position={[0, 0.08, -0.2]}>
          <boxGeometry args={[0.3, 0.02, 0.06]} />
          <meshStandardMaterial color="#333333" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[0.05, 0.1, -0.2]}>
          <boxGeometry args={[0.08, 0.03, 0.04]} />
          <meshStandardMaterial color="#666666" metalness={0.9} roughness={0.2} />
        </mesh>
      </group>

      {/* EQ knobs */}
      {[-0.3, -0.15, 0, 0.15, 0.3].map((x, i) => (
        <mesh key={`knob-${i}`} position={[x, 1.32, -0.15]}>
          <cylinderGeometry args={[0.035, 0.035, 0.06, 16]} />
          <meshStandardMaterial
            color={i === 2 ? COLORS.warningOrange : '#444444'}
            emissive={i === 2 ? COLORS.warningOrange : '#000000'}
            emissiveIntensity={i === 2 ? 0.5 : 0}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* LED VU meters */}
      {[-0.35, 0.35].map((x, idx) => (
        <group key={`vu-${idx}`} position={[x, 1.28, 0.2]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <mesh key={i} position={[0, i * 0.025, 0]}>
              <boxGeometry args={[0.04, 0.02, 0.02]} />
              <meshStandardMaterial
                color={i < 3 ? COLORS.matrixGreen : i < 4 ? COLORS.warningOrange : COLORS.neonPink}
                emissive={i < 3 ? COLORS.matrixGreen : i < 4 ? COLORS.warningOrange : COLORS.neonPink}
                emissiveIntensity={i < 3 ? 1 : 0.3}
              />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
};
